"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { mesure, identifier } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import Icone, { type NomIcone } from "@/components/tj/Icone";
import TeteAide from "@/components/tj/TeteAide";
import { useRetourFerme } from "@/lib/useRetourFerme";
import { emailValide } from "@/lib/email";

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

/** Sujets proposés sur l'accueil. Les textes viennent de `messages/*.json`
    (espace `chat`) : le widget etait en francais dans les dix langues. Le
    libelle francais reste celui qui part sur Discord, pour que l'equipe lise
    toujours le meme sujet, quelle que soit la langue du visiteur. */
const SUJETS: { id: string; icone: NomIcone; cle: "Commande" | "Modif" | "Retouche" | "Cadeau"; discord: string }[] = [
  { id: "commande", icone: "camion", cle: "Commande", discord: "Où en est ma commande ?" },
  { id: "modification", icone: "crayon", cle: "Modif", discord: "Modifier ma commande" },
  { id: "retouche", icone: "palette", cle: "Retouche", discord: "Demander une retouche" },
  { id: "cadeau", icone: "cadeau", cle: "Cadeau", discord: "Commander pour une date précise" },
];

/** Initiales des conseillers, pour les têtes qui se chevauchent dans l'en-tête. */
const EQUIPE = ["L", "M", "S"];
// Onglet uniquement, jamais localStorage : ne conserver que la tentative en vol.
const BROUILLON_CHAT = "cartoonova:chat:pending:v1";
const DUREE_BROUILLON = 24 * 60 * 60 * 1000;
type Tentative = { email: string; corps: string; key: string; texte: string; sujet: string | null; premier: boolean; date: number };
function effacerBrouillon() { try { sessionStorage.removeItem(BROUILLON_CHAT); } catch { /* stockage indisponible */ } }
function expirerBrouillon(d: Tentative) {
  try {
    const courant = JSON.parse(sessionStorage.getItem(BROUILLON_CHAT) || "null");
    if (courant?.key === d.key && courant?.date === d.date) effacerBrouillon();
  } catch { effacerBrouillon(); }
}

const INFOS: Record<string, { incertain: string; limite: (n: number) => string }> = {
  fr: { incertain: "La réception est incertaine. Réessayez sans modifier ce message pour éviter un doublon.", limite: n => `Maximum : ${n} caractères pour ce message.` },
  en: { incertain: "Delivery is uncertain. Retry without editing this message to avoid duplicates.", limite: n => `Maximum: ${n} characters for this message.` },
  es: { incertain: "La recepción es incierta. Reintenta sin modificar el mensaje para evitar duplicados.", limite: n => `Máximo: ${n} caracteres para este mensaje.` },
  de: { incertain: "Der Empfang ist ungewiss. Versuche es ohne Änderungen erneut, um Duplikate zu vermeiden.", limite: n => `Maximum: ${n} Zeichen für diese Nachricht.` },
  it: { incertain: "La ricezione è incerta. Riprova senza modificare il messaggio per evitare duplicati.", limite: n => `Massimo: ${n} caratteri per questo messaggio.` },
  nl: { incertain: "Ontvangst is onzeker. Probeer opnieuw zonder dit bericht te wijzigen om duplicaten te voorkomen.", limite: n => `Maximum: ${n} tekens voor dit bericht.` },
  pl: { incertain: "Odbiór jest niepewny. Ponów bez zmiany wiadomości, aby uniknąć duplikatów.", limite: n => `Maksimum: ${n} znaków w tej wiadomości.` },
  sv: { incertain: "Mottagandet är osäkert. Försök igen utan att ändra meddelandet för att undvika dubbletter.", limite: n => `Maximalt ${n} tecken i detta meddelande.` },
  da: { incertain: "Modtagelsen er usikker. Prøv igen uden at ændre beskeden for at undgå dubletter.", limite: n => `Højst ${n} tegn i denne besked.` },
  pt: { incertain: "A receção é incerta. Tenta novamente sem alterar a mensagem para evitar duplicados.", limite: n => `Máximo: ${n} caracteres nesta mensagem.` },
};

export default function ChatWidget() {
  const t = useTranslations("chat");
  const tContact = useTranslations("contactForm");
  const infos = INFOS[useLocale().split("-")[0]] ?? INFOS.en;
  const [ouvert, setOuvert] = useState(false);
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [sujet, setSujet] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [erreurEmail, setErreurEmail] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [premierEnvoi, setPremierEnvoi] = useState(true);
  const [erreurEnvoi, setErreurEnvoi] = useState(false);
  const [erreurCertaine, setErreurCertaine] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const limiteId = useId();

  const tentativeRef = useRef<Tentative | null>(null);
  const filRef = useRef<HTMLDivElement>(null);
  const dialogueId = useId();
  const demarrerRef = useRef<HTMLButtonElement>(null);
  const lanceurRef = useRef<HTMLButtonElement>(null);
  const champEmailRef = useRef<HTMLInputElement>(null);
  const champSaisieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(BROUILLON_CHAT);
      if (!brut) return;
      const d = JSON.parse(brut) as Tentative;
      if (typeof d.email !== "string" || !emailValide(d.email.trim()) || typeof d.texte !== "string" || !d.texte.trim() || d.texte.length > 5000 || typeof d.corps !== "string" || d.corps.length > 5000 || typeof d.key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(d.key) || typeof d.premier !== "boolean" || (d.sujet !== null && !SUJETS.some(s => s.id === d.sujet)) || typeof d.date !== "number" || d.date > Date.now() || Date.now() - d.date >= DUREE_BROUILLON) { effacerBrouillon(); return; }
      tentativeRef.current = d;
      // La lecture navigateur après hydratation évite un rendu serveur divergent.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(d.email); setSujet(d.sujet); setPremierEnvoi(d.premier); setSaisie(d.texte);
      setEcran("fil"); setErreurEnvoi(true);
      const minuterie = window.setTimeout(() => expirerBrouillon(d), DUREE_BROUILLON - (Date.now() - d.date));
      return () => window.clearTimeout(minuterie);
    } catch { effacerBrouillon(); }
  }, []);

  /* Le fil colle au dernier message. */
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, envoiEnCours]);

  /* Dialogue non modal : mémoriser le déclencheur avant de déplacer le focus.
     La fermeture (Échap, croix ou retour mobile) le lui rend. */
  useEffect(() => {
    if (!ouvert) return;
    const declencheur = document.activeElement;
    const lanceur = lanceurRef.current;
    return () => {
      const cible = declencheur instanceof HTMLElement && declencheur.isConnected
        && declencheur !== document.body ? declencheur : lanceur;
      cible?.focus({ preventScroll: true });
    };
  }, [ouvert]);

  /* Le champ attendu prend le focus à chaque changement d'écran. */
  useEffect(() => {
    if (!ouvert) return;
    if (ecran === "email") champEmailRef.current?.focus();
    if (ecran === "accueil") demarrerRef.current?.focus();
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

  useRetourFerme(ouvert, () => setOuvert(false));

  /* Échap ferme le panneau, comme n'importe quelle surface posée du site.
     Écouter dès le montage : une ouverture native (Aide) peut afficher le
     panneau avant les effets passifs de [ouvert], sans perdre Échap entre-temps.
     Fermer un panneau déjà fermé est sans effet. */
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  const choisirSujet = (id: string | null) => {
    mesure(MESURES.sujetAideChoisi, { topic: id ?? "libre" });
    setSujet(id);
    setEcran(messages.length ? "fil" : "email");
  };

  const validerEmail = () => {
    const valeur = email.trim();
    if (!emailValide(valeur)) {
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
        texte: choisi ? t("botSujet", { titre: t(`sujet${choisi.cle}`) }) : t("botLibre"),
      },
    ]);
    setEcran("fil");
  };

  const envoyer = async () => {
    const texte = saisie.trim();
    if (!texte || envoiEnCours || saisie.length > limite) return;

    const dejaIncertain = erreurEnvoi;
    setErreurEnvoi(false);
    setErreurCertaine(false);
    setAnnonce("");
    setEnvoiEnCours(true);

    /* Le sujet choisi sur l'accueil accompagne le premier message : l'équipe
       arrive dans Discord avec le contexte, sans champ supplémentaire côté API. */
    const choisi = SUJETS.find((s) => s.id === sujet);
    const corps = premierEnvoi && choisi ? `[${choisi.discord}] ${texte}` : texte;
    if (!tentativeRef.current || tentativeRef.current.email !== email || tentativeRef.current.corps !== corps) {
      tentativeRef.current = { email, corps, key: crypto.randomUUID(), texte, sujet, premier: premierEnvoi, date: Date.now() };
    }
    const idempotencyKey = tentativeRef.current.key;
    // Enregistrer AVANT fetch : un reload pendant l'envoi est aussi incertain.
    try {
      const tentative = tentativeRef.current;
      sessionStorage.setItem(BROUILLON_CHAT, JSON.stringify(tentative));
      window.setTimeout(() => expirerBrouillon(tentative), Math.max(0, DUREE_BROUILLON - (Date.now() - tentative.date)));
    } catch { /* reprise en mémoire seulement */ }
    /* Le contenu du message ne part pas dans la mesure — il est deja dans
       Discord, et il contient des numeros de commande. Seul le fait qu'un
       message ait ete envoye compte ici. */
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: corps, idempotencyKey }),
      });
      if (!response.ok) {
        // Seuls les refus pré-insertion documentés prouvent l'absence d'effet,
        // et uniquement si aucune tentative précédente n'était incertaine.
        const payload = await response.json().catch(() => null);
        const rejetCertain = !dejaIncertain && ((response.status === 400 && ["invalid_input", "invalid_body"].includes(payload?.error)) || (response.status === 413 && payload?.error === "body_too_large") || (response.status === 429 && payload?.error === "rate_limited"));
        if (rejetCertain) {
          tentativeRef.current = null; effacerBrouillon(); setErreurCertaine(true);
          return;
        }
        throw new Error("chat_send_failed");
      }
      tentativeRef.current = null;
      effacerBrouillon();
      setMessages((m) => [...m, { de: "moi", texte }, { de: "bot", texte: premierEnvoi ? t("botMerci") : t("botNote") }]);
      setAnnonce(premierEnvoi ? t("botMerci") : t("botNote"));
      setSaisie("");
      mesure(MESURES.messageAideEnvoye, { topic: choisi?.id ?? "libre", premier: premierEnvoi });
      setPremierEnvoi(false);
    } catch {
      setErreurEnvoi(true);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const enConversation = ecran !== "accueil";
  const sujetActuel = SUJETS.find(s => s.id === sujet);
  const limite = 5000 - (premierEnvoi && sujetActuel ? `[${sujetActuel.discord}] `.length : 0);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Panneau */}
      {/* `slideInAnimation` chez eux : le panneau monte, il ne grandit pas. */}
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          ouvert ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!ouvert}
        inert={!ouvert}
      >
        <div
          className={`clavardage${ecran === "fil" ? " clavardage--conversation" : ""}`}
          role="dialog"
          id={dialogueId}
          aria-label={t("ariaDialog")}
        >
          <header className={`clavardage__entete${enConversation ? " clavardage__entete--compact" : ""}`}>
            {enConversation ? (
              <>
                <button
                  type="button"
                  className="clavardage__retour"
                  onClick={() => setEcran("accueil")}
                  disabled={envoiEnCours || erreurEnvoi}
                  aria-label={t("ariaRetour")}
                >
                  <Fleche />
                </button>
                <div className="clavardage__agent">
                  <b>Cartoonova</b>
                  <span>
                    <i className="clavardage__pastille" aria-hidden="true" />
                    {t("enLigne")}
                  </span>
                </div>
                <button
                  type="button"
                  className="clavardage__fermer"
                  onClick={() => setOuvert(false)}
                  aria-label={t("ariaFermer")}
                >
                  <Icone nom="croix" taille={14} />
                </button>
              </>
            ) : (
              <>
                <div className="clavardage__barre">
                  <div>
                    <p className="clavardage__surtitre">{t("bienvenue")}</p>
                    <p className="clavardage__marque">Cartoonova</p>
                  </div>
                  <button
                    type="button"
                    className="clavardage__fermer"
                    onClick={() => setOuvert(false)}
                    aria-label={t("ariaFermer")}
                  >
                    <Icone nom="croix" taille={14} />
                  </button>
                </div>
                <p className="clavardage__salut">{t("salut")}</p>
                <p className="clavardage__accroche">{t("accroche")}</p>
                <div className="clavardage__delai">
                  <div className="clavardage__equipe" aria-hidden="true">
                    {EQUIPE.map((initiale) => (
                      <span key={initiale} className="clavardage__tete">
                        {initiale}
                      </span>
                    ))}
                  </div>
                  <span>{t("delai")}</span>
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
                    ref={demarrerRef}
                    onClick={() => choisirSujet(null)}
                  >
                    <span className="clavardage__lien-icone">
                      <Icone nom="discussion" taille={18} />
                    </span>
                    <span className="clavardage__lien-texte">
                      <span className="clavardage__lien-titre">{t("demarrer")}</span>
                      <span className="clavardage__lien-sous">{t("demarrerSous")}</span>
                    </span>
                    <Chevron />
                  </button>
                </div>
              </div>

              <div className="clavardage__corps">
                <p className="clavardage__intertitre">{t("liensRapides")}</p>
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
                        <span className="clavardage__lien-titre">{t(`sujet${s.cle}`)}</span>
                        <span className="clavardage__lien-sous">{t(`sujet${s.cle}Sous`)}</span>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                </div>

                <p className="clavardage__signature">{t("signature")}</p>
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
                  <h3>{t("emailTitre")}</h3>
                  <p>{t("emailTexte")}</p>
                  <input
                    ref={champEmailRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErreurEmail(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && validerEmail()}
                    placeholder={t("emailPlaceholder")}
                    className="champ-ligne"
                    aria-invalid={erreurEmail}
                    aria-label={t("emailAria")}
                  />
                  {erreurEmail && (
                    <p style={{ color: "#B3261E" }}>{t("emailInvalide")}</p>
                  )}
                  <button
                    type="button"
                    onClick={validerEmail}
                    className="bouton bouton--primaire"
                    style={{ width: "100%", justifyContent: "center", fontSize: 16 }}
                  >
                    {t("continuer")}
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
                  <div className="bulle clavardage__frappe" aria-label={t("ariaEcrit")}>
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>

              <div className="clavardage__saisie">
                <p role="status" className="sr-only">{annonce}</p>
                {(erreurEnvoi || erreurCertaine) && <p role="alert">{tContact("erreurServeur")} {erreurEnvoi && infos.incertain}</p>}
                <p id={limiteId}>{infos.limite(limite)}</p>
                <div className="clavardage__pilule">
                  <input
                    ref={champSaisieRef}
                    type="text"
                    value={saisie}
                    readOnly={envoiEnCours || erreurEnvoi}
                    maxLength={limite}
                    aria-describedby={limiteId}
                    aria-busy={envoiEnCours}
                    onChange={(e) => setSaisie(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && envoyer()}
                    placeholder={t("saisiePlaceholder")}
                    aria-label={t("saisieAria")}
                  />
                  <button
                    type="button"
                    onClick={envoyer}
                    disabled={!saisie.trim() || envoiEnCours || saisie.length > limite}
                    className={`clavardage__envoi${saisie.trim() && !envoiEnCours && saisie.length <= limite ? " clavardage__envoi--actif" : ""}`}
                    aria-label={t("ariaEnvoyer")}
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
        ref={lanceurRef}
        onClick={() => setOuvert((o) => !o)}
        className={`clavardage__lanceur${ouvert ? " clavardage__lanceur--ouvert" : ""}`}
        aria-label={ouvert ? t("ariaFermer") : t("ariaOuvrir")}
        aria-expanded={ouvert}
        aria-controls={dialogueId}
      >
        {ouvert ? <Icone nom="croix" taille={17} /> : <TeteAide taille={37} />}
        <span className="clavardage__lanceur-texte">{t("lanceur")}</span>
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
