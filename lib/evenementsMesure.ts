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

  /** Clic sur une carte produit — accueil, catalogue, menu, suggestions. */
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
      trop tot, trop tard, ou inutile. */
  photosDeposees: "photos_submitted",
  /** Clic sur « commander » alors qu'aucune photo n'a ete deposee. Le
      formulaire refuse et renvoie a l'etape d'envoi — c'est un blocage, pas
      une erreur du client. */
  achatBloqueSansPhoto: "purchase_blocked_no_photo",
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
  /** Coordonnees validees, passage a l'etape de paiement. */
  coordonneesValidees: "checkout_info_completed",
  /** Option cadeau activee ou desactivee. */
  cadeauBascule: "gift_toggled",
  /** Code promo accepte. */
  promoAccepte: "promo_code_applied",
  /** Code promo refuse, avec le motif. */
  promoRefuse: "promo_code_rejected",
  /** Paiement lance — carte ou portefeuille. */
  paiementLance: "payment_initiated",
  /** Paiement refuse par Stripe. */
  paiementEchoue: "payment_error",
  /** Fermeture de la caisse sans avoir paye, avec l'etape atteinte. C'est le
      seul evenement qui distingue « parti a l'etape adresse » de « parti
      devant le formulaire de carte » — deux problemes sans rapport. */
  caisseAbandonnee: "checkout_abandoned",

  /* ═══ apres l'achat ═══════════════════════════════════════════════════ */

  /** Commande enregistree en PENDING, avant la confirmation du paiement.
      Emis cote serveur. */
  commandeCreee: "order_created",
  /** Achat confirme. Emis cote serveur au passage en PAID, et cote client sur
      la page de succes — voir `lib/analyticsServeur.ts` pour la raison. */
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
} as const;

/** Tous les noms acceptes par `mesure()`. */
export type NomEvenement = (typeof MESURES)[keyof typeof MESURES];
