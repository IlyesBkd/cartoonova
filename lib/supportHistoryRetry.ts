/** Retry confirmed-send persistence, NEVER the transport or durable send claim.
 * A fresh transaction per attempt is mandatory (the previous one may have
 * aborted, or even committed while its acknowledgement was lost).
 */
const transientCodes = new Set([
  "40001", "40P01", "55P03", "57014", "57P01", "57P02", "57P03", "53300",
  "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECT_TIMEOUT", "CONNECTION_DESTROYED",
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT",
]);
const delays = [100, 300]; // Three attempts total, no background task.

function diagnosticCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return transientCodes.has(code) || /^[A-Z0-9]{5}$/.test(code) ? code : "non_transient";
}

export async function retryConfirmedSupportHistory<T>(phase: "checkpoint" | "reconcile", run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (error) {
      const code = diagnosticCode(error);
      const retry = (transientCodes.has(code) || /^08[A-Z0-9]{3}$/.test(code)) && attempt < delays.length;
      // Categories only: no recipients, text, attachments, provider data or raw errors.
      console.error("[support-history]", { phase, attempt: attempt + 1, code, retry });
      if (!retry) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}
