/**
 * Le catalogue des evenements mesures.
 *
 * Nomme `MESURES` et non `EVENEMENTS` : `lib/evenements.ts` — le calendrier
 * commercial — porte deja une constante de ce nom. Deux `EVENEMENTS` dans deux
 * fichiers aux noms voisins finissent par etre importes l'un pour l'autre.
 *
 * Un seul endroit, pour deux raisons.
 *
 * La premiere est mecanique : `mesure()` n'accepte que ces noms-la. Une faute
 * de frappe ne cree plus un evenement jumeau qui vit sa vie a cote du vrai,
 * n'apparait dans aucun entonnoir, et ne se remarque qu'au moment ou l'on
 * cherche pourquoi les chiffres ne tombent pas juste.
 *
 * La seconde est humaine : sans liste, personne ne sait ce qui est deja
 * mesure. Le site en etait la — quatorze evenements repartis dans six
 * fichiers, dont deux jamais emis, et aucun moyen de le savoir sans lire tout
 * le code.
 *
 * Les noms sont en anglais parce que les premiers l'etaient : les renommer
 * aurait coupe l'historique deja accumule dans PostHog en deux, et un
 * entonnoir ne sait pas recoller les deux moities.
 */

export const MESURES = {
  /* ═══ navigation ══════════════════════════════════════════════════════
     Les vues de page sont envoyees par `PostHogProvider`. `$pageleave` est
     pose par la bibliotheque : c'est lui qui donne le temps passe. */
  vueDePage: "$pageview",

  /** Clic vers une fiche, de n'importe ou (accueil, catalogue, menu, fiches
      similaires, portfolio, blog, pages cadeau). Le catalogue et le blog
      l'emettent eux-memes avec plus de details ; partout ailleurs, l'ecouteur
      global de `SuiviGlobal` le fait, avec `source` = la page d'origine. */
  produitClique: "product_clicked",
  /** Filtre ou tri applique sur le catalogue. */
  catalogueFiltre: "catalogue_filtered",
  /** Changement de langue depuis le selecteur. */
  langueChangee: "locale_changed",
  /** Changement de devise depuis le selecteur. */
  deviseChangee: "currency_changed",

  /* ═══ fiche produit ═══════════════════════════════════════════════════ */

  /** Arrivee sur une fiche. Porte le prix : sans lui, aucun entonnoir ne peut
      etre pondere par la valeur. */
  produitVu: "product_viewed",
  /** Une option du configurateur change — cadrage, personnes, animaux, decor,
      support. C'est la trace de l'hesitation, et le meilleur predicteur
      d'abandon dont dispose ce site. */
  optionChoisie: "option_selected",
  /** Navigation dans la galerie de visuels. */
  galerieParcourue: "gallery_browsed",
  /**
   * Visuel agrandi au clic.
   *
   * Le releve des clics morts a montre que les gens cliquaient les photos de
   * la galerie en attendant un agrandissement, et que rien ne se passait.
   * L'evenement dit si, une fois pose, le geste sert vraiment.
   */
  visuelAgrandi: "gallery_zoomed",
  /** Depot de photos commence — mesure avant l'envoi, pour tenir le
      denominateur du taux d'echec. */
  envoiPhotoDemarre: "photo_upload_started",
  /** Depot reussi. */
  photoEnvoyee: "photo_uploaded",
  /** Depot echoue. */
  envoiPhotoEchoue: "photo_upload_failed",
  /**
   * Page de depot ouverte. `photosDeposees` disait combien de clients
   * envoyaient leurs photos, jamais combien avaient ouvert la page — donc
   * jamais le taux. Sur une etape qui vit d'un lien dans un e-mail, c'est le
   * denominateur qui dit si le lien fonctionne.
   */
  depotOuvert: "photo_deposit_opened",
  /** Photos deposees APRES paiement, par le lien signe.
      Mesure serveur : c'est elle qui dira quelle part des clients revient
      deposer, et au bout de combien de temps — donc si la relance a J+1 est
      trop tot, trop tard, ou inutile.
      DOUBLE COMPTE VOULU : aussi emis par la page de depot cote navigateur
      (`source: "page_depot"`). Pour compter les depots, filtrer sur
      `$lib = posthog-node` (serveur, toujours present) ; la version
      navigateur ne sert qu'a relier le depot a la session. */
  photosDeposees: "photos_submitted",
  /** Clic sur le bouton d'achat. `emplacement` distingue le bouton principal
      de la barre collante : les 5 000 px de sections qui suivent la fiche
      n'ont d'interet que si cette barre convertit. */
  achatClique: "buy_clicked",

  /* ═══ tunnel de commande ══════════════════════════════════════════════ */

  /** Ouverture de la caisse depuis la fiche, avec la configuration retenue. */
  caisseDemarree: "checkout_started",
  /** La modale s'affiche. */
  caisseOuverte: "checkout_modal_opened",
  /** Un champ du formulaire est refuse. Porte le nom du champ : c'est la
      mesure qui dit quel champ fait perdre des commandes. */
  champInvalide: "checkout_field_invalid",
  /** Adresse choisie dans les suggestions de la caisse : dit si elles servent. */
  adresseSuggeree: "checkout_address_suggested",
  /** Coordonnees validees, passage a l'etape de paiement. */
  coordonneesValidees: "checkout_info_completed",
  /** Option cadeau activee ou desactivee. */
  cadeauBascule: "gift_toggled",
  /** Case « ajoute le poster » de la caisse, cochee ou decochee. Elle dira si
      la vente additionnelle prend, et a quel prix. */
  posterAjouteCaisse: "checkout_poster_added",
  /** Bon cadeau paye. Emis cote serveur a la creation du code. */
  bonCadeauAchete: "gift_card_purchased",
  /** Code promo accepte. */
  promoAccepte: "promo_code_applied",
  /** Code promo refuse, avec le motif. */
  promoRefuse: "promo_code_rejected",
  /** Paiement lance — carte ou portefeuille. */
  paiementLance: "payment_initiated",
  /** Paiement refuse par Stripe.
      DOUBLE COMPTE VOULU : emis par la caisse (navigateur, avec `method`) et
      par le webhook Stripe (serveur, avec le code de refus de la banque). Le
      second voit aussi les refus apres redirection 3-D Secure ; pour un
      total, filtrer sur `$lib = posthog-node`. */
  paiementEchoue: "payment_error",
  /** Fermeture de la caisse sans avoir paye, avec l'etape atteinte. C'est le
      seul evenement qui distingue « parti a l'etape adresse » de « parti
      devant le formulaire de carte » — deux problemes sans rapport. */
  caisseAbandonnee: "checkout_abandoned",

  /* ═══ apres l'achat ═══════════════════════════════════════════════════ */

  /** Commande enregistree en PENDING, avant la confirmation du paiement.
      Emis cote serveur. */
  commandeCreee: "order_created",
  /** Achat confirme. Emis UNIQUEMENT cote serveur, au passage en PAID
      (`lib/finaliserCommande.ts`). La page de succes ne l'envoie pas : une
      seule source, donc pas de double compte a dedoublonner. */
  achatConfirme: "purchase_completed",
  /** Remboursement, total ou partiel. Emis par le webhook Stripe.
      Sans lui le chiffre d'affaires mesure reste brut a vie : un portrait
      rembourse continue de compter comme une vente. */
  remboursement: "payment_refunded",
  /** Contestation bancaire. Emis par le webhook Stripe, double d'une alerte
      Discord : le delai de reponse est court et se rate en silence. */
  contestation: "payment_disputed",
  /** Ouverture de la page de suivi depuis l'e-mail. */
  suiviConsulte: "order_tracked",
  /** Reponse a la demande de confirmation avant impression. */
  posterConfirme: "poster_confirmed",
  /** Un ami a paye avec un code AMI- : le parrain vient de recevoir son bon.
      Emis cote serveur (lib/parrainage.ts). Rapporte au nombre de codes
      montres, c'est la seule mesure qui dira si le parrainage vit. */
  parrainageRecompense: "referral_reward_issued",

  /* ═══ engagement ══════════════════════════════════════════════════════ */

  /**
   * E-mail de cycle de vie parti. La campagne voyage en propriete plutot qu'en
   * evenement distinct : six evenements jumeaux se compareraient mal, alors
   * qu'une seule propriete se decoupe dans n'importe quel rapport.
   *
   * Sans lui, on connaissait les clics — depuis que les liens portent des
   * parametres de campagne — mais jamais le denominateur. Un taux d'ouverture
   * sans envois n'est pas un taux.
   */
  emailEnvoye: "email_sent",

  inscriptionNewsletter: "newsletter_subscribed",
  desinscriptionNewsletter: "newsletter_unsubscribed",
  relanceSortieAffichee: "exit_intent_shown",
  relanceSortieFermee: "exit_intent_dismissed",
  /** Inscription obtenue depuis la relance de sortie. Sans cet evenement, la
      pop-in ne peut pas etre jugee : on ne connait que son cout d'affichage. */
  relanceSortieConvertie: "exit_intent_converted",

  bulleAideOuverte: "chat_opened",
  sujetAideChoisi: "chat_topic_selected",
  messageAideEnvoye: "chat_message_sent",

  avisSoumis: "review_submitted",
  formulaireContactEnvoye: "contact_submitted",
  /** Article de blog lu jusqu'au bout — mesure au defilement. */
  articleLu: "article_read",

  /* ═══ ajouts d'octobre 2026 : tout ce qui manquait avant la pub ═══════ */

  /** Arrivee depuis une publicite : identifiant de clic (`oppref` ChatGPT,
      `gclid` Google, `fbclid` Meta) ou `utm_medium` payant. Une fois par
      session. C'est le denominateur de chaque campagne. */
  arriveePub: "ad_landing",
  /** Bouton ou lien d'appel a l'action clique (classe `bouton`, ou attribut
      `data-cta`). Ecouteur global : couvre aussi les pages rendues cote
      serveur. Porte le libelle, la cible, la page et la zone. */
  ctaClique: "cta_clicked",
  /** Question de FAQ ouverte, sur n'importe quelle page. Dit quelles
      inquietudes reviennent avant l'achat. */
  faqOuverte: "faq_opened",
  /** Formulaire de paiement Stripe pret, avec son temps de chargement. Un
      formulaire qui ne s'affiche pas est un abandon que rien ne montrait. */
  formulairePaiementPret: "payment_form_ready",
  /** Le formulaire Stripe n'a pas pu se charger. */
  formulairePaiementErreur: "payment_form_error",
  /** Bon cadeau : montant choisi. */
  bonCadeauMontant: "gift_card_amount_selected",
  /** Bon cadeau : passage au paiement (coordonnees validees). */
  bonCadeauCaisse: "gift_card_checkout_started",
  /** Bon cadeau : clic sur « Payer ». */
  bonCadeauPaiementLance: "gift_card_payment_initiated",
  /** Bon cadeau : paiement refuse par Stripe. */
  bonCadeauPaiementEchoue: "gift_card_payment_error",
  /** Filtre du portfolio. */
  portfolioFiltre: "portfolio_filtered",
  /** Cadeau de la page bonus telecharge, imprime ou copie. */
  bonusUtilise: "bonus_used",
  /** Page introuvable (404). Une annonce ou un lien casse se voit ici. */
  pageIntrouvable: "page_not_found",
} as const;

/** Tous les noms acceptes par `mesure()`. */
export type NomEvenement = (typeof MESURES)[keyof typeof MESURES];
