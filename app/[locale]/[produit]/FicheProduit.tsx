"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
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
import Etoiles from "@/components/tj/Etoiles";
import BadgeVerifie from "@/components/tj/BadgeVerifie";
import BulleQueue from "@/components/tj/BulleQueue";
import Comparatif from "@/components/tj/Comparatif";
import IconesCta from "@/components/tj/IconesCta";
import IconesAtouts from "@/components/tj/IconesAtouts";
import { useLien } from "@/components/useLien";
import { useCurrency } from "@/components/CurrencyProvider";
import { useProductTracking } from "@/hooks/useProductTracking";
import type { PrintKey } from "@/lib/pricing";
import type { Prices } from "@/lib/types";
import type { Decor, LegendeVisuel } from "@/lib/visuels";

/* Plafond partage avec la validation serveur : deux constantes qui divergent
   donneraient un formulaire qui accepte ce que le serveur refuse. */
import { MAX_PHOTOS } from "@/lib/orderPhotos";

/* Prix barré : -40 % affiché comme remise, donc le prix barré vaut le prix
   actuel divise par 0.6. Recalcule automatiquement des que le prix change
   (options, devise) puisqu'il derive toujours du total courant. */
const PART_PRIX_REMISE = 0.6;
function prixBarreDe(montantActuel: number): number {
  return montantActuel / PART_PRIX_REMISE;
}

/* Format compact de la dimension pour la vignette de support ("Poster •
   30x40cm") : derive de la traduction complete ("30×40 cm · papier mat")
   pour rester en phase avec elle sans dupliquer la donnee. */
function tailleCourte(sous: string): string {
  return sous.split(" · ")[0].replace("×", "x").replace(" cm", "cm");
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
  galerie: string[];
  legendes: (LegendeVisuel | null)[];
  decors: Decor[];
  supports: Record<PrintKey, string>;
  similaires: Similaire[];
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
  const tProduit = useTranslations("product");
  const tDecor = useTranslations("product");
  const tDbz = useTranslations("dbz");
  const tAlt = useTranslations("alt");
  const lien = useLien();
  const { formatRaw: formatPrix, currency } = useCurrency();
  const {
    trackOptionSelected,
    trackGalleryBrowsed,
    trackPhotoUploadStarted,
    trackPhotoUploaded,
    trackPhotoUploadFailed,
    trackPurchaseBlocked,
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
  const [prix, setPrix] = useState<Prices | null>(null);
  const [caisseOuverte, setCaisseOuverte] = useState(false);

  const champFichier = useRef<HTMLInputElement>(null);
  const boutonAchat = useRef<HTMLButtonElement>(null);
  const etapePhotos = useRef<HTMLDivElement>(null);
  const [boutonHorsEcran, setBoutonHorsEcran] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState(false);

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

  const supports: { cle: PrintKey; libelle: string; sous: string; supplement: number }[] = prix
    ? [
        { cle: "digital", libelle: tp("digital"), sous: tp("digitalSub"), supplement: prix.digital },
        { cle: "posterSimple", libelle: tp("posterOption"), sous: tp("posterSimpleSub"), supplement: prix.posterSimple },
        { cle: "canvas", libelle: tp("canvas"), sous: tp("canvasSub"), supplement: prix.canvas },
        { cle: "framed", libelle: tp("poster"), sous: tp("framedSub"), supplement: prix.poster },
      ]
    : [];

  const supportChoisi = supports.find((s) => s.cle === support);

  const total = prix
    ? prix.base +
      (cadrage === "fullbody" ? prix.fullbodyExtra : 0) +
      (personnes - 1) * prix.extraPerson +
      animaux * prix.extraAnimal +
      (supportChoisi?.supplement ?? 0)
    : 0;

  const envoyer = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEnvoiEnCours(true);
    setErreurEnvoi("");

    /* Le depot est l'etape la plus fragile du tunnel : elle depend du reseau
       du client et de photos qui pesent souvent plusieurs megaoctets. On la
       mesure des le debut et on chronometre, faute de quoi un echec ne se
       distingue pas d'un visiteur qui a renonce. */
    const aEnvoyer = Array.from(fichiers).slice(0, MAX_PHOTOS);
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
      setErreurPhoto(false);
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
  ]
    .filter(Boolean)
    .join(" · ");

  /* Une commande sans photo est impossible a honorer : l'illustrateur n'a rien
     a dessiner. On bloquait nulle part — ni ici, ni cote serveur — et le
     client atteignait le formulaire de carte bancaire. On l'arrete ici, en le
     ramenant a l'etape d'envoi plutot qu'en lui opposant un simple refus. */
  const ouvrirCaisse = (emplacement: "principal" | "barre_collante" = "principal") => {
    trackBuyClicked(emplacement, total, currency);

    if (photos.length === 0) {
      /* Ce refus est invisible dans les chiffres actuels : le visiteur a
         clique sur « commander », donc il voulait acheter, et pourtant aucun
         evenement de caisse ne part. Il ressemble a un abandon spontane alors
         que c'est le formulaire qui l'arrete. */
      trackPurchaseBlocked(emplacement);
      setErreurPhoto(true);
      etapePhotos.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      champFichier.current?.focus();
      return;
    }
    setErreurPhoto(false);
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
            {visuelPrincipal ? (
              <Image
                className="galerie__vue"
                src={visuelPrincipal}
                alt={donnees.titre}
                width={1000}
                height={1000}
                priority
                sizes="(max-width: 860px) 92vw, 46vw"
              />
            ) : (
              <div className="galerie__vue substitut">
                <span>{donnees.univers}</span>
                <small>{donnees.categorieNom}</small>
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
                    onClick={() => {
                      setVue(i);
                      trackGalleryBrowsed(i, "vignette");
                    }}
                  >
                    <Image src={src} alt="" width={74} height={74} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---------- TUILES ---------- */}
          <div className="tuiles">
            <div className="tuile">
              <IconesTuile nom="main" />
              <b>{tp("handDrawn")}</b>
            </div>
            <div className="tuile">
              <IconesTuile nom="reglages" />
              <b>{t("tuilePerso")}</b>
            </div>
            <div className="tuile">
              <IconesTuile nom="coche" />
              <b>{t("tuileRetouches")}</b>
            </div>
            <div className="tuile tuile--fort">
              <b>48H</b>
              <b style={{ fontFamily: "var(--texte)", fontSize: "12.5px", color: "#fff" }}>
                {t("tuileApercu")}
              </b>
            </div>
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
              {prix && <span className="panneau__prixBarre">{formatPrix(prixBarreDe(total))}</span>}
              <span>{tp("totalLabel")}</span>
            </div>

            <p className="panneau__accroche">{donnees.description}</p>

            <div className="livraison">
              <IconesTuile nom="camion" />
              <GiftDeadlineNote variante="ligne" />
            </div>

            <Etape
              numero
              titre={t("etapePersonnages")}
              precision={`: ${personnes} ${personnes > 1 ? tp("peoplePlural") : tp("peopleSingular")}`}
            >
              <div className="pastilles" role="group" aria-label={t("etapePersonnages")}>
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
            </Etape>

            <Etape
              numero
              titre={tp("animalsLabel")}
              precision={`: ${animaux} ${animaux > 1 ? tp("animalsPlural") : tp("animalsSingular")}`}
            >
              <div className="pastilles" role="group" aria-label={tp("animalsLabel")}>
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
              <Etape numero titre={tp("decorStep")} precision={`: ${libelleDecor(donnees.decors[decor])}`}>
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

            <Etape
              numero
              titre={tp("printSupportStep")}
              precision={
                supportChoisi
                  ? `: ${supportChoisi.libelle}${
                      supportChoisi.cle !== "digital" ? ` • ${tailleCourte(supportChoisi.sous)}` : ""
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
                    <span className="vignette__prix">
                      {s.supplement === 0 ? tp("included") : `+${formatPrix(s.supplement)}`}
                    </span>
                  </button>
                ))}
              </div>
            </Etape>

            <Etape numero titre={tp("uploadStep")} precision={tp("uploadMax8")} ref={etapePhotos} requis>
              {/* Etait un <div onClick> : l'envoi de photo, etape obligatoire
                  pour commander, etait donc impossible au clavier. En <button>,
                  le glisser-deposer continue de fonctionner a l'identique. */}
              <button
                type="button"
                className={`depot${survol ? " survol" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSurvol(true);
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSurvol(false);
                  envoyer(e.dataTransfer.files);
                }}
                onClick={() => champFichier.current?.click()}
              >
                {envoiEnCours ? (
                  tp("uploading")
                ) : (
                  <>
                    {tp("dragHere")} {tp("orWord")} <b>{t("depotParcourir")}</b>
                  </>
                )}
              </button>
              {/* Hors du bouton : un champ de saisie imbrique dans un bouton
                  est du HTML invalide, et son clic remontait au parent. */}
              <input
                ref={champFichier}
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => envoyer(e.target.files)}
              />
              {erreurEnvoi && (
                <div className="depot__erreur" role="alert">
                  {erreurEnvoi}
                </div>
              )}
              {erreurPhoto && (
                <div className="depot__erreur" role="alert">
                  {tp("photoRequired")}
                </div>
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
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      className="depot-ajout"
                      onClick={() => champFichier.current?.click()}
                    >
                      +
                    </button>
                  )}
                </div>
              )}
            </Etape>

            {/* Le titre d'etape devient un vrai <label> : le champ n'avait
                qu'un placeholder, qui disparait a la saisie et n'est pas un
                nom accessible. */}
            <Etape numero titre={tp("noteForArtist")} precision={tp("optional")} pour="note-artiste">
              <textarea
                id="note-artiste"
                className="champ"
                value={note}
                maxLength={400}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tp("notePlaceholder")}
              />
            </Etape>

            <div className="recap">
              <span>{cadrage === "fullbody" ? tp("fullbody") : tp("portrait")}</span>
              <span>
                {personnes} {personnes > 1 ? tp("peoplePlural") : tp("peopleSingular")}
              </span>
              {animaux > 0 && (
                <span>
                  {animaux} {animaux > 1 ? tp("animalsPlural") : tp("animalsSingular")}
                </span>
              )}
              {aDesDecors && <span>{libelleDecor(donnees.decors[decor])}</span>}
              <span>{supportChoisi?.libelle}</span>
            </div>

            <div className="total">
              <span className="total__prix">{prix ? formatPrix(total) : "—"}</span>
              {prix && <span className="total__barre">{formatPrix(prixBarreDe(total))}</span>}
              {prix && <span className="total__gain">{tp("economie")} {formatPrix(prixBarreDe(total) - total)}</span>}
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

            <div className="garantie">
              <IconesTuile nom="bouclier" />
              {t("garantieTexte")}
            </div>

            <div className="contact">
              <p>{t("contactTitre")}</p>
              <p>
                <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
              </p>
              <p style={{ fontSize: 13 }}>{t("contactHoraires")}</p>
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

        {/* ---------- COMPARATIF ---------- */}
        <section className="section" style={{ background: "var(--cendre)" }}>
          <div className="enveloppe">
            <div className="chapeau">
              <h2>
                {t("comparatifTitre")} <span className="accent">{t("comparatifAccent")}</span>
              </h2>
            </div>
            <Comparatif />
          </div>
        </section>

        {/* ---------- ATOUTS ---------- */}
        <section className="section atouts-sec">
          <div className="enveloppe">
            <div className="chapeau">
              <span className="surtitre">{t("atoutsSurtitre")}</span>
              <h2>
                {t("atoutsTitre")}{" "}
                <span className="accent" style={{ color: "var(--encre)" }}>
                  {t("atoutsAccent")}
                </span>
              </h2>
              <p>{t("atoutsSous")}</p>
            </div>
            <div className="atouts-grille">
              {[1, 2, 3, 4].map((n) => (
                <article className="atout-carte" key={n}>
                  <div className="atout-carte__num">{`0${n}`}</div>
                  <IconesAtouts index={n} />
                  <h3>{t(`atout${n}T` as "atout1T")}</h3>
                  <p>{t(`atout${n}D` as "atout1D")}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="section" id="faq">
          <div className="enveloppe faq-illus">
            <div className="faq-visuel">
              <Image src="/toonjaune/faq-photo.webp" alt={tAlt("exempleFaq")} width={1000} height={1000} sizes="(max-width: 1000px) 80vw, 38vw" />
            </div>
            <div>
              <h2 style={{ fontSize: "var(--t-section)", marginBottom: 12 }}>
                {t("faqTitre")} <span className="accent">{t("faqAccent")}</span>
              </h2>
              <div className="faq">
                {[1, 2, 3, 4, 5].map((n) => (
                  <details key={n} name="faq" open={n === 1}>
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
          <section className="section" id="similaires" style={{ background: "var(--cendre)" }}>
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
            </div>
          </section>
        )}

        {/* ---------- BANNIÈRE FINALE ---------- */}
        <section className="section" style={{ paddingBlock: "clamp(34px, 4vw, 60px)" }}>
          <div className="enveloppe">
            <div className="cta-fin">
              <div className="cta-fin__texte">
                <h2>
                  {t("ctaTitre")} <span className="accent">{t("ctaAccent")}</span> ?
                </h2>
                <p>{t("ctaTexte")}</p>
                {/* Pointait sur #etapes, c'est-a-dire la section explicative
                    « Trois etapes, c'est tout » : le dernier appel a l'action
                    de la page renvoyait vers un texte, pas vers l'achat. */}
                <a className="cta-fin__bouton" href="#configurateur">
                  {tp("createMyPortrait")}
                  <IconesCta.Fleche />
                </a>
                <div className="cta-fin__atouts">
                  <div>
                    <span>
                      <IconesCta.Chrono />
                    </span>{" "}
                    {t("ctaAtout1")}
                  </div>
                  <div>
                    <span>
                      <IconesCta.Crayon />
                    </span>{" "}
                    {t("ctaAtout2")}
                  </div>
                  <div>
                    <span>
                      <IconesCta.Photo />
                    </span>{" "}
                    {t("ctaAtout3")}
                  </div>
                </div>
              </div>
              <div className="cta-fin__visuel" aria-hidden="true" />
            </div>
          </div>
        </section>
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
            total,
            description: descriptionCommande + (note ? ` | ${note}` : ""),
            photoUrls: photos,
            style: donnees.slug,
          }}
          onClose={() => setCaisseOuverte(false)}
        />
      )}
    </>
  );
}

/* Etape du configurateur. Le numero n'est pas passe en propriete : le systeme
   renumerote les etapes visibles en CSS-compteur, exactement comme le script
   du gabarit d'origine — un produit sans decor affiche 1,2,3,4 et non 1,2,4,5. */
function Etape({
  titre,
  precision,
  pour,
  requis,
  ref,
  children,
}: {
  numero?: boolean;
  titre: string;
  precision?: string;
  /** id du champ que ce titre nomme : le titre devient alors un vrai <label>. */
  pour?: string;
  /** Marque l'etape comme obligatoire — une seule l'est : l'envoi de photos. */
  requis?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const contenu = (
    <>
      <b />
      {titre}
      {requis && <i className="etape-conf__requis" aria-hidden="true">*</i>}
      {precision && <em>{precision}</em>}
    </>
  );
  return (
    <div className="etape-conf" ref={ref}>
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
