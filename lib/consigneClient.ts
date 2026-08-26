/**
 * La consigne ecrite par le client, isolee du recapitulatif technique.
 *
 * Le champ `description` d'une commande contient deux choses collees par une
 * barre verticale (voir `FicheProduit.tsx`) :
 *
 *   "Portrait · 3 personnes · Plage · Numerique | Ils doivent tous etre jaunes…"
 *    └─ genere par le configurateur ──────────┘   └─ ecrit par le client ────┘
 *
 * La premiere moitie est redondante : le format, le nombre de personnes, le
 * decor et le support sont deja des champs structures, affiches partout. La
 * seconde est la seule partie que personne d'autre que le client ne pouvait
 * ecrire — et c'est precisement celle qui n'apparaissait nulle part. Ni dans
 * la notification Discord, ni dans le tableau de bord : il fallait ouvrir la
 * base de donnees pour la lire.
 *
 * La commande du 25 aout 2026 y contenait la consigne « le pere n'a plus de
 * barbe, ne lui en ajoutez pas » et la question « quand puis-je voir un
 * apercu ? ». Ni l'illustrateur ni le support ne pouvaient les voir.
 */

export interface ConsigneClient {
  /** Ce que le client a ecrit, ou null s'il n'a rien ecrit. */
  texte: string | null;
  /**
   * Vrai si la consigne contient une question.
   *
   * Le simple point d'interrogation suffit, et couvre les dix langues du
   * site — l'espagnol ouvre par « ¿ » mais ferme par « ? » comme les autres.
   * Le seuil est volontairement bas : un faux positif coute un coup d'oeil,
   * un faux negatif coute un client sans reponse.
   */
  question: boolean;
}

const VIDE: ConsigneClient = { texte: null, question: false };

/** Separateur pose par le configurateur entre le recapitulatif et la note. */
const SEPARATEUR = " | ";

export function lireConsigne(description: string | null | undefined): ConsigneClient {
  if (typeof description !== "string") return VIDE;

  const coupure = description.indexOf(SEPARATEUR);
  /* Pas de separateur : la commande ne porte que le recapitulatif genere.
     C'est le cas de la grande majorite des commandes — la note est
     facultative. */
  if (coupure === -1) return VIDE;

  /* Decoupe sur la PREMIERE occurrence seulement : une note qui contiendrait
     elle-meme une barre verticale doit rester entiere. */
  const texte = description.slice(coupure + SEPARATEUR.length).trim();
  if (!texte) return VIDE;

  return { texte, question: /[?¿]/.test(texte) };
}

/**
 * Tronque pour un champ Discord, dont la valeur est plafonnee a 1024
 * caracteres — au-dela, l'API rejette l'integralite du message, et c'est
 * toute la notification de commande qui disparait.
 */
export function pourDiscord(texte: string, max = 900): string {
  return texte.length <= max ? texte : `${texte.slice(0, max)}…`;
}
