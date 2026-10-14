/**
 * Format du code postal par pays de livraison.
 *
 * « ABC » passait pour la France : un colis pouvait partir vers une adresse
 * invalide (audit P1-7). Le controle tourne dans la caisse ET sur le serveur
 * (`app/api/order/create`), ce qui couvre aussi le paiement express, dont
 * l'adresse vient de Stripe sans passer par le formulaire.
 *
 * Seuls les pays dont le format est sur sont controles. Les autres passent :
 * refuser une vraie adresse coute plus cher qu'en laisser passer une fausse.
 */
const FORMATS: Record<string, RegExp> = {
  FR: /^\d{5}$/,
  MC: /^980\d{2}$/,
  DE: /^\d{5}$/,
  ES: /^\d{5}$/,
  IT: /^\d{5}$/,
  FI: /^\d{5}$/,
  EE: /^\d{5}$/,
  BE: /^\d{4}$/,
  CH: /^\d{4}$/,
  LI: /^\d{4}$/,
  LU: /^(L-?)?\d{4}$/i,
  AT: /^\d{4}$/,
  DK: /^\d{4}$/,
  NO: /^\d{4}$/,
  HU: /^\d{4}$/,
  NL: /^\d{4} ?[A-Z]{2}$/i,
  PT: /^\d{4}-?\d{3}$/,
  PL: /^\d{2}-?\d{3}$/,
  SE: /^\d{3} ?\d{2}$/,
  CZ: /^\d{3} ?\d{2}$/,
  SK: /^\d{3} ?\d{2}$/,
  GR: /^\d{3} ?\d{2}$/,
  HR: /^\d{5}$/,
  RO: /^\d{6}$/,
  BG: /^\d{4}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
  AU: /^\d{4}$/,
};

/** Vrai si le code postal a le format attendu pour ce pays (ou si le pays n'est pas controle). */
export function codePostalValide(pays: string | null | undefined, codePostal: string | null | undefined): boolean {
  const code = (codePostal ?? "").trim();
  if (!code) return false;
  const format = pays ? FORMATS[pays.toUpperCase()] : undefined;
  if (!format) return true;
  // « 75 002 » ou « 750-02 » sont des saisies courantes d'un code valide.
  return format.test(code) || format.test(code.replace(/[\s-]/g, ""));
}
