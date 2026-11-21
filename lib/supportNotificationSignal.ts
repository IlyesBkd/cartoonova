import type postgres from "postgres";

/** Accélérateur uniquement : appeler après la validation de l'insertion (autocommit).
 * Aucun contenu client ni identifiant ne doit voyager dans ce signal éphémère.
 * La file et le stockage durables restent la source de vérité des travailleurs.
 */
export async function signalSupportIncoming(
  querySql: ReturnType<typeof postgres>,
  channel: "chat" | "email",
): Promise<void> {
  try {
    // Liste fermée aussi à l'exécution, même si un appelant contourne le typage.
    if (channel !== "chat" && channel !== "email") return;
    // Ne borner/annuler que ce signal, jamais l'insertion déjà validée.
    const pending = querySql`SELECT pg_notify('cartoonova_support_incoming', ${channel})`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      await Promise.race([
        // race garde un gestionnaire de rejet même après expiration/annulation.
        Promise.resolve(pending),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error("Support wake signal timed out"));
          }, 500);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (timedOut) {
        // cancel(): void ; ne pas attendre le règlement de la requête annulée.
        try { pending.cancel(); } catch { /* Annulation au mieux, sans donnée privée. */ }
      }
    }
  } catch {
    // Ne jamais journaliser l'erreur PostgreSQL : elle peut contenir des secrets.
    console.warn("[support notification] wake signal unavailable");
  }
}
