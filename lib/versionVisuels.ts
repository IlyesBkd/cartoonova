/**
 * Version des visuels de `public/catalogue`.
 *
 * L'optimiseur d'images de Next met ses versions derivees en cache par URL, et
 * `minimumCacheTTL` vaut un an (next.config.ts). Remplacer un fichier en gardant
 * son nom ne change donc rien a l'ecran : l'ancienne version continue d'etre
 * servie. Ce jeton, ajoute en chaine de requete, rend l'URL differente et force
 * la regeneration.
 *
 * **Incrementer apres chaque remplacement de visuels du catalogue.**
 *
 * Pourquoi un jeton global plutot que la date de modification de chaque
 * fichier : `images.localPatterns` n'accepte qu'une correspondance exacte sur
 * `search`. Autoriser une chaine libre laisserait n'importe qui generer autant
 * d'entrees de cache qu'il veut en variant le parametre. Un jeton unique se
 * declare exactement, au prix d'une regeneration complete a chaque increment —
 * ce qui reste rare.
 *
 * Lu aussi par next.config.ts : garder ce fichier sans aucune dependance.
 *
 * ATTENTION — `next.config.ts` est lu une fois, au demarrage. Apres avoir
 * incremente ce jeton, **redemarrer `npm run dev`** : sinon la configuration
 * garde l'ancienne valeur, ne reconnait plus les URL demandees, et toutes les
 * images du catalogue tombent en « Invalid src prop ». En production la
 * question ne se pose pas : le build relit les deux fichiers ensemble.
 */
export const VERSION_VISUELS = "3";
