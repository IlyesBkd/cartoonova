import type { PagesLegales } from "./types";

/* Version francaise : c'est elle qui fait foi. Toute modification ici doit
   etre reportee dans les neuf autres langues (meme structure, memes numeros
   d'article). */

export const LEGAL_FR: PagesLegales = {
  avertissement: "",
  accepterCgv: "En commandant, tu acceptes nos [conditions générales de vente](/cgv).",

  cgv: {
    titre: "Conditions Générales de Vente",
    miseAJour: "Dernière mise à jour : 1er octobre 2026",
    sections: [
      {
        titre: "Article 1 — Objet",
        blocs: [
          "Les présentes Conditions Générales de Vente (CGV) régissent les ventes de produits et services effectuées par la société {raison}, au capital de {capital}, dont le siège social est situé au {siege}, immatriculée au RCS sous le numéro {rcs}, ci-après dénommée « Cartoonova ».",
          "Elles s'appliquent à toute commande passée sur le site **cartoonova.com** (ci-après « le Site ») par un client particulier ou professionnel (ci-après « le Client »).",
          "Le fait de passer commande sur le Site implique l'acceptation pleine et entière des présentes CGV.",
        ],
      },
      {
        titre: "Article 2 — Produits et services",
        blocs: [
          "Cartoonova propose un service de création de caricatures et portraits personnalisés de style cartoon, réalisés à partir des photos fournies par le Client. Les produits proposés comprennent :",
          {
            liste: [
              "Fichiers numériques (JPG, PNG haute résolution)",
              "Impressions sur poster",
              "Impressions sur canvas (toile)",
              "Impressions sur portrait encadré",
              "Impressions sur mug",
              "Impressions sur Alu-Dibond",
            ],
          },
          "Les photographies et illustrations présentées sur le Site sont aussi fidèles que possible. Toutefois, de légères variations peuvent exister entre le produit commandé et le produit reçu, chaque caricature étant une création unique et artisanale.",
        ],
      },
      {
        titre: "Article 3 — Prix",
        blocs: [
          "Les prix sont indiqués en euros (€), toutes taxes comprises (TTC). Cartoonova se réserve le droit de modifier ses prix à tout moment. Les produits seront facturés au tarif en vigueur au moment de la validation de la commande.",
          "Les impressions (poster, toile, portrait encadré) sont livrées moyennant des frais de livraison forfaitaires, ajoutés au prix des produits et indiqués avant la validation finale de la commande. Le fichier numérique, envoyé par e-mail, n'entraîne aucun frais de livraison.",
        ],
      },
      {
        titre: "Article 4 — Commande",
        blocs: [
          "Le Client sélectionne les options de personnalisation souhaitées (format, nombre de personnes/animaux, arrière-plan, support d'impression) et téléverse les photos nécessaires à la réalisation de la caricature.",
          "La commande est confirmée par le paiement intégral du prix. Un email de confirmation est envoyé au Client à l'adresse email fournie lors de la commande.",
          "Cartoonova se réserve le droit de refuser ou d'annuler toute commande en cas de litige existant, de photos inappropriées ou d'informations manifestement erronées.",
        ],
      },
      {
        titre: "Article 5 — Paiement",
        blocs: [
          "Le paiement s'effectue en ligne par carte bancaire (Visa, Mastercard, American Express) ou via PayPal. Le paiement est sécurisé par un système de cryptage SSL.",
          "Le montant total est débité au moment de la validation de la commande. Aucune commande ne sera traitée avant réception complète du paiement.",
        ],
      },
      {
        titre: "Article 6 — Délais de réalisation et livraison",
        blocs: [
          "Les délais de réalisation d'une caricature sont généralement de **2 jours ouvrés** à compter de la réception du paiement et des photos. Ce délai peut varier en fonction de la complexité de la commande et de la charge de travail des artistes.",
          "**Produits numériques :** Le fichier haute définition est envoyé par email au Client dès que la caricature est terminée. Le Client peut ensuite demander des retouches (article 7).",
          "**Produits imprimés :** Un aperçu est soumis au Client, qui le valide avant l'impression. L'impression et l'expédition prennent ensuite un délai de 3 à 7 jours ouvrés selon la destination. Les frais et délais de livraison sont indiqués lors de la commande.",
          "**Option express :** lorsque le Client l'a choisie, la caricature est livrée sous 24 heures, y compris le week-end, à compter de la réception du paiement et des photos. Pour un produit imprimé, ce délai porte sur le dessin ; l'impression et l'expédition suivent les délais ci-dessus.",
          "Cartoonova ne saurait être tenue responsable des retards de livraison imputables au transporteur ou à un cas de force majeure.",
        ],
      },
      {
        titre: "Article 7 — Révisions et satisfaction",
        blocs: [
          "Cartoonova s'engage à fournir un travail de qualité et fidèle aux photos fournies. Le Client dispose de **révisions gratuites et illimitées** jusqu'à satisfaction complète.",
          "Les demandes de révision doivent être formulées de manière claire et précise par email à support@cartoonova.com.",
          "Les révisions portent sur des ajustements raisonnables (ressemblance, couleurs, détails). Elles ne couvrent pas un changement complet du style ou de la composition initialement validée.",
          "**Garantie de satisfaction.** Si, après les révisions, la caricature ne convient toujours pas au Client, Cartoonova lui rembourse l'intégralité du prix payé, sur simple demande à support@cartoonova.com. Pour un produit imprimé, la demande doit être faite **avant la validation de l'aperçu** : une fois l'aperçu validé, l'impression est lancée et le produit relève alors de l'article 9.",
        ],
      },
      {
        titre: "Article 8 — Droit de rétractation",
        blocs: [
          "Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation **ne peut être exercé** pour les contrats de fourniture de biens confectionnés selon les spécifications du consommateur ou nettement personnalisés.",
          "Chaque caricature étant une œuvre unique réalisée sur mesure à partir des photos et instructions du Client, les commandes de produits numériques ne sont pas éligibles au droit de rétractation une fois le travail de création commencé.",
          "Pour les produits imprimés, si le produit reçu est endommagé ou non conforme à la commande, le Client peut contacter le service client dans un délai de 14 jours suivant la réception pour obtenir un échange ou un remboursement.",
        ],
      },
      {
        titre: "Article 9 — Remboursement",
        blocs: [
          "Un remboursement est accordé dans deux cas : au titre de la garantie de satisfaction de l'article 7, ou lorsqu'un produit imprimé est reçu défectueux ou non conforme. Dans ce second cas, Cartoonova procède, au choix du Client, à un remplacement ou à un remboursement intégral.",
          "Le remboursement est effectué sur le moyen de paiement utilisé lors de la commande, dans un délai de 14 jours suivant la demande validée.",
          "Les demandes de remboursement doivent être adressées à support@cartoonova.com accompagnées du numéro de commande et d'une description du problème.",
        ],
      },
      {
        titre: "Article 9 bis — Bons cadeaux",
        blocs: [
          "Cartoonova propose des bons cadeaux d'un montant fixe, payés en ligne et remis par email sous la forme d'un code et d'une version imprimable.",
          "Le bon est valable **12 mois** à compter de son achat, dans la devise de l'achat. Il peut être utilisé en une ou plusieurs commandes, jusqu'à épuisement de son solde. Chaque commande comporte un minimum de 1 (dans la devise de la commande) restant à la charge du Client ; le solde non utilisé reste disponible.",
          "Le bon n'est ni remboursable ni échangeable contre des espèces. Le droit de rétractation de 14 jours s'applique à l'achat du bon tant qu'il n'a pas été utilisé : le remboursement peut alors être demandé à support@cartoonova.com.",
        ],
      },
      {
        titre: "Article 10 — Propriété intellectuelle",
        blocs: [
          "Les caricatures créées par Cartoonova sont des œuvres originales protégées par le droit d'auteur. Après paiement intégral, le Client reçoit un **droit d'usage personnel et non commercial** de l'œuvre.",
          "Cartoonova se réserve le droit d'utiliser les caricatures réalisées à des fins de promotion (portfolio, réseaux sociaux), sauf demande contraire explicite du Client.",
        ],
      },
      {
        titre: "Article 11 — Responsabilité",
        blocs: [
          "Cartoonova ne saurait être tenue responsable de l'utilisation faite par le Client des caricatures livrées. Le Client garantit qu'il dispose des droits nécessaires sur les photos transmises et qu'il ne les utilise pas à des fins diffamatoires ou illégales.",
        ],
      },
      {
        titre: "Article 12 — Protection des données",
        blocs: [
          "Les données personnelles collectées dans le cadre des commandes sont traitées conformément à notre [Politique de Confidentialité](/politique-de-confidentialite).",
          "Les photos transmises par le Client sont utilisées exclusivement pour la réalisation de la commande et sont supprimées dans un délai de 90 jours après livraison, sauf demande de conservation du Client.",
        ],
      },
      {
        titre: "Article 13 — Médiation et litiges",
        blocs: [
          "En cas de litige, le Client est invité à contacter en premier lieu le service client de Cartoonova à support@cartoonova.com afin de rechercher une solution amiable.",
          "Conformément aux articles L611-1 et suivants du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige.",
          "À défaut de résolution amiable, les tribunaux compétents de Paris seront seuls compétents. Les présentes CGV sont soumises au droit français.",
        ],
      },
      {
        titre: "Article 14 — Contact",
        blocs: [
          "Pour toute question relative à votre commande ou aux présentes CGV :",
          { lignes: ["**{raison}**", "{siege}", "Tél. : {tel}", "Email : support@cartoonova.com"] },
        ],
      },
    ],
  },

  mentions: {
    titre: "Mentions Légales",
    miseAJour: "Dernière mise à jour : 21 mars 2024",
    sections: [
      {
        titre: "1. Éditeur du site",
        blocs: [
          {
            lignes: [
              "**Raison sociale :** {raison}",
              "**Siège social :** {siege}",
              "**SIRET :** {siret}",
              "**RCS :** {rcs}",
              "**Capital social :** {capital}",
              "**Numéro de TVA intracommunautaire :** {tva}",
              "**Téléphone :** {tel}",
              "**Email :** support@cartoonova.com",
              "**Directeur de la publication :** {directeur}",
            ],
          },
        ],
      },
      {
        titre: "2. Hébergement",
        blocs: [
          {
            lignes: [
              "**Hébergeur :** Vercel Inc.",
              "**Adresse :** 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis",
              "**Site web :** vercel.com",
            ],
          },
        ],
      },
      {
        titre: "3. Activité",
        blocs: [
          "Cartoonova est un service en ligne de création de caricatures et portraits personnalisés de style cartoon. Cartoonova transforme vos photos en portraits uniques, disponibles en format numérique ou imprimées sur divers supports (poster, canvas, mug, etc.).",
        ],
      },
      {
        titre: "4. Propriété intellectuelle",
        blocs: [
          "L'ensemble du contenu du site Cartoonova (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.",
          "Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de {raison}.",
          "Les caricatures réalisées par Cartoonova restent la propriété de {raison} jusqu'au paiement intégral de la commande. Après paiement, le client reçoit un droit d'usage personnel et non commercial de l'œuvre.",
        ],
      },
      {
        titre: "5. Données personnelles",
        blocs: [
          "Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données personnelles.",
          "Pour exercer ces droits ou pour toute question relative à la protection de vos données, contactez-nous à : support@cartoonova.com",
          "Pour plus de détails, consultez notre [Politique de Confidentialité](/politique-de-confidentialite).",
        ],
      },
      {
        titre: "6. Cookies",
        blocs: [
          "Le site Cartoonova utilise des cookies pour améliorer l'expérience utilisateur, analyser le trafic et permettre le bon fonctionnement des services. En poursuivant votre navigation, vous acceptez l'utilisation de cookies conformément à notre politique de confidentialité.",
        ],
      },
      {
        titre: "7. Limitation de responsabilité",
        blocs: [
          "{raison} s'efforce de fournir des informations exactes et à jour sur le site. Toutefois, elle ne saurait garantir l'exactitude, la complétude ou l'actualité des informations diffusées. {raison} décline toute responsabilité en cas d'erreur ou d'omission dans le contenu du site.",
          "L'utilisation du site se fait aux risques et périls de l'utilisateur. {raison} ne saurait être tenue responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du site.",
        ],
      },
      {
        titre: "8. Droit applicable",
        blocs: [
          "Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents de Paris seront seuls compétents.",
        ],
      },
      {
        titre: "9. Contact",
        blocs: ["Pour toute question, vous pouvez nous contacter par email à : support@cartoonova.com"],
      },
    ],
  },

  confidentialite: {
    titre: "Politique de Confidentialité",
    miseAJour: "Dernière mise à jour : 21 mars 2024",
    sections: [
      {
        titre: "1. Introduction",
        blocs: [
          "La société {raison} (ci-après « Cartoonova », « nous », « notre ») s'engage à protéger la vie privée de ses utilisateurs et clients (ci-après « vous », « votre »).",
          "La présente Politique de Confidentialité décrit la manière dont nous collectons, utilisons, stockons et protégeons vos données personnelles lorsque vous utilisez notre site **cartoonova.com** (ci-après « le Site ») et nos services de création de caricatures personnalisées.",
          "Cette politique est conforme au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée.",
        ],
      },
      {
        titre: "2. Responsable du traitement",
        blocs: [{ lignes: ["**{raison}**", "{siege}", "SIRET : {siret}", "Email : support@cartoonova.com", "Tél. : {tel}"] }],
      },
      {
        titre: "3. Données collectées",
        blocs: [
          "Dans le cadre de nos services, nous sommes amenés à collecter les catégories de données suivantes :",
          { sousTitre: "3.1 Données d'identification" },
          { liste: ["Nom et prénom", "Adresse email", "Adresse postale (pour les livraisons de produits imprimés)", "Numéro de téléphone (facultatif)"] },
          { sousTitre: "3.2 Données de commande" },
          {
            liste: [
              "Détails de la commande (format, options, support d'impression)",
              "Photos transmises pour la réalisation de la caricature",
              "Historique des commandes et des échanges avec le service client",
            ],
          },
          { sousTitre: "3.3 Données de paiement" },
          {
            liste: [
              "Les données de paiement (numéro de carte, etc.) sont traitées directement par nos prestataires de paiement sécurisés (Stripe, PayPal) et ne sont jamais stockées sur nos serveurs.",
            ],
          },
          { sousTitre: "3.4 Données de navigation" },
          { liste: ["Adresse IP", "Type de navigateur et système d'exploitation", "Pages consultées et durée de visite", "Cookies et identifiants de session"] },
        ],
      },
      {
        titre: "4. Finalités du traitement",
        blocs: [
          "Vos données personnelles sont collectées et traitées pour les finalités suivantes :",
          {
            liste: [
              "**Exécution des commandes :** réalisation de la caricature, impression, expédition et suivi de livraison.",
              "**Gestion de la relation client :** service après-vente, révisions, réponses à vos demandes.",
              "**Paiement :** traitement et sécurisation des transactions.",
              "**Communication :** envoi de confirmations de commande, notifications de livraison et, avec votre consentement, offres promotionnelles.",
              "**Amélioration du service :** analyse statistique anonymisée de l'utilisation du Site.",
              "**Obligations légales :** conservation des factures et données comptables conformément à la réglementation en vigueur.",
            ],
          },
        ],
      },
      {
        titre: "5. Base légale du traitement",
        blocs: [
          "Le traitement de vos données repose sur les bases légales suivantes :",
          {
            liste: [
              "**Exécution du contrat :** les données nécessaires à la réalisation et la livraison de votre commande.",
              "**Consentement :** pour l'envoi de communications marketing et l'utilisation de cookies non essentiels.",
              "**Intérêt légitime :** pour l'amélioration de nos services et la prévention de la fraude.",
              "**Obligation légale :** pour la conservation des données comptables et fiscales.",
            ],
          },
        ],
      },
      {
        titre: "6. Durée de conservation",
        blocs: [
          {
            liste: [
              "**Données de commande :** 3 ans après la dernière commande.",
              "**Photos transmises :** supprimées dans un délai de 90 jours après la livraison de la commande, sauf demande contraire du Client.",
              "**Données comptables :** 10 ans conformément aux obligations légales.",
              "**Cookies de navigation :** 13 mois maximum.",
              "**Données de prospection :** 3 ans après le dernier contact.",
            ],
          },
        ],
      },
      {
        titre: "7. Partage des données",
        blocs: [
          "Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées avec :",
          {
            liste: [
              "**Nos prestataires de réalisation :** uniquement les photos et instructions nécessaires à la réalisation de la caricature.",
              "**Prestataires de paiement :** Stripe et PayPal pour le traitement sécurisé des paiements.",
              "**Services d'impression et de livraison :** adresse de livraison pour l'expédition des produits imprimés.",
              "**Hébergeur :** Vercel Inc. pour l'hébergement technique du Site.",
              "**Outils d'analyse :** Google Analytics (données anonymisées).",
            ],
          },
          "Tous nos prestataires sont soumis à des obligations contractuelles strictes de confidentialité et de protection des données conformes au RGPD.",
        ],
      },
      {
        titre: "8. Transferts internationaux",
        blocs: [
          "Certaines de vos données peuvent être transférées en dehors de l'Union Européenne (hébergement aux États-Unis via Vercel). Ces transferts sont encadrés par les Clauses Contractuelles Types (CCT) de la Commission Européenne ou le Data Privacy Framework UE-États-Unis.",
        ],
      },
      {
        titre: "9. Cookies",
        blocs: [
          "Le Site utilise les types de cookies suivants :",
          {
            liste: [
              "**Cookies essentiels :** nécessaires au fonctionnement du Site (session, panier, authentification).",
              "**Cookies analytiques :** nous permettent de comprendre comment le Site est utilisé (Google Analytics) — soumis à votre consentement.",
              "**Cookies marketing :** utilisés pour personnaliser les publicités — soumis à votre consentement.",
            ],
          },
          "Vous pouvez gérer vos préférences de cookies à tout moment via les paramètres de votre navigateur ou via notre bandeau de consentement.",
        ],
      },
      {
        titre: "10. Vos droits",
        blocs: [
          "Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :",
          {
            liste: [
              "**Droit d'accès :** obtenir la confirmation que vos données sont traitées et en obtenir une copie.",
              "**Droit de rectification :** corriger des données inexactes ou incomplètes.",
              "**Droit de suppression :** demander l'effacement de vos données (« droit à l'oubli »).",
              "**Droit à la portabilité :** recevoir vos données dans un format structuré et lisible.",
              "**Droit d'opposition :** vous opposer au traitement de vos données pour des motifs légitimes.",
              "**Droit de limitation :** limiter le traitement de vos données dans certaines circonstances.",
              "**Droit de retirer votre consentement :** à tout moment pour les traitements basés sur le consentement.",
            ],
          },
          "Pour exercer l'un de ces droits, contactez-nous à : support@cartoonova.com",
          "Nous nous engageons à répondre à votre demande dans un délai de 30 jours. Vous disposez également du droit d'introduire une réclamation auprès de la **CNIL** (Commission Nationale de l'Informatique et des Libertés) : [www.cnil.fr](https://www.cnil.fr).",
        ],
      },
      {
        titre: "11. Sécurité",
        blocs: [
          "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre l'accès non autorisé, la perte, la destruction ou l'altération :",
          {
            liste: [
              "Chiffrement SSL/TLS de toutes les communications",
              "Accès restreint aux données sur la base du « besoin d'en connaître »",
              "Sauvegardes régulières et sécurisées",
              "Surveillance et journalisation des accès",
            ],
          },
        ],
      },
      {
        titre: "12. Mineurs",
        blocs: [
          "Le Site ne s'adresse pas aux mineurs de moins de 16 ans. Nous ne collectons pas sciemment de données personnelles de mineurs. Si vous êtes parent ou tuteur et pensez que votre enfant nous a fourni des données, contactez-nous pour que nous procédions à leur suppression.",
        ],
      },
      {
        titre: "13. Modifications",
        blocs: [
          "Nous nous réservons le droit de modifier la présente Politique de Confidentialité à tout moment. Toute modification sera publiée sur cette page avec la date de mise à jour. Nous vous invitons à consulter régulièrement cette page.",
        ],
      },
      {
        titre: "14. Contact",
        blocs: [
          "Pour toute question concernant la protection de vos données personnelles :",
          { lignes: ["**{raison}**", "{siege}", "Tél. : {tel}", "Email : support@cartoonova.com"] },
        ],
      },
    ],
  },
};
