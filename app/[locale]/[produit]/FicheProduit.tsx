"use client";

import { useState, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import dynamic from "next/dynamic";

/* 1 100 lignes qui n'entrent en jeu qu'apres un clic sur « commander ». En
   import statique, elles pesaient sur le premier rendu de chaque fiche —
   celui qui decide du LCP. */
const CheckoutModal = dynamic(() => import("@/components/CheckoutModal"), { ssr: false });
import GiftDeadlineNote from "@/components/GiftDeadlineNote";
import BandeauLancement from "@/components/BandeauLancement";
import Etoiles from "@/components/tj/Etoiles";
import BadgeVerifie from "@/components/tj/BadgeVerifie";
import BulleQueue from "@/components/tj/BulleQueue";
import DateApercu from "@/components/DateApercu";
import { useLien } from "@/components/useLien";
import { useCurrency } from "@/components/CurrencyProvider";
import { useProductTracking } from "@/hooks/useProductTracking";
import { computeOrderSubtotal, computeShipping, type PrintKey } from "@/lib/pricing";
import type { Prices } from "@/lib/types";
import type { Decor, LegendeVisuel } from "@/lib/visuels";

/* Plafond partage avec la validation serveur : deux constantes qui divergent
   donneraient un formulaire qui accepte ce que le serveur refuse. */
import { MAX_PHOTOS } from "@/lib/orderPhotos";
import { tailleImpression } from "@/lib/supportCommande";
import { useRetourFerme } from "@/lib/useRetourFerme";
import { saisonCartesEtCalendrier } from "@/lib/evenements";
import "@/app/styles/options.css";

/* La saison des options carte de voeux / calendrier se lit dans le navigateur :
   la fiche est generee statiquement, une valeur calculee au build resterait
   figee jusqu'au deploiement suivant. Cote serveur, rien ne s'affiche. */
const pasDAbonnement = () => () => {};
const saisonServeur = () => false;

/* Le prix barre « -40 % » a disparu le 1er octobre 2026 : il affichait un prix
   de reference jamais pratique (le total divise par 0,6), ce que le droit de
   la consommation interdit. A la place, l'annonce honnete du prix de
   lancement — voir `lib/lancement.ts`. */

/* Format compact pour la vignette de support ("Poster • 30x40cm").
   Cette fonction decoupait auparavant la chaine traduite pour y retrouver la
   dimension, faute de la connaitre autrement. Elle est desormais une donnee de
   code : il n'y a plus rien a deviner, et plus rien a casser le jour ou une
   traduction change de separateur. */
function tailleCourte(taille: string): string {
  return taille.replace("×", "x").replace(/\s/g, "");
}

export interface Similaire {
  slug: string;
  univers: string;
  visuel: string | null;
}

export interface DonneesFiche {
  slug: string;
  idProduit: string;
  univers: string;
  titre: string;
  description: string;
  categorieNom: string;
  categorieCle: string;
  personnages: boolean;
  /** Champs propres au produit (voir `Produit.champsPersonnalises`). */
  champsPersonnalises?: "carte-pokemon" | "affiche-wanted" | null;
  galerie: string[];
  legendes: (LegendeVisuel | null)[];
  decors: Decor[];
  supports: Record<PrintKey, string>;
  similaires: Similaire[];
  /* Contenu long propre a cet univers, lu en base (voir `lib/contenuFiche.ts`).
     Absent tant qu'il n'a pas ete redige : la fiche s'affiche alors exactement
     comme avant, avec la FAQ partagee. C'est un supplement, pas une
     dependance. */
  contenu?: {
    intro: string | null;
    sections: { titre: string; corps: string }[];
    faq: { question: string; reponse: string }[];
  } | null;
}

/* Gabarit produit du systeme ToonJaune (gabarit/produit.html) :
   fil d'Ariane, galerie collante, tuiles d'arguments, panneau d'achat a
   etapes numerotees, puis les blocs de reassurance.
   Le configurateur pilote exactement les memes champs qu'avant — cadrage,
   personnes, animaux, decor, support, photos, note — pour que le calcul du
   prix cote serveur reste inchange. */

export default function FicheProduit({ donnees }: { donnees: DonneesFiche }) {
  const t = useTranslations("tj");
  const tp = useTranslations("product");
  const tf = useTranslations("fiche");
  const tProduit = useTranslations("product");
  const tDecor = useTranslations("product");
  const tDbz = useTranslations("dbz");
  const tAlt = useTranslations("alt");
  const tGarantie = useTranslations("garantie");
  /** Ramene a une etape du configurateur (recapitulatif, tuiles). */
  const allerA = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const lien = useLien();
  const { formatRaw: formatPrix, currency } = useCurrency();
  const {
    trackOptionSelected,
    trackGalleryBrowsed,
    trackGalleryZoomed,
    trackPhotoUploadStarted,
    trackPhotoUploaded,
    trackPhotoUploadFailed,
    trackBuyClicked,
    trackCheckoutStarted,
  } = useProductTracking({
    productId: donnees.idProduit,
    productName: donnees.titre,
    univers: donnees.univers,
  });

  const [vue, setVue] = useState(0);
  const [cadrage, setCadrage] = useState<"portrait" | "fullbody">("portrait");
  const [personnes, setPersonnes] = useState(1);
  const [animaux, setAnimaux] = useState(0);
  const [decor, setDecor] = useState(0);
  const [support, setSupport] = useState<PrintKey>("digital");
  const [photos, setPhotos] = useState<string[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [survol, setSurvol] = useState(false);
  const [note, setNote] = useState("");
  /* La note se replie derriere un lien : elle est facultative, et un champ
     de texte vide au milieu du tunnel se lit comme une etape de plus a
     remplir — sur une page que le mobile mesurait a 17 ecrans de haut. */
  const [noteOuverte, setNoteOuverte] = useState(false);
  const [carte, setCarte] = useState({ nom: "", pv: "", attaque1: "", attaque2: "" });
  const [wanted, setWanted] = useState({ nom: "", prime: "" });
  /* Options payantes (1er octobre 2026). Le second decor est un INDEX dans
     `donnees.decors`, distinct du decor principal. */
  const [banderole, setBanderole] = useState(false);
  const [texteBanderole, setTexteBanderole] = useState("");
  const [decorSup, setDecorSup] = useState(false);
  const [indexDecorSup, setIndexDecorSup] = useState(1);
  const [express, setExpress] = useState(false);
  /* Options numeriques de saison (F-6/F-7) : PDF envoyes par e-mail. */
  const [carteVoeux, setCarteVoeux] = useState(false);
  const [calendrier, setCalendrier] = useState(false);
  const enSaison = useSyncExternalStore(pasDAbonnement, saisonCartesEtCalendrier, saisonServeur);
  const carteVoeuxChoisie = enSaison && carteVoeux;
  const calendrierChoisi = enSaison && calendrier;
  const [prix, setPrix] = useState<Prices | null>(null);
  const [caisseOuverte, setCaisseOuverte] = useState(false);

  const champFichier = useRef<HTMLInputElement>(null);
  const boutonAchat = useRef<HTMLButtonElement>(null);
  const etapePhotos = useRef<HTMLDivElement>(null);
  const [boutonHorsEcran, setBoutonHorsEcran] = useState(false);

  useEffect(() => {
    fetch(`/api/prices?currency=${currency}`)
      .then((r) => r.json())
      .then(setPrix)
      .catch(() => setPrix(null));
  }, [currency]);

  /* Barre d'achat collante. Le bouton reel se trouve a 1808px du haut sur
     bureau et a 2749px sur mobile : passe ce point, plus rien ne permettait
     de commander sur les 5000px de sections qui suivent. La barre prend le
     relais des que le bouton est sorti par le haut, et disparait quand il
     revient pour ne pas doubler l'action au meme endroit.

     Ecoute du defilement plutot qu'un IntersectionObserver : celui-ci ne
     signale que les CHANGEMENTS d'intersection. Un saut direct — clic sur
     #configurateur, recherche dans la page, restauration de position — passe
     de « sous l'ecran » a « au-dessus » sans jamais croiser le bouton, et
     l'observateur ne rappelle rien : la barre restait cachee. */
  useEffect(() => {
    const calculer = () => {
      const cible = boutonAchat.current;
      if (!cible) return;
      setBoutonHorsEcran(cible.getBoundingClientRect().bottom < 0);
    };
    let enAttente = false;
    const surDefilement = () => {
      if (enAttente) return;
      enAttente = true;
      requestAnimationFrame(() => {
        enAttente = false;
        calculer();
      });
    };
    calculer();
    addEventListener("scroll", surDefilement, { passive: true });
    addEventListener("resize", surDefilement);
    return () => {
      removeEventListener("scroll", surDefilement);
      removeEventListener("resize", surDefilement);
    };
  }, []);

  const aDesDecors = donnees.decors.length > 0;

  const libelleDecor = (d: Decor) => {
    if (!d.ns) return d.cle;
    if (d.ns === "dbz") return tDbz(d.cle as "bg1");
    // Décors déposés sans nom : numérotés, traduits à l'affichage.
    if (d.ns === "tj") return `${t("decorNumero")} ${d.numero ?? ""}`.trim();
    return tDecor(d.cle as "bgBar");
  };

  /* Centimetres ou pouces, selon le marche. Un client americain lisait
     « 30×40 cm » sur les trois supports : une dimension qu'aucun de ses cadres
     ne porte, sur la page ou il decide d'acheter. */
  const taille = tailleImpression(currency);

  const supports: { cle: PrintKey; libelle: string; sous: string; supplement: number }[] = prix
    ? [
        { cle: "digital", libelle: tp("digital"), sous: tp("digitalSub"), supplement: prix.digital },
        { cle: "posterSimple", libelle: tp("posterOption"), sous: tp("posterSimpleSub", { taille }), supplement: prix.posterSimple },
        { cle: "canvas", libelle: tp("canvas"), sous: tp("canvasSub", { taille }), supplement: prix.canvas },
        { cle: "framed", libelle: tp("poster"), sous: tp("framedSub", { taille }), supplement: prix.poster },
      ]
    : [];

  const supportChoisi = supports.find((s) => s.cle === support);

  /* Le second decor n'a de sens que s'il en existe au moins deux. */
  const decorSupPossible = donnees.decors.length > 1;
  const decorSupChoisi = decorSup && decorSupPossible;
  const indexSup = indexDecorSup === decor ? (decor + 1) % Math.max(donnees.decors.length, 1) : indexDecorSup;

  /* La formule de prix n'existe qu'une fois, dans `lib/pricing.ts`, partagee
     avec le serveur : le prix affiche est celui qui sera facture. */
  const configPrix = {
    format: cadrage,
    people: personnes,
    animals: animaux,
    printKey: support,
    banner: banderole,
    extraDecor: decorSupChoisi,
    express,
    carteVoeux: carteVoeuxChoisie,
    calendrier: calendrierChoisi,
  } as const;
  /* Livraison des impressions : ajoutee au total affiche, comme le serveur
     l'ajoute au montant paye. Le numerique n'en a pas. */
  const port = prix ? computeShipping(prix, support) : 0;
  const total = prix ? Math.round((computeOrderSubtotal(prix, configPrix) + port) * 100) / 100 : 0;

  /* Un tableau plutot que la FileList : celle-ci est vivante, et la remise a
     zero du champ apres chaque choix la viderait pendant l'envoi. */
  const envoyer = async (fichiers: File[]) => {
    if (!fichiers.length) return;
    setEnvoiEnCours(true);
    setErreurEnvoi("");

    /* Le depot est l'etape la plus fragile du tunnel : elle depend du reseau
       du client et de photos qui pesent souvent plusieurs megaoctets. On la
       mesure des le debut et on chronometre, faute de quoi un echec ne se
       distingue pas d'un visiteur qui a renonce. */
    const aEnvoyer = fichiers.slice(0, MAX_PHOTOS);
    const debut = Date.now();
    trackPhotoUploadStarted(aEnvoyer.length);

    try {
      const urls: string[] = [];
      for (const fichier of aEnvoyer) {
        const blob = await upload(`orders/${Date.now()}-${fichier.name}`, fichier, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        urls.push(blob.url);
      }
      setPhotos((p) => [...p, ...urls].slice(0, MAX_PHOTOS));
      trackPhotoUploaded(urls.length, Date.now() - debut);
    } catch (erreur) {
      setErreurEnvoi(tp("uploadError"));
      trackPhotoUploadFailed(erreur instanceof Error ? erreur.message : "inconnue");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const descriptionCommande = [
    cadrage === "fullbody" ? tp("fullbody") : tp("portrait"),
    `${personnes} ${personnes > 1 ? tp("peoplePlural") : tp("peopleSingular")}`,
    animaux > 0 ? `${animaux} ${animaux > 1 ? tp("animalsPlural") : tp("animalsSingular")}` : null,
    aDesDecors ? libelleDecor(donnees.decors[decor]) : null,
    supportChoisi?.libelle,
    banderole ? tp("optBanner") : null,
    decorSupChoisi ? tp("optExtraDecorRecap", { decor: libelleDecor(donnees.decors[indexSup]) }) : null,
    express ? tp("optExpressRecap") : null,
    carteVoeuxChoisie ? tp("optCarteVoeux") : null,
    calendrierChoisi ? tp("optCalendrier") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /* Texte de la carte Pokemon, pour l'illustrateur. Libelles fixes en francais :
     c'est lui qui le lit, quelle que soit la langue du client. Il voyage dans
     la partie « note » de la description (apres « | »), ce qui le fait
     apparaitre tel quel partout ou `lireConsigne` affiche deja la note :
     admin, Discord, e-mails, assistant. Rien a changer cote serveur. */
  const avecCarte = donnees.champsPersonnalises === "carte-pokemon";
  const attaques = [carte.attaque1, carte.attaque2].map((a) => a.trim()).filter(Boolean);
  const texteCarte =
    avecCarte && (carte.nom.trim() || carte.pv.trim() || attaques.length)
      ? `Carte : ${[
          carte.nom.trim() && `nom « ${carte.nom.trim()} »`,
          carte.pv.trim() && `${carte.pv.trim()} PV`,
          attaques.length > 0 && `attaques ${attaques.map((a) => `« ${a} »`).join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · ")}`
      : "";
  /* Affiche Wanted : meme chemin que la carte Pokemon (note pour
     l'illustrateur, libelles fixes en francais). */
  const avecWanted = donnees.champsPersonnalises === "affiche-wanted";
  const texteWanted =
    avecWanted && (wanted.nom.trim() || wanted.prime.trim())
      ? `Affiche Wanted : ${[
          wanted.nom.trim() && `nom « ${wanted.nom.trim()} »`,
          wanted.prime.trim() && `prime « ${wanted.prime.trim()} »`,
        ]
          .filter(Boolean)
          .join(" · ")}`
      : "";
  /* Le texte de la banderole suit le meme chemin que la carte : dans la note,
     avec un libelle fixe en francais pour l'illustrateur. Pas de banderole sur
     l'affiche Wanted : le nom y figure deja, gratuitement. */
  const texteBanderoleNote =
    !avecWanted && banderole && texteBanderole.trim() ? `Banderole : « ${texteBanderole.trim()} »` : "";
  const noteComplete = [texteCarte, texteWanted, texteBanderoleNote, note.trim()].filter(Boolean).join(" — ");

  /* Une commande sans photo est impossible a honorer : l'illustrateur n'a rien
     a dessiner. On bloquait nulle part — ni ici, ni cote serveur — et le
     client atteignait le formulaire de carte bancaire. On l'arrete ici, en le
     ramenant a l'etape d'envoi plutot qu'en lui opposant un simple refus. */
  const ouvrirCaisse = (emplacement: "principal" | "barre_collante" = "principal") => {
    trackBuyClicked(emplacement, total, currency);

    /* La caisse s'ouvre desormais sans photo. Le refus qui se trouvait ici
       arretait sept visiteurs sur dix : sur trente jours, dix personnes
       configuraient un portrait et trois seulement envoyaient une photo.
       Et il ne se voyait dans aucun chiffre — `purchase_blocked` n'est jamais
       parti, parce que personne n'allait jusqu'a se heurter au mur. Les gens
       partaient a l'etape d'envoi, ce qui ressemblait a un abandon spontane.

       Les photos se deposent maintenant apres paiement, par un lien signe
       envoye avec la confirmation. `photosDifferees` sert a le dire au client
       dans la caisse : payer sans avoir rien envoye doit etre un choix
       explique, pas une impression d'oubli. */
    trackCheckoutStarted(total, currency, {
      format: cadrage,
      people: personnes,
      animals: animaux,
      background: aDesDecors ? donnees.decors[decor].cle : "default",
      printOption: supportChoisi?.libelle ?? "digital",
    });
    setCaisseOuverte(true);
  };

  const visuelPrincipal = donnees.galerie[vue];

  /* ═══ balayage de la galerie ═══════════════════════════════════════════
     Le visuel principal ne repondait pas au doigt. Ce n'est pas une
     hypothese d'ergonomie : le client du 25 aout a tente de balayer trois
     fois entre 10h36 et 10h38 — PostHog les a enregistres en `$dead_swipe` —
     avant d'aller cliquer sur les vignettes. Sur les quatorze derniers jours,
     treize balayages morts pour 255 pages vues.

     Le geste ne fait que ce que les vignettes font deja : il ne remplace ni
     les boutons, ni le clavier, ni les libelles. */
  const nbVisuels = Math.min(6, donnees.galerie.length);
  const departToucher = useRef<{ x: number; y: number } | null>(null);

  /** Deplacement minimal, en pixels, pour distinguer un balayage d'un appui. */
  const SEUIL_BALAYAGE = 40;

  /* Agrandissement du visuel.
   *
   * Le releve des clics morts a montre que les gens cliquaient la photo en
   * attendant qu'elle s'ouvre, et que rien ne se passait : c'est le seul motif
   * de ce releve qui soit un vrai manque, les autres etant des faux positifs
   * (clic dans une zone de texte, re-clic sur une option deja active).
   *
   * `balayageEnCours` empeche le geste de balayage de se terminer en
   * agrandissement : sur mobile, un doigt qui glisse leve aussi un clic. */
  const [agrandi, setAgrandi] = useState(false);
  const balayageEnCours = useRef(false);
  useRetourFerme(agrandi, () => setAgrandi(false));

  useEffect(() => {
    if (!agrandi) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgrandi(false);
    };
    window.addEventListener("keydown", auClavier);
    // Le fond ne doit pas defiler derriere l'agrandissement.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [agrandi]);

  const ouvrirAgrandissement = () => {
    if (balayageEnCours.current || !visuelPrincipal) return;
    setAgrandi(true);
    trackGalleryZoomed(vue);
  };

  const allerAuVisuel = (index: number, source: "vignette" | "balayage") => {
    if (nbVisuels < 1) return;
    // Modulo positif : le balayage boucle dans les deux sens.
    const borne = ((index % nbVisuels) + nbVisuels) % nbVisuels;
    setVue(borne);
    trackGalleryBrowsed(borne, source);
  };

  const debutToucher = (e: React.TouchEvent) => {
    const t = e.touches[0];
    departToucher.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const finToucher = (e: React.TouchEvent) => {
    const depart = departToucher.current;
    departToucher.current = null;
    if (!depart || nbVisuels < 2) return;

    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - depart.x;
    const dy = t.clientY - depart.y;

    /* Un geste plus vertical qu'horizontal est un defilement de page. Le
       confondre avec un balayage ferait sauter le visuel des qu'on fait
       defiler la fiche, ce qui est pire que l'absence de balayage. */
    if (Math.abs(dx) < SEUIL_BALAYAGE || Math.abs(dx) <= Math.abs(dy)) return;

    /* Un balayage leve aussi un clic : on neutralise l'agrandissement le temps
       que l'evenement de clic passe. */
    balayageEnCours.current = true;
    setTimeout(() => { balayageEnCours.current = false; }, 350);

    allerAuVisuel(vue + (dx < 0 ? 1 : -1), "balayage");
  };

  /* Titre du visuel courant. Il était incrusté en français dans le montage
     d'origine ; détouré, il redevient du texte — traduit, indexable, lisible
     par un lecteur d'écran, et sans une image par langue. */
  /* Photos de clients : les visuels sans titre. Sur les fiches importées, ce
     sont les portraits envoyés par les clients ; sur les six univers d'origine,
     toute la galerie. Les montages « impression » et « encadrement » en sont
     exclus — ce ne sont pas des photos de clients, et les présenter comme
     telles sous un avis signé serait faux. */
  const portraitsClients = donnees.galerie.filter((_, i) => donnees.legendes[i] === null);

  /* Autant de cartes d'avis que de photos disponibles, sans repetition — une
     meme photo sous deux avis signes differemment se remarque. Quatre au plus,
     c'est ce que la grille du systeme accueille sur une rangee. Sans aucune
     photo, la section entiere est masquee plus bas — un avis illustre par un
     substitut generique ferait plus de tort que son absence. */
  const nbAvis = Math.min(4, portraitsClients.length);

  const legende = donnees.legendes[vue];
  const titreVisuel = legende
    ? {
        transformation: [t("legTransfo"), t("legTransfoAcc", { univers: donnees.univers })],
        impression: [t("legImpression"), t("legImpressionAcc")],
        cadre: [t("legCadre"), t("legCadreAcc")],
      }[legende]
    : null;

  return (
    <>
      <div>
        <div className="enveloppe">
          <nav className="fil" aria-label="Fil d'Ariane">
            <Link href={lien("/")}>{t("filAccueil")}</Link>
            <span>›</span>
            <Link href={lien(`/collections#${donnees.categorieCle}`)}>{donnees.categorieNom}</Link>
            <span>›</span>
            <b>{donnees.titre}</b>
          </nav>
        </div>

        <div className="enveloppe achat">
          {/* ---------- GALERIE ---------- */}
          <div className="galerie">
            {titreVisuel && (
              <p className="galerie__legende">
                {titreVisuel[0]} <span className="accent">{titreVisuel[1]}</span>
              </p>
            )}
            {/* Le cadre porte le balayage plutot que l'image : il englobe aussi
                le substitut, et `touch-action: pan-y` s'applique a lui. */}
            <div className="galerie__cadre" onTouchStart={debutToucher} onTouchEnd={finToucher}>
              {visuelPrincipal ? (
                /* Un bouton, pas un `onClick` sur l'image : sans cela le geste
                   n'existe pas au clavier ni pour un lecteur d'ecran. */
                <button
                  type="button"
                  className="galerie__loupe"
                  onClick={ouvrirAgrandissement}
                  aria-label={t("agrandir")}
                >
                  {/* Le montage avant/apres est montre en entier : recadre au
                      carre, il perdait la photo d'origine, posee en medaillon
                      sur un bord — c'est-a-dire precisement ce qu'il prouve. */}
                  <Image
                    className={`galerie__vue${legende === "transformation" ? " galerie__vue--entier" : ""}`}
                    src={visuelPrincipal}
                    alt={donnees.titre}
                    width={1000}
                    height={1000}
                    priority
                    sizes="(max-width: 860px) 92vw, 46vw"
                  />
                </button>
              ) : (
                <div className="galerie__vue substitut">
                  <span>{donnees.univers}</span>
                  <small>{donnees.categorieNom}</small>
                </div>
              )}
            </div>

            {agrandi && visuelPrincipal && (
              <div
                className="agrandissement"
                role="dialog"
                aria-modal="true"
                aria-label={donnees.titre}
                onClick={() => setAgrandi(false)}
              >
                <button
                  type="button"
                  className="agrandissement__fermer"
                  onClick={() => setAgrandi(false)}
                  aria-label={t("fermer")}
                >
                  ×
                </button>
                <Image
                  src={visuelPrincipal}
                  alt={donnees.titre}
                  width={1400}
                  height={1400}
                  className="agrandissement__vue"
                  sizes="92vw"
                />
              </div>
            )}

            {/* Les vignettes etaient six <img> avec un onClick : ni focusables,
                ni actionnables au clavier, et aria-current ne veut rien dire
                sur un element non interactif. En boutons, on peut changer de
                visuel a la tabulation comme a la souris. */}
            {donnees.galerie.length > 1 && (
              <div className="galerie__vignettes" role="group" aria-label={tp("gallerySubtitle")}>
                {donnees.galerie.slice(0, 6).map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    className="galerie__vignette"
                    aria-pressed={i === vue}
                    aria-label={`${donnees.titre} — ${i + 1}/${Math.min(6, donnees.galerie.length)}`}
                    onClick={() => allerAuVisuel(i, "vignette")}
                  >
                    <Image src={src} alt="" width={74} height={74} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------- TUILES ---------- */}
          {/* Des liens et non des etiquettes : 13 clics sans effet en 30 jours
              sur ces tuiles (releve PostHog du 6 octobre 2026). Chacune mene a
              ce qu'elle promet. */}
          <div className="tuiles">
            <Link className="tuile" href={lien("/quelle-photo")} data-cta="tuile_photo">
              <IconesTuile nom="main" />
              <b>{tp("handDrawn")}</b>
            </Link>
            <button type="button" className="tuile" data-cta="tuile_perso" onClick={() => allerA("configurateur")}>
              <IconesTuile nom="reglages" />
              <b>{t("tuilePerso")}</b>
            </button>
            <Link className="tuile" href={lien("/garantie")} data-cta="tuile_retouches">
              <IconesTuile nom="coche" />
              <b>{t("tuileRetouches")}</b>
            </Link>
            <Link className="tuile tuile--fort" href={lien("/garantie")} data-cta="tuile_delai">
              {/* Meme promesse que partout ailleurs : un aperçu en 2 jours. « 48H »
                  se lisait a cote de « aperçu sous 2 jours », deux formulations
                  pour une seule promesse. */}
              <b>{t("tuileDelai")}</b>
              <b style={{ fontFamily: "var(--texte)", fontSize: "12.5px", color: "#fff" }}>
                {t("tuileApercu")}
              </b>
            </Link>
          </div>

          {/* ---------- PANNEAU D'ACHAT ---------- */}
          <div className="panneau" id="configurateur">
            <div className="panneau__preuve">
              <span className="etoiles" style={{ lineHeight: 0 }}>
                <Etoiles largeur={92} />
              </span>
              <span>2 540 {tp("verifiedReviews")}</span>
              <i>·</i>
              <span>85 000+ {tp("portraitsDelivered")}</span>
            </div>

            <h1>{donnees.titre}</h1>

            {/* Prix juste sous le titre. Il n'apparaissait qu'apres tout le
                configurateur — a 1732px du haut sur bureau, 2673px sur mobile :
                on ne pouvait pas savoir combien coute le produit sans traverser
                sept etapes. Place avant la description, il tient au-dessus de
                la ligne de flottaison sur les trois formats, et il suit les
                options en direct. */}
            <div className="panneau__prix">
              <strong>{prix ? formatPrix(total) : "—"}</strong>
              <span>{tp("totalLabel")}</span>
              {port > 0 && <small className="panneau__port">{tp("shippingLine", { montant: formatPrix(port) })}</small>}
            </div>
            <BandeauLancement />
            <DateApercu physique={support !== "digital"} express={express} />

            <p className="panneau__accroche">{donnees.description}</p>

            <div className="livraison">
              <IconesTuile nom="camion" />
              <GiftDeadlineNote variante="ligne" />
            </div>

            {/* Personnes et animaux : une seule etape, deux rangees. C'est une
                seule question — qui sera sur le dessin — et deux etapes
                numerotees pour y repondre allongeaient le tunnel d'un titre,
                d'une marge et d'un filet. */}
            <Etape
              numero
              ancre="etape-qui"
              titre={tf("etapeQui")}
              precision={`: ${personnes} ${personnes > 1 ? tp("peoplePlural") : tp("peopleSingular")}${
                animaux > 0 ? ` · ${animaux} ${animaux > 1 ? tp("animalsPlural") : tp("animalsSingular")}` : ""
              }`}
            >
              <p className="qui-ligne__titre" id="qui-personnes">{tf("lignePersonnes")}</p>
              <div className="pastilles" role="group" aria-labelledby="qui-personnes">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="pastille"
                    aria-pressed={personnes === n}
                    onClick={() => {
                      setPersonnes(n);
                      trackOptionSelected("people", n, prix?.extraPerson ?? 0);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <p className="qui-ligne__titre" id="qui-animaux">{tp("animalsLabel")}</p>
              <div className="pastilles pastilles--animaux" role="group" aria-labelledby="qui-animaux">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="pastille"
                    aria-pressed={animaux === n}
                    onClick={() => {
                      setAnimaux(n);
                      trackOptionSelected("animals", n, prix?.extraAnimal ?? 0);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Etape>

            <Etape
              numero
              ancre="etape-cadrage"
              titre={tp("framingStep")}
              precision={`: ${cadrage === "portrait" ? tp("portrait") : tp("fullbody")}`}
            >
              <div className="vignettes vignettes--cadrage" role="group" aria-label={tp("framingStep")}>
                {(["portrait", "fullbody"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="vignette vignette--texte"
                    aria-pressed={cadrage === c}
                    onClick={() => {
                      setCadrage(c);
                      trackOptionSelected("format", c, c === "fullbody" ? prix?.fullbodyExtra ?? 0 : 0);
                    }}
                  >
                    <span className="vignette__nom">{c === "portrait" ? tp("portrait") : tp("fullbody")}</span>
                    <span className="vignette__sous">
                      {c === "portrait" ? tp("portraitSub") : tp("fullbodySub")}
                    </span>
                  </button>
                ))}
              </div>
            </Etape>

            {aDesDecors && (
              <Etape numero ancre="etape-decor" titre={tp("decorStep")} precision={`: ${libelleDecor(donnees.decors[decor])}`}>
                <div className="vignettes vignettes--decors" role="group" aria-label={tp("decorStep")}>
                  {donnees.decors.map((d, i) => (
                    <button
                      key={d.src}
                      type="button"
                      className="vignette vignette--decor"
                      aria-pressed={decor === i}
                      title={libelleDecor(d)}
                      onClick={() => {
                        setDecor(i);
                        trackOptionSelected("background", d.cle);
                      }}
                    >
                      {/* alt vide : le nom du decor est desormais affiche en
                          clair sous la vignette, le repeter en alternative
                          textuelle le ferait annoncer deux fois. */}
                      <Image src={d.src} alt="" width={104} height={104} />
                      <span className="vignette__nom">{libelleDecor(d)}</span>
                    </button>
                  ))}
                </div>
              </Etape>
            )}

            {avecWanted && (
              <Etape numero titre={tp("wantedEtape")} precision={tp("optional")}>
                <p className="depot__note" style={{ marginTop: 0 }}>{tp("wantedAide")}</p>
                <div className="champ-groupe">
                  <label className="champ-etiquette" htmlFor="wanted-nom">{tp("wantedNom")}</label>
                  <input
                    id="wanted-nom"
                    className="champ-ligne"
                    maxLength={40}
                    value={wanted.nom}
                    onChange={(e) => setWanted((w) => ({ ...w, nom: e.target.value }))}
                    placeholder={tp("wantedNomExemple")}
                  />
                </div>
                <div className="champ-groupe">
                  <label className="champ-etiquette" htmlFor="wanted-prime">{tp("wantedPrime")}</label>
                  <input
                    id="wanted-prime"
                    className="champ-ligne"
                    maxLength={20}
                    value={wanted.prime}
                    onChange={(e) => setWanted((w) => ({ ...w, prime: e.target.value }))}
                    placeholder={tp("wantedPrimeExemple")}
                    style={{ maxWidth: 260 }}
                  />
                </div>
              </Etape>
            )}

            {avecCarte && (
              <Etape numero titre={tp("carteEtape")} precision={tp("optional")}>
                <p className="depot__note" style={{ marginTop: 0 }}>{tp("carteAide")}</p>
                <div className="champ-groupe">
                  <label className="champ-etiquette" htmlFor="carte-nom">{tp("carteNom")}</label>
                  <input
                    id="carte-nom"
                    className="champ-ligne"
                    maxLength={40}
                    value={carte.nom}
                    onChange={(e) => setCarte((c) => ({ ...c, nom: e.target.value }))}
                    placeholder={tp("carteNomExemple")}
                  />
                </div>
                <div className="champ-duo">
                  <div className="champ-groupe">
                    <label className="champ-etiquette" htmlFor="carte-attaque1">{tp("carteAttaque1")}</label>
                    <input
                      id="carte-attaque1"
                      className="champ-ligne"
                      maxLength={30}
                      value={carte.attaque1}
                      onChange={(e) => setCarte((c) => ({ ...c, attaque1: e.target.value }))}
                      placeholder={tp("carteAttaque1Exemple")}
                    />
                  </div>
                  <div className="champ-groupe">
                    <label className="champ-etiquette" htmlFor="carte-attaque2">{tp("carteAttaque2")}</label>
                    <input
                      id="carte-attaque2"
                      className="champ-ligne"
                      maxLength={30}
                      value={carte.attaque2}
                      onChange={(e) => setCarte((c) => ({ ...c, attaque2: e.target.value }))}
                      placeholder={tp("carteAttaque2Exemple")}
                    />
                  </div>
                </div>
                <div className="champ-groupe">
                  <label className="champ-etiquette" htmlFor="carte-pv">{tp("cartePv")}</label>
                  <input
                    id="carte-pv"
                    className="champ-ligne"
                    inputMode="numeric"
                    maxLength={4}
                    value={carte.pv}
                    onChange={(e) => setCarte((c) => ({ ...c, pv: e.target.value.replace(/\D/g, "") }))}
                    placeholder="350"
                    style={{ maxWidth: 140 }}
                  />
                </div>
              </Etape>
            )}

            <Etape
              numero
              ancre="etape-support"
              titre={tp("printSupportStep")}
              precision={
                supportChoisi
                  ? `: ${supportChoisi.libelle}${
                      supportChoisi.cle !== "digital" ? ` • ${tailleCourte(taille)}` : ""
                    }`
                  : undefined
              }
            >
              {/* Grille dediee a 4 colonnes fixes : en flex-wrap partage avec
                  les autres etapes, la quatrieme carte (la plus large,
                  "Portrait Encadre") retombait seule sur une deuxieme ligne
                  des que les trois premieres depassaient la largeur du
                  panneau de quelques pixels. */}
              <div className="vignettes vignettes--supports" role="group" aria-label={tp("printSupportStep")}>
                {supports.map((s) => (
                  <button
                    key={s.cle}
                    type="button"
                    className="vignette vignette--large"
                    aria-pressed={support === s.cle}
                    onClick={() => {
                      setSupport(s.cle);
                      trackOptionSelected("print", s.libelle, s.supplement);
                    }}
                  >
                    <Image src={donnees.supports[s.cle]} alt="" width={92} height={68} />
                    <span className="vignette__nom">{s.libelle}</span>
                    {/* Le descripteur — taille, finition, format de fichier.
                        Il etait traduit dans les dix langues et affiche nulle
                        part : la vignette ne portait que le nom et le prix.
                        C'est pourtant ici que le client tranche entre une toile
                        et un poster, et « prete a accrocher » ou « cadre chene »
                        est exactement ce qui fait la difference. */}
                    <span className="vignette__sous">{s.sous}</span>
                    <span className="vignette__prix">
                      {s.supplement === 0 ? tp("included") : `+${formatPrix(s.supplement)}`}
                    </span>
                  </button>
                ))}
              </div>
            </Etape>

            {/* ---------- OPTIONS PAYANTES ----------
                Trois cases, chacune avec son prix. Le texte de la banderole et
                le choix du second decor ne s'ouvrent que si l'option est cochee. */}
            {prix && (
              <Etape numero titre={tp("optStep")} precision={tp("optional")}>
                <div className="options-payantes">
                  {!avecWanted && (
                  <label className="option-payante">
                    <input type="checkbox" checked={banderole} onChange={(e) => { setBanderole(e.target.checked); trackOptionSelected("addon", `banner:${e.target.checked ? "on" : "off"}`, prix?.banner ?? 0); }} />
                    <span className="option-payante__texte">
                      <b>{tp("optBanner")}</b>
                      <small>{tp("optBannerSub")}</small>
                    </span>
                    <span className="option-payante__prix">+{formatPrix(prix.banner)}</span>
                  </label>
                  )}
                  {banderole && !avecWanted && (
                    <input
                      className="champ-ligne option-payante__champ"
                      maxLength={40}
                      value={texteBanderole}
                      onChange={(e) => setTexteBanderole(e.target.value)}
                      placeholder={tp("optBannerPlaceholder")}
                      aria-label={tp("optBanner")}
                    />
                  )}

                  {decorSupPossible && (
                    <>
                      <label className="option-payante">
                        <input type="checkbox" checked={decorSup} onChange={(e) => { setDecorSup(e.target.checked); trackOptionSelected("addon", `extraDecor:${e.target.checked ? "on" : "off"}`, prix?.extraDecor ?? 0); }} />
                        <span className="option-payante__texte">
                          <b>{tp("optExtraDecor")}</b>
                          <small>{tp("optExtraDecorSub")}</small>
                        </span>
                        <span className="option-payante__prix">+{formatPrix(prix.extraDecor)}</span>
                      </label>
                      {decorSup && (
                        <select
                          className="champ-ligne option-payante__champ"
                          value={indexSup}
                          onChange={(e) => setIndexDecorSup(Number(e.target.value))}
                          aria-label={tp("optExtraDecor")}
                        >
                          {donnees.decors.map((d, i) =>
                            i === decor ? null : (
                              <option key={d.src} value={i}>
                                {libelleDecor(d)}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </>
                  )}

                  <label className="option-payante">
                    <input type="checkbox" checked={express} onChange={(e) => { setExpress(e.target.checked); trackOptionSelected("addon", `express:${e.target.checked ? "on" : "off"}`, prix?.express ?? 0); }} />
                    <span className="option-payante__texte">
                      <b>{tp("optExpress")}</b>
                      <small>{support === "digital" ? tp("optExpressSub") : tp("optExpressSubPrint")}</small>
                    </span>
                    <span className="option-payante__prix">+{formatPrix(prix.express)}</span>
                  </label>

                  {/* Carte de voeux et calendrier 2027 : fichiers a imprimer,
                      envoyes par e-mail avec le portrait. Du 1er octobre au
                      31 janvier seulement (`saisonCartesEtCalendrier`). */}
                  {enSaison && (
                    <div className="options-saison">
                      <p className="options-saison__titre">{tp("optSaisonTitre")}</p>
                      <label className="option-payante">
                        <input type="checkbox" checked={carteVoeux} onChange={(e) => { setCarteVoeux(e.target.checked); trackOptionSelected("addon", `carteVoeux:${e.target.checked ? "on" : "off"}`, prix?.carteVoeux ?? 0); }} />
                        <span className="option-payante__texte">
                          <b>{tp("optCarteVoeux")}</b>
                          <small>{tp("optCarteVoeuxSub")}</small>
                        </span>
                        <span className="option-payante__prix">+{formatPrix(prix.carteVoeux)}</span>
                      </label>
                      <label className="option-payante">
                        <input type="checkbox" checked={calendrier} onChange={(e) => { setCalendrier(e.target.checked); trackOptionSelected("addon", `calendrier:${e.target.checked ? "on" : "off"}`, prix?.calendrier ?? 0); }} />
                        <span className="option-payante__texte">
                          <b>{tp("optCalendrier")}</b>
                          <small>{tp("optCalendrierSub")}</small>
                        </span>
                        <span className="option-payante__prix">+{formatPrix(prix.calendrier)}</span>
                      </label>
                    </div>
                  )}
                </div>
              </Etape>
            )}

            {/* L'etape n'est plus `requis` : on peut payer sans avoir envoye
                de photo, et les deposer ensuite. Voir `ouvrirCaisse`. */}
            <Etape numero titre={tp("uploadStep")} precision={tp("uploadPlusTard")} ref={etapePhotos}>
              {/* Un vrai bouton d'action plutot que « glisse tes photos ici ou
                  bien parcourir » : sur telephone — la majorite des visites —
                  il n'y a rien a glisser, et le seul geste possible etait un
                  lien souligne en fin de phrase. Le glisser-deposer reste
                  actif sur toute la zone, et n'est annonce qu'aux ecrans a
                  souris (.depot-zone__glisser, app/styles/fiche.css). */}
              <div
                className={`depot-zone${survol ? " survol" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSurvol(true);
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSurvol(false);
                  envoyer(Array.from(e.dataTransfer.files));
                }}
              >
                <button
                  type="button"
                  className="bouton bouton--primaire depot-bouton"
                  onClick={() => champFichier.current?.click()}
                  disabled={envoiEnCours || photos.length >= MAX_PHOTOS}
                >
                  {envoiEnCours ? (
                    tp("uploading")
                  ) : (
                    <>
                      <span aria-hidden="true">📷</span>{" "}
                      {photos.length > 0 ? tf("photoBoutonAutre") : tf("photoBouton")}
                    </>
                  )}
                </button>
                <p className="depot-zone__glisser">{tf("photoGlisser")}</p>
              </div>
              {/* Hors du bouton : un champ de saisie imbrique dans un bouton
                  est du HTML invalide, et son clic remontait au parent. */}
              <input
                ref={champFichier}
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => {
                  envoyer(Array.from(e.target.files ?? []));
                  /* Sans remise a zero, choisir de nouveau la meme photo —
                     apres l'avoir retiree, ou apres un echec d'envoi — ne
                     declenchait aucun evenement : il ne se passait rien. */
                  e.target.value = "";
                }}
              />
              {erreurEnvoi && (
                <div className="depot__erreur" role="alert">
                  {erreurEnvoi}
                </div>
              )}
              {/* Rassurance a la place du refus. Le message d'erreur
                  « photo requise » a disparu avec le blocage ; ce qui le
                  remplace explique que rien n'est perdu si on n'envoie rien
                  maintenant — sans cette phrase, payer sans photo donnerait
                  l'impression d'un oubli. */}
              {photos.length === 0 && (
                <p className="depot__note">{tp("uploadApresPaiement")}</p>
              )}
              {photos.length > 0 && (
                <div className="depot-apercus">
                  {photos.map((url, i) => (
                    <div className="depot-apercu" key={url}>
                      {/* Blob Vercel : hors du domaine configure pour l'optimiseur. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={tAlt("photoEnvoyee")} />
                      <button
                        type="button"
                        aria-label="Retirer"
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* La tuile « + » a disparu : le bouton principal devient
                      « Ajouter une autre photo », deux boutons pour le meme
                      geste se concurrencaient. */}
                </div>
              )}
            </Etape>

            {/* Repliee derriere un lien (voir `noteOuverte`). Une fois
                ouverte, le titre reste un vrai <label> : le champ n'avait
                qu'un placeholder, qui disparait a la saisie et n'est pas un
                nom accessible. Ouverte d'office si une note existe deja. */}
            {noteOuverte || note ? (
              <div className="note-artiste">
                <label className="note-artiste__titre" htmlFor="note-artiste">
                  {tp("noteForArtist")} <em>{tp("optional")}</em>
                </label>
                <textarea
                  id="note-artiste"
                  className="champ"
                  value={note}
                  maxLength={400}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={tp("notePlaceholder")}
                />
              </div>
            ) : (
              <button
                type="button"
                className="lien-precision"
                aria-expanded={false}
                onClick={() => {
                  setNoteOuverte(true);
                  // Le champ n'existe qu'au rendu suivant : on attend qu'il soit la.
                  requestAnimationFrame(() => document.getElementById("note-artiste")?.focus());
                }}
              >
                {tf("ajouterPrecision")}
              </button>
            )}

            {/* Chaque element ramene a son etape. Ils etaient de simples
                etiquettes, et les visiteurs cliquaient dessus pour modifier
                leur choix : 11 clics sans effet en 30 jours (releve PostHog du
                6 octobre 2026), dont « 1 Person » chez la cliente du 6. */}
            <div className="recap">
              <button type="button" data-cta="recap_cadrage" onClick={() => allerA("etape-cadrage")}>
                {cadrage === "fullbody" ? tp("fullbody") : tp("portrait")}
              </button>
              <button type="button" data-cta="recap_personnes" onClick={() => allerA("etape-qui")}>
                {personnes} {personnes > 1 ? tp("peoplePlural") : tp("peopleSingular")}
              </button>
              {animaux > 0 && (
                <button type="button" data-cta="recap_animaux" onClick={() => allerA("etape-qui")}>
                  {animaux} {animaux > 1 ? tp("animalsPlural") : tp("animalsSingular")}
                </button>
              )}
              {aDesDecors && (
                <button type="button" data-cta="recap_decor" onClick={() => allerA("etape-decor")}>
                  {libelleDecor(donnees.decors[decor])}
                </button>
              )}
              <button type="button" data-cta="recap_support" onClick={() => allerA("etape-support")}>
                {supportChoisi?.libelle}
              </button>
            </div>

            <div className="total">
              <span className="total__prix">{prix ? formatPrix(total) : "—"}</span>
              {port > 0 && <small className="total__port">{tp("shippingLine", { montant: formatPrix(port) })}</small>}
            </div>

            {/* La garantie dit ce qui se passe vraiment : seul l'imprime passe
                par une validation avant tirage. Le numerique part directement,
                et se reprend par retouches.
                Placee AU-DESSUS du bouton depuis le 6 octobre 2026 : « Et si ça
                ne ressemble pas ? » est la premiere question ouverte par les
                deux clientes de la semaine, juste avant de commander. */}
            <div className="garantie garantie--avant">
              <IconesTuile nom="bouclier" />
              <span>
                {support === "digital" ? t("garantieNumerique") : t("garantieImprime")}{" "}
                <Link href={lien("/garantie")} className="garantie__lien">
                  {tGarantie("lienPied")}
                </Link>
              </span>
            </div>

            <button
              ref={boutonAchat}
              type="button"
              className="bouton bouton--primaire ajouter"
              onClick={() => ouvrirCaisse("principal")}
              disabled={!prix}
            >
              {tp("addToCart")}
            </button>
            {/* Les cadeaux offerts : generes a partir du portrait final, sur la
                page /bonus liee depuis l'e-mail de livraison. */}
            <p className="offerts">🎁 {t("offerts")}</p>

            {/* Les trois questions qui arretent un acheteur au moment de
                payer, posees la ou il hesite — sous le bouton — plutot qu'en
                FAQ a 5000 px plus bas. Repliees : elles ne rallongent la page
                que pour qui les ouvre. Les reponses suivent les CGV (articles
                6, 7 et 9) : retouches illimitees, remboursement si toujours
                pas convaincu — avant validation de l'apercu pour un imprime —
                et delai compte a partir de la reception des photos. */}
            <div className="questions-achat">
              <details>
                <summary>{tf("qRessembleQ")}</summary>
                <p>{tf("qRessembleR")}</p>
              </details>
              <details>
                <summary>{tf("qPhotosQ")}</summary>
                <p>
                  {tf("qPhotosR", { max: MAX_PHOTOS })}{" "}
                  <Link href={lien("/quelle-photo")}>{tf("qPhotosLien")}</Link>
                </p>
              </details>
              <details>
                <summary>{tf("qPlusTardQ")}</summary>
                <p>{tf("qPlusTardR")}</p>
              </details>
              {/* Le contact etait un bloc a part, toujours ouvert : il devient
                  la quatrieme question, au meme endroit et plus court. */}
              <details>
                <summary>{t("contactTitre")}</summary>
                <p>
                  <a href="mailto:support@cartoonova.com">support@cartoonova.com</a> · {t("contactHoraires")}
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* La section « Trois étapes, c'est tout » vivait ici. Retirée du site :
            l'accueil porte déjà un « Comment ça marche » illustré et détaillé
            (section .hiw), dont celle-ci n'était qu'un résumé en trois cartes. */}

        {/* ---------- AVIS ----------
             Masquée sans photo client : un avis illustré par un substitut
             générique ferait plus de tort que son absence. */}
        {nbAvis > 0 && (
        <section className="section" id="avis" style={{ background: "var(--creme)" }}>
          <div className="enveloppe">
            <div className="chapeau" style={{ marginBottom: 34 }}>
              <h2>
                {t("avisTitre")} <span className="accent">{t("avisAccent")}</span>
              </h2>
            </div>
            {/* Le rail etait cale sur quatre cartes en dur : une fiche qui n'a
                que trois photos client — la carte Pokemon, par exemple — les
                posait a gauche et laissait un quart de la largeur en blanc.
                Le nombre reel pilote la largeur des cartes. */}
            <div className="avis-rail" style={{ "--cartes": nbAvis } as React.CSSProperties}>
              {Array.from({ length: nbAvis }, (_, i) => i + 1).map((n, i) => (
                <article className="avis-carte" key={n}>
                  <Image
                    src={portraitsClients[i]}
                    alt={tAlt("realisationClient")}
                    width={1000}
                    height={750}
                    sizes="24vw"
                  />
                  <div className="avis-bulle">
                    <div className="svg-stars">
                      <Etoiles />
                    </div>
                    <h3>{tProduit(`review${n}Name` as "review1Name")}</h3>
                    <p>{tProduit(`review${n}Text` as "review1Text")}</p>
                    <p className="avis-signe">
                      {tProduit(`review${n}Name` as "review1Name")} <BadgeVerifie />
                      <span className="verifie">{t("achatVerifie")}</span>
                    </p>
                  </div>
                  <div className="avis-queue">
                    <BulleQueue />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* Les sections « Comparatif » et « Atouts » vivaient ici. Retirees
            de la fiche le 1er octobre 2026 : elles repetaient l'accueil, qui
            les garde, et ajoutaient plusieurs ecrans entre le bouton
            d'achat et la FAQ sur une page mesuree a 17 ecrans sur mobile. */}

        {/* ---------- FAQ ---------- */}
        {/* ---------- CONTENU PROPRE A L'UNIVERS ----------
             Le seul bloc de la fiche qui ne soit pas partage avec les
             trente-cinq autres. C'est lui qui fait passer la part de texte
             unique de 2 % a la majorite de la page — et donc lui qui decide
             si Google indexe la fiche ou la classe en doublon.
             Absent tant qu'il n'est pas redige : la fiche reste exactement
             celle d'avant. */}
        {donnees.contenu && (donnees.contenu.intro || donnees.contenu.sections.length > 0) && (
          <section className="section" id="a-propos">
            <div className="enveloppe fiche-contenu">
              {donnees.contenu.intro && (
                <p className="fiche-contenu__intro">{donnees.contenu.intro}</p>
              )}
              {/* Chaque partie est repliee : c'etait le plus long bloc de la
                  page (plusieurs ecrans sur mobile). Le texte reste dans la
                  page, ouvert ou non — c'est lui qui la distingue des autres
                  fiches aux yeux de Google. */}
              <div className="questions-achat fiche-contenu__plis">
                {donnees.contenu.sections.map((bloc, i) => (
                  <details key={i} className="fiche-contenu__bloc">
                    <summary>
                      <h2>{bloc.titre}</h2>
                    </summary>
                    {/* Une ligne vide separe deux paragraphes. Le texte reste du
                        texte : aucun HTML n'est injecte depuis la base. */}
                    {bloc.corps.split(/\n\s*\n/).map((para, j) => (
                      <p key={j}>{para.trim()}</p>
                    ))}
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="section" id="faq">
          <div className="enveloppe faq-illus">
            <div className="faq-visuel">
              <Image src="/toonjaune/faq-photo.webp" alt={tAlt("exempleFaq")} width={1000} height={1000} sizes="(max-width: 1000px) 80vw, 38vw" />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--t-section)", marginBottom: 12 }}>
                {t("faqTitre")} <span className="accent">{t("faqAccent")}</span>
              </h2>
              {/* La FAQ propre a l'univers prend la main sur la FAQ partagee.
                  Les cinq questions generiques etaient identiques sur les
                  trente-six fiches : elles rassuraient le visiteur mais ne
                  distinguaient aucune page d'une autre. */}
              <div className="faq">
                {donnees.contenu?.faq?.length
                  ? donnees.contenu.faq.map((q, i) => (
                      <details key={i} name="faq">
                        <summary>{q.question}</summary>
                        <p>{q.reponse}</p>
                      </details>
                    ))
                  : [1, 2, 3, 4, 5].map((n) => (
                      <details key={n} name="faq">
                        <summary>{tProduit(`faqQ${n}` as "faqQ1")}</summary>
                        <p>{tProduit(`faqA${n}` as "faqA1")}</p>
                      </details>
                    ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- SIMILAIRES ---------- */}
        {donnees.similaires.length > 0 && (
          <section className="section similaires" id="similaires" style={{ background: "var(--cendre)" }}>
            <div className="enveloppe">
              <div className="chapeau">
                <h2>
                  {t("similairesTitre")} <span className="accent">{t("similairesAccent")}</span>
                </h2>
              </div>
              <div className="styles-grille">
                {donnees.similaires.map((s) => (
                  <Link className="carte" href={lien(`/${s.slug}`)} key={s.slug}>
                    {s.visuel ? (
                      <Image
                        className="carte__image"
                        src={s.visuel}
                        alt={s.univers}
                        width={800}
                        height={800}
                        sizes="(max-width: 520px) 92vw, 24vw"
                      />
                    ) : (
                      <div className="carte__image substitut">
                        <span>{s.univers}</span>
                      </div>
                    )}
                    <div className="carte__corps">
                      <h3>{s.univers}</h3>
                      <div className="carte__prix">
                        {prix ? formatPrix(prix.base) : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {/* Sur mobile, les fiches defilent en rail (voir fiche.css) ; la suite
                  est dans le catalogue. */}
              <p className="similaires__tous">
                <Link className="bouton bouton--contour" href={lien("/collections")}>
                  {t("stylesTous")}
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* La banniere finale « Pret a ... ? » vivait ici. Retiree le 2 octobre
            2026 : la barre d'achat collante porte deja le prix et le bouton sur
            toute la page, et la banniere ajoutait un ecran en bas de fiche. */}
      </div>

      {/* ---------- BARRE D'ACHAT COLLANTE ----------
          Le prix et le bouton se trouvaient tout en bas d'un configurateur de
          sept etapes, puis plus rien sur les 5000px de sections suivantes.
          Cette barre reprend le total courant et l'action, des que le bouton
          reel a quitte l'ecran vers le haut. */}
      <div className={`barre-achat${boutonHorsEcran ? " barre-achat--visible" : ""}`} aria-hidden={!boutonHorsEcran}>
        <div className="barre-achat__contenu">
          <div className="barre-achat__infos">
            <span className="barre-achat__titre">{donnees.titre}</span>
            <span className="barre-achat__recap">{descriptionCommande}</span>
          </div>
          <span className="barre-achat__prix">{prix ? formatPrix(total) : "—"}</span>
          <button
            type="button"
            className="bouton bouton--primaire barre-achat__bouton"
            onClick={() => ouvrirCaisse("barre_collante")}
            disabled={!prix}
            tabIndex={boutonHorsEcran ? 0 : -1}
          >
            {tp("addToCart")}
          </button>
        </div>
      </div>

      {prix && (
        <CheckoutModal
          open={caisseOuverte}
          orderConfig={{
            format: cadrage,
            people: personnes,
            animals: animaux,
            background: aDesDecors ? donnees.decors[decor].cle : "default",
            printOption: supportChoisi?.libelle ?? "digital",
            printKey: support,
            banner: banderole,
            extraDecor: decorSupChoisi,
            extraDecorKey: decorSupChoisi ? donnees.decors[indexSup].cle : null,
            express,
            carteVoeux: carteVoeuxChoisie,
            calendrier: calendrierChoisi,
            shipping: port,
            total,
            description: descriptionCommande + (noteComplete ? ` | ${noteComplete}` : ""),
            photoUrls: photos,
            style: donnees.slug,
          }}
          onClose={() => setCaisseOuverte(false)}
          /* Case « ajoute le poster » de la caisse : elle change le support ici,
             et tout le reste suit (total, champs d'adresse, paiement). */
          supplementPoster={prix.posterSimple}
          onChangerSupport={setSupport}
        />
      )}
    </>
  );
}

/* Etape du configurateur. Le numero n'est pas passe en propriete : le systeme
   renumerote les etapes visibles en CSS-compteur, exactement comme le script
   du gabarit d'origine — un produit sans decor affiche 1,2,3,4 et non 1,2,4,5. */
/* `requis` a disparu avec la derniere etape obligatoire. L'envoi de photos
   etait la seule a le porter ; depuis qu'on peut payer sans, plus aucune ne
   l'est, et une astérisque qui ne s'affiche jamais est du code mort. */
function Etape({
  titre,
  precision,
  pour,
  ref,
  ancre,
  children,
}: {
  numero?: boolean;
  /** id de l'etape : le recapitulatif y ramene au clic. */
  ancre?: string;
  titre: string;
  precision?: string;
  /** id du champ que ce titre nomme : le titre devient alors un vrai <label>. */
  pour?: string;
  ref?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const contenu = (
    <>
      <b />
      {titre}
      {precision && <em>{precision}</em>}
    </>
  );
  return (
    <div className="etape-conf" ref={ref} id={ancre}>
      {pour ? (
        <label className="etape-conf__titre" htmlFor={pour}>
          {contenu}
        </label>
      ) : (
        <div className="etape-conf__titre">{contenu}</div>
      )}
      {children}
    </div>
  );
}

function IconesTuile({ nom }: { nom: "main" | "reglages" | "coche" | "camion" | "bouclier" }) {
  const commun = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (nom === "main")
    return (
      <svg {...commun}>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    );
  if (nom === "reglages")
    return (
      <svg {...commun}>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    );
  if (nom === "coche")
    return (
      <svg {...commun}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  if (nom === "camion")
    return (
      <svg {...commun} strokeWidth={2}>
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  return (
    <svg {...commun} strokeWidth={2}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
