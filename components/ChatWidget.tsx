"use client";

import { useEffect, useRef, useState } from "react";
import { mesure, identifier } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import Icone, { type NomIcone } from "@/components/tj/Icone";
import TeteAide from "@/components/tj/TeteAide";

/** Événement d'ouverture, émis par le lien « Aide » de l'en-tête. */
export const EVENEMENT_AIDE = "cartoonova:aide";

/**
 * Messager d'aide.
 *
 * La mise en page reprend celle du messager Richpanel utilisé sur
 * turnedyellow.com : en-tête plein de 214 px qui se replie en barre de 75 px
 * dès que la conversation démarre, carte d'entrée qui chevauche la couture,
 * liste de sujets à filets, bulles à coin coupé, saisie en pilule. Les styles
 * vivent dans `app/toonjaune-app.css`, section « clavardage ».
 *
 * Le fond n'a pas changé : e-mail d'abord, puis les messages partent sur
 * /api/chat (webhook Discord).
 */

type Message = { de: "bot" | "moi"; texte: string };
type Ecran = "accueil" | "email" | "fil";

/** Sujets proposés sur l'accueil. Le premier ouvre la conversation nue. */
const SUJETS: { id: string; icone: NomIcone; titre: string; sous: string }[] = [
  {
    id: "commande",
    icone: "camion",
    titre: "Où en est ma commande ?",
    sous: "Suivi, délais et livraison",
  },
  {
    id: "modification",
    icone: "crayon",
    titre: "Modifier ma commande",
    sous: "Photo, style, texte ou adresse",
  },
  {
    id: "retouche",
    icone: "palette",
    titre: "Demander une retouche",
    sous: "Révisions illimitées avant impression",
  },
  {
    id: "cadeau",
    icone: "cadeau",
    titre: "Commander pour une date précise",
    sous: "Anniversaire, Noël, mariage",
  },
];

/** Initiales des conseillers, pour les têtes qui se chevauchent dans l'en-tête. */
const EQUIPE = ["L", "M", "S"];

export default function ChatWidget() {
  const [ouvert, setOuvert] = useState(false);
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [sujet, setSujet] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [erreurEmail, setErreurEmail] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [premierEnvoi, setPremierEnvoi] = useState(true);

  const filRef = useRef<HTMLDivElement>(null);
  const champEmailRef = useRef<HTMLInputElement>(null);
  const champSaisieRef = useRef<HTMLInputElement>(null);

  /* Le fil colle au dernier message. */
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, envoiEnCours]);

  /* Le champ attendu prend le focus à chaque changement d'écran. */
  useEffect(() => {
    if (!ouvert) return;
    if (ecran === "email") champEmailRef.current?.focus();
    if (ecran === "fil") champSaisieRef.current?.focus();
  }, [ouvert, ecran]);

  /* Ouverture de la bulle d'aide.
     Le support absorbe une charge que personne ne mesure : on ne sait ni
     combien de visiteurs l'ouvrent, ni sur quelles pages, ni quels sujets
     reviennent. C'est pourtant la liste des questions auxquelles le site ne
     repond pas — donc la feuille de route de son contenu. */
  useEffect(() => {
    if (!ouvert) return;
    mesure(MESURES.bulleAideOuverte);
  }, [ouvert]);

  /* Le lien de l'en-tête ouvre le panneau, comme leur `live-chat-top` déclenche
     le bouton flottant. Un événement plutôt qu'un contexte : un seul émetteur,
     un seul récepteur, et rien à faire remonter dans l'arbre. */
  useEffect(() => {
    const ouvrir = () => setOuvert(true);
    window.addEventListener(EVENEMENT_AIDE, ouvrir);
    return () => window.removeEventListener(EVENEMENT_AIDE, ouvrir);
  }, []);

  /* Échap ferme le panneau, comme n'importe quelle surface posée du site. */
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  const choisirSujet = (id: string | null) => {
    mesure(MESURES.sujetAideChoisi, { topic: id ?? "libre" });
    setSujet(id);
    setEcran(messages.length ? "fil" : "email");
  };

  const validerEmail = () => {
    const valeur = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur)) {
      setErreurEmail(true);
      return;
    }
    setErreurEmail(false);
    /* Une question au support vient presque toujours d'un client ou d'un
       futur client : l'adresse rattache la conversation au reste du parcours. */
    identifier(valeur, { source_identification: "chat" });
    const choisi = SUJETS.find((s) => s.id === sujet);
    setMessages([
      {
        de: "bot",
        texte: choisi
          ? `Bonjour ! On regarde ça tout de suite : « ${choisi.titre} ». Donnez-nous le numéro de commande ou quelques détails, et on vous répond.`
          : "Bonjour et bienvenue chez Cartoonova ! Dites-nous tout, on vous répond au plus vite.",
      },
    ]);
    setEcran("fil");
  };

  const envoyer = async () => {
    const texte = saisie.trim();
    if (!texte || envoiEnCours) return;

    setMessages((m) => [...m, { de: "moi", texte }]);
    setSaisie("");
    setEnvoiEnCours(true);

    /* Le sujet choisi sur l'accueil accompagne le premier message : l'équipe
       arrive dans Discord avec le contexte, sans champ supplémentaire côté API. */
    const choisi = SUJETS.find((s) => s.id === sujet);
    const corps = premierEnvoi && choisi ? `[${choisi.titre}] ${texte}` : texte;
    /* Le contenu du message ne part pas dans la mesure — il est deja dans
       Discord, et il contient des numeros de commande. Seul le fait qu'un
       message ait ete envoye compte ici. */
    mesure(MESURES.messageAideEnvoye, {
      topic: choisi?.id ?? "libre",
      premier: premierEnvoi,
    });
    setPremierEnvoi(false);

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: corps }),
      });
    } catch {
      /* échec silencieux : le message reste affiché, l'équipe relance par e-mail */
    }

    /* L'accusé de réception ne se dit qu'une fois : répété à l'identique sous
       chaque message, il donnait l'impression d'un robot cassé. */
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          de: "bot",
          texte: premierEnvoi
            ? "Merci ! Votre message est bien arrivé, notre équipe vous répond par e-mail sous 2 h ouvrées."
            : "C'est noté, on ajoute ça à votre demande.",
        },
      ]);
      setEnvoiEnCours(false);
    }, 800);
  };

  const enConversation = ecran !== "accueil";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Panneau */}
      {/* `slideInAnimation` chez eux : le panneau monte, il ne grandit pas. */}
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          ouvert ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!ouvert}
      >
        <div
          className={`clavardage${ecran === "fil" ? " clavardage--conversation" : ""}`}
          role="dialog"
          aria-label="Aide Cartoonova"
        >
          <header className={`clavardage__entete${enConversation ? " clavardage__entete--compact" : ""}`}>
            {enConversation ? (
              <>
                <button
                  type="button"
                  className="clavardage__retour"
                  onClick={() => setEcran("accueil")}
                  aria-label="Revenir à l'accueil de l'aide"
                >
                  <Fleche />
                </button>
                <div className="clavardage__agent">
                  <b>Cartoonova</b>
                  <span>
                    <i className="clavardage__pastille" aria-hidden="true" />
                    En ligne
                  </span>
                </div>
                <button
                  type="button"
                  className="clavardage__fermer"
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer l'aide"
                >
                  <Icone nom="croix" taille={14} />
                </button>
              </>
            ) : (
              <>
                <div className="clavardage__barre">
                  <div>
                    <p className="clavardage__surtitre">Bienvenue chez</p>
                    <p className="clavardage__marque">Cartoonova</p>
                  </div>
                  <button
                    type="button"
                    className="clavardage__fermer"
                    onClick={() => setOuvert(false)}
                    aria-label="Fermer l'aide"
                  >
                    <Icone nom="croix" taille={14} />
                  </button>
                </div>
                <p className="clavardage__salut">Bonjour 👋</p>
                <p className="clavardage__accroche">Une question sur votre portrait ? On est là.</p>
                <div className="clavardage__delai">
                  <div className="clavardage__equipe" aria-hidden="true">
                    {EQUIPE.map((initiale) => (
                      <span key={initiale} className="clavardage__tete">
                        {initiale}
                      </span>
                    ))}
                  </div>
                  <span>Réponse en moins de 2 h</span>
                  <Horloge />
                </div>
              </>
            )}
          </header>

          {ecran === "accueil" && (
            <>
              {/* Carte d'entrée : elle remonte sur l'en-tête, hors du défilement. */}
              <div className="clavardage__flottant">
                <div className="clavardage__carte clavardage__carte--flottante">
                  <button
                    type="button"
                    className="clavardage__lien clavardage__lien--principal"
                    onClick={() => choisirSujet(null)}
                  >
                    <span className="clavardage__lien-icone">
                      <Icone nom="discussion" taille={18} />
                    </span>
                    <span className="clavardage__lien-texte">
                      <span className="clavardage__lien-titre">Démarrer une conversation</span>
                      <span className="clavardage__lien-sous">Une vraie personne vous répond</span>
                    </span>
                    <Chevron />
                  </button>
                </div>
              </div>

              <div className="clavardage__corps">
                <p className="clavardage__intertitre">Liens rapides</p>
                <div className="clavardage__carte">
                  {SUJETS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="clavardage__lien"
                      onClick={() => choisirSujet(s.id)}
                    >
                      <span className="clavardage__lien-icone">
                        <Icone nom={s.icone} taille={18} />
                      </span>
                      <span className="clavardage__lien-texte">
                        <span className="clavardage__lien-titre">{s.titre}</span>
                        <span className="clavardage__lien-sous">{s.sous}</span>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                </div>

                <p className="clavardage__signature">Cartoonova — du lundi au samedi, 9 h – 19 h</p>
              </div>
            </>
          )}

          {/* Pas de carte flottante ici : la remontée de 24 px est calibrée sur
              l'en-tête plein de 214 px. Sur l'en-tête replié de 75 px elle
              recouvrait le nom et le bouton de retour. */}
          {ecran === "email" && (
            <div className="clavardage__corps">
              <div className="clavardage__carte">
                <div className="clavardage__accueil">
                  <h3>Votre e-mail pour commencer</h3>
                  <p>
                    Il nous sert à vous répondre même si vous quittez la page. Aucun envoi
                    publicitaire.
                  </p>
                  <input
                    ref={champEmailRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErreurEmail(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && validerEmail()}
                    placeholder="votre@email.com"
                    className="champ-ligne"
                    aria-invalid={erreurEmail}
                    aria-label="Votre adresse e-mail"
                  />
                  {erreurEmail && (
                    <p style={{ color: "#B3261E" }}>Cette adresse ne semble pas valide.</p>
                  )}
                  <button
                    type="button"
                    onClick={validerEmail}
                    className="bouton bouton--primaire"
                    style={{ width: "100%", justifyContent: "center", fontSize: 16 }}
                  >
                    Continuer
                  </button>
                </div>
              </div>
            </div>
          )}

          {ecran === "fil" && (
            <>
              <div className="clavardage__fil" ref={filRef}>
                {messages.map((m, i) => (
                  <div key={i} className={m.de === "moi" ? "bulle bulle--moi" : "bulle"}>
                    {m.texte}
                  </div>
                ))}
                {envoiEnCours && (
                  <div className="bulle clavardage__frappe" aria-label="Cartoonova est en train d'écrire">
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>

              <div className="clavardage__saisie">
                <div className="clavardage__pilule">
                  <input
                    ref={champSaisieRef}
                    type="text"
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && envoyer()}
                    placeholder="Écrivez votre message…"
                    aria-label="Votre message"
                  />
                  <button
                    type="button"
                    onClick={envoyer}
                    disabled={!saisie.trim() || envoiEnCours}
                    className={`clavardage__envoi${saisie.trim() && !envoiEnCours ? " clavardage__envoi--actif" : ""}`}
                    aria-label="Envoyer le message"
                  >
                    <Icone nom="envoyer" taille={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lanceur : pastille à libellé, qui bascule sur une croix à l'ouverture. */}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className={`clavardage__lanceur${ouvert ? " clavardage__lanceur--ouvert" : ""}`}
        aria-label={ouvert ? "Fermer l'aide" : "Ouvrir l'aide"}
        aria-expanded={ouvert}
      >
        {ouvert ? <Icone nom="croix" taille={17} /> : <TeteAide taille={37} />}
        <span className="clavardage__lanceur-texte">Live Chat</span>
      </button>
    </div>
  );
}

/* --- pictogrammes propres au messager ---
   Absents du jeu `Icone` ; même grille de 24 et même trait de 1,8. */

function Chevron() {
  return (
    <svg
      className="clavardage__chevron"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Fleche() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function Horloge() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", opacity: 0.75 }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
