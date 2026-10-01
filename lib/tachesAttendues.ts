/**
 * Ce qui doit tourner, et a quel rythme.
 *
 * Sans cette liste, le journal des taches ne repond qu'a « qu'est-ce qui a
 * tourne ? ». La question utile est l'inverse : « qu'est-ce qui aurait du
 * tourner et ne l'a pas fait ? ». Une tache en panne n'ecrit rien — on ne peut
 * donc pas la detecter en lisant ses lignes, seulement en constatant leur
 * absence a un endroit ou on les attendait.
 *
 * La tolerance est volontairement plus large que la cadence. GitHub deprogramme
 * les taches planifiees de plusieurs heures (c'est documente dans
 * `sonde-indexation.yml`, et c'est la raison du chainage `workflow_run:`), donc
 * alerter a la premiere heure de retard produirait du bruit quotidien. On
 * alerte quand un passage a ete manque, pas quand il est en retard.
 */

export interface TacheAttendue {
  /** Nom exact ecrit dans `ge_job_runs.tache`. */
  nom: string;
  libelle: string;
  /** Heures au-dela desquelles l'absence de passage reussi devient une alerte. */
  toleranceHeures: number;
  /**
   * Nombre de passages consecutifs sans rien produire avant de crier.
   *
   * Absent = la tache n'a pas de notion de production, ou un zero y est normal.
   * C'est le garde-fou contre le mode de panne le plus couteux : reussir sans
   * rien faire.
   */
  steriliteApres?: number;
}

export const TACHES_ATTENDUES: TacheAttendue[] = [
  {
    nom: "contenu-fiches",
    libelle: "Redaction des fiches produit",
    // Cadence 02h10 chaque nuit. 40 h laisse passer un decalage GitHub d'une
    // nuit entiere sans alerter.
    toleranceHeures: 40,
    // Tant que la couverture n'est pas complete (139/350 au 18/09/2026), zero
    // fiche ecrite deux nuits de suite signale une panne, pas une fin de stock.
    steriliteApres: 2,
  },
  // Le moteur de blog est invoque plusieurs fois par passage, en processus
  // separes. On surveille chaque commande plutot que l'ensemble : savoir
  // laquelle a cesse de fonctionner est precisement la question utile, et une
  // commande peut legitimement ne rien produire pendant qu'une autre est en
  // panne.
  {
    nom: "moteur-contenu:topics:discover",
    libelle: "Moteur de blog — decouverte de sujets",
    // Cinq passages par jour : 18 h d'absence est deja anormal.
    toleranceHeures: 18,
    steriliteApres: 3,
  },
  {
    nom: "moteur-contenu:batch",
    libelle: "Moteur de blog — redaction des brouillons",
    toleranceHeures: 18,
    // Pas de seuil de sterilite : zero brouillon cree est le resultat normal
    // quand le stock est deja au niveau vise. C'est `publish` qui dira si la
    // chaine est reellement a l'arret.
  },
  {
    nom: "moteur-contenu:publish",
    libelle: "Moteur de blog — publication",
    toleranceHeures: 18,
    // Douze passages reussis sans rien publier, soit environ deux jours et
    // demi : le stock de brouillons est vide et la redaction ne le remplit
    // plus. C'est exactement l'etat de septembre 2026.
    steriliteApres: 12,
  },
  {
    nom: "sonde-indexation",
    libelle: "Sonde d'indexation Search Console",
    toleranceHeures: 40,
    steriliteApres: 2,
  },
  {
    nom: "sonde-citations",
    libelle: "Sonde de citation des assistants",
    toleranceHeures: 40,
    // Zero citation est un resultat legitime ; zero *question posee* ne l'est
    // pas. La tache rapporte le nombre de questions, pas de citations.
    steriliteApres: 2,
  },
  {
    nom: "sonde-marchand",
    libelle: "Sonde Merchant Center",
    toleranceHeures: 48,
  },
  {
    nom: "sonde-vitesse",
    libelle: "Sonde de vitesse (Core Web Vitals)",
    toleranceHeures: 48,
  },
  {
    nom: "sonde-entonnoir",
    libelle: "Sonde d'entonnoir hebdomadaire",
    // Lundi 08h00. Neuf jours laissent passer un lundi decale.
    toleranceHeures: 24 * 9,
  },
  {
    nom: "cron-seo",
    libelle: "Cron SEO (sitemap, IndexNow, veille)",
    toleranceHeures: 40,
  },
  {
    nom: "cron-lifecycle",
    libelle: "Cron des emails de cycle de vie",
    toleranceHeures: 40,
  },
  {
    nom: "cron-support",
    libelle: "Synchronisation de la boite support",
    toleranceHeures: 40,
  },
  {
    nom: "cron-retouches",
    libelle: "Alerte des retouches sans reponse",
    // Toutes les 3 h : 8 h d'absence, c'est deux passages manques.
    toleranceHeures: 8,
  },
];
