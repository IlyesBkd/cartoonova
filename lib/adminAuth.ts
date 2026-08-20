import { NextResponse } from "next/server";
import { cleDepuisRequete, enregistrerEchec, reinitialiser, verifierLimite } from "./rateLimit";

/**
 * Controle d'acces des routes d'administration.
 *
 * Chacune des huit routes repetait la meme paire de lignes — lecture de
 * l'en-tete, comparaison au mot de passe — sans aucune limitation du nombre
 * d'essais. Le controle est regroupe ici pour que la limitation s'applique
 * partout d'un coup, et qu'aucune route future ne l'oublie.
 *
 * Renvoie `null` quand l'acces est accorde, ou la reponse a renvoyer telle
 * quelle sinon.
 */
export function refuserSiPasAdmin(req: Request): NextResponse | null {
  const attendu = process.env.ADMIN_PASSWORD;

  // Sans mot de passe configure, la comparaison laisserait passer un en-tete
  // absent (undefined === undefined) : on ferme plutot que d'ouvrir en grand.
  if (!attendu) {
    console.error("[admin] ADMIN_PASSWORD manquant");
    return NextResponse.json({ error: "Non configuré." }, { status: 503 });
  }

  const cle = cleDepuisRequete(req);
  const limite = verifierLimite(cle);
  if (limite.bloque) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(limite.reessayerDans) } }
    );
  }

  const fourni = req.headers.get("x-admin-password");
  if (fourni !== attendu) {
    enregistrerEchec(cle);
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  reinitialiser(cle);
  return null;
}
