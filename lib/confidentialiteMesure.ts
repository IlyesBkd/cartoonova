/** Shared outbound telemetry boundary; never use it on transactional payloads. */
const CLE_PRIVEE = /email|recipient|firstname|lastname|first_name|last_name|address|postal|phone|photo|image.?url|token|jeton|secret|authorization|password|cookie|client_secret|message|description|note|stack|exception/i;
const EMAIL = /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi;
const ACCES = /\/(suivi|depot|bonus|bon|confirm-poster|extras|telecharger|download)\/[^/?#\s]+/gi;

export function cheminMesure(chemin: string): string {
  return chemin.split(/[?#]/)[0].replace(ACCES, "/$1/[prive]").replace(EMAIL, "[email]");
}

export function texteMesure(texte: string): string {
  let propre = texte;
  // Decode escaped URLs/emails too; a query must never survive encoding.
  try { propre = decodeURIComponent(propre); } catch { /* malformed input */ }
  return propre.replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(EMAIL, "[email]").replace(ACCES, "/$1/[prive]")
    .replace(/\?[^\s"'<>]*/g, "");
}

export function proprietesMesure<T>(valeur: T): T {
  const vus = new WeakSet<object>();
  function nettoyer(v: unknown, profondeur: number): unknown {
    if (profondeur > 15) return "[limite]";
    if (typeof v === "string") return texteMesure(v);
    if (!v || typeof v !== "object") return v;
    if (vus.has(v)) return "[cycle]";
    vus.add(v);
    if (Array.isArray(v)) return v.map(x => nettoyer(x, profondeur + 1));
    const resultat: Record<string, unknown> = {};
    for (const [cle, item] of Object.entries(v)) {
      if (!CLE_PRIVEE.test(cle)) resultat[texteMesure(cle)] = nettoyer(item, profondeur + 1);
    }
    return resultat;
  }
  return nettoyer(valeur, 0) as T;
}

/** Log only error category and numeric HTTP status, never provider text/code/stack. */
export function diagnosticJournal(erreur: unknown): { categorie: string; statut?: number } {
  const resultat: { categorie: string; statut?: number } = { categorie: diagnosticErreur(erreur) };
  if (erreur && typeof erreur === "object") {
    const e = erreur as { status?: unknown; statusCode?: unknown };
    const statut = e.status ?? e.statusCode;
    if (typeof statut === "number" && Number.isInteger(statut) && statut >= 100 && statut <= 599) resultat.statut = statut;
  }
  return resultat;
}

/** Cron summaries are numeric aggregates, not arbitrary provider/result objects. */
export function bilanJournal(valeur: unknown, profondeur = 0): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  if (profondeur > 8) return resultat;
  const cles = new Set(["sent", "failed", "checked", "newMessages", "enAttente", "recap", "impressions", "messages", "apercus", "outbox", "imagesFinales", "welcome", "reviewRequests", "reviewReminders", "reorders", "abandoned", "leads", "printUpsell", "photos", "alertes", "processed", "skipped", "retried"]);
  if (!valeur || typeof valeur !== "object") return resultat;
  for (const [cle, item] of Object.entries(valeur)) {
    if (!cles.has(cle)) continue;
    if (typeof item === "number" && Number.isFinite(item)) resultat[cle] = item;
    else if (item && typeof item === "object" && !Array.isArray(item)) resultat[cle] = bilanJournal(item, profondeur + 1);
  }
  return resultat;
}

/** Arbitrary provider/database errors may echo entire private requests. */
export function diagnosticErreur(erreur: unknown): string {
  if (erreur instanceof TypeError) return "TypeError";
  if (erreur instanceof RangeError) return "RangeError";
  if (erreur instanceof Error) return "Error";
  return "Erreur fournisseur";
}
