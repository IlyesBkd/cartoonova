/**
 * Hook de resolution pour lire les modules de `lib/` depuis un script Node.
 *
 * Le code du site ecrit ses imports relatifs sans extension — `./productFeed`,
 * `../i18n/config` — parce que le bundler de Next les resout. Le resolveur ESM
 * de Node, lui, exige l'extension. Ce hook la rajoute quand la resolution
 * echoue, et rien d'autre.
 *
 * Sans lui, un script de donnees devrait recopier le catalogue ou les slugs
 * d'occasion — c'est-a-dire dupliquer la source de verite, et la voir diverger
 * au premier ajout de produit.
 *
 * Usage : node --experimental-strip-types --import ./scripts/charge-ts.mjs …
 */

const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (erreur) {
    const relatif = specifier.startsWith(".") || specifier.startsWith("/");
    if (!relatif) throw erreur;

    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(specifier + extension, context);
      } catch {
        // extension suivante
      }
    }
    throw erreur;
  }
}
