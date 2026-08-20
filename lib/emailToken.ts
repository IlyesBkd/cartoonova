import { createHmac, timingSafeEqual } from "crypto";

// Les liens de desinscription sont signes : sans signature, n'importe qui
// pourrait desabonner n'importe quelle adresse en devinant l'URL.
function secret(): string {
  const value = process.env.NEWSLETTER_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error("NEWSLETTER_SECRET (ou CRON_SECRET) manquant");
  return value;
}

export function signEmail(email: string): string {
  return createHmac("sha256", secret())
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function verifyEmailToken(email: string, token: string): boolean {
  try {
    const expected = Buffer.from(signEmail(email));
    const received = Buffer.from(token);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

/* ─── Suivi de commande ───────────────────────────────────────────────
   Meme principe que la desinscription : le lien porte l'identifiant de la
   commande et sa signature. Sans signature, il suffirait d'essayer des
   identifiants pour lire l'adresse et les photos d'un autre client.

   Le jeton est calcule, pas stocke : aucune colonne a ajouter, et il reste
   valable tant que le secret ne change pas. */

export function signOrderId(orderId: string): string {
  return createHmac("sha256", secret())
    .update(`commande:${orderId.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Jeton d'un lien de suivi : `<id>.<signature>`, en un seul segment d'URL. */
export function orderTrackingToken(orderId: string): string {
  return `${orderId}.${signOrderId(orderId)}`;
}

/** Renvoie l'identifiant de commande si la signature est valide, sinon null. */
export function parseOrderTrackingToken(token: string): string | null {
  const separateur = token.lastIndexOf(".");
  if (separateur <= 0) return null;

  const orderId = token.slice(0, separateur);
  const signature = token.slice(separateur + 1);

  // Un identifiant hors format ne doit jamais atteindre la base : la colonne
  // est de type uuid, une valeur invalide y provoquerait une erreur SQL.
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;

  try {
    const attendue = Buffer.from(signOrderId(orderId));
    const recue = Buffer.from(signature);
    if (attendue.length !== recue.length) return null;
    return timingSafeEqual(attendue, recue) ? orderId : null;
  } catch {
    return null;
  }
}
