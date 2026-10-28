import {createHash, randomBytes, randomInt, randomUUID} from "node:crypto";
import type {Sql} from "postgres";
import type {GuideJournal} from "./giftGuideAttribution";

const hash = (token: string) => /^[a-f0-9]{64}$/.test(token)
  ? createHash("sha256").update(`gift-guide:v1:${token}`).digest("hex") : null;
/** Inject ONLY a disposable database until consent/legal/operations approval.
 * Server-only capability: never serialize to a URL, analytics, or logs.
 * No provider, existing database singleton or environment is imported here. */
export function createGiftGuideStore(sql: Sql) {
  return {
    /** Callable by an explicitly authorized future scheduler, not installed here. */
    async purge() {
      const deleted = await sql`DELETE FROM gift_guide_preparation.sessions WHERE retain_until <= clock_timestamp() RETURNING token_hash`;
      return deleted.length;
    },
    async enroll(consent: boolean) {
      if (consent !== true) return null;
      return sql.begin(async tx => {
        await tx`SELECT pg_advisory_xact_lock(73114611)`;
        const [count] = await tx`SELECT count(*)::int AS n FROM gift_guide_preparation.sessions`;
        if (count.n >= 100000) return null;
        const token = randomBytes(32).toString("hex"), sessionId = randomUUID();
        const cohort = randomInt(2) === 0 ? "control" : "guided-v1";
        await tx`INSERT INTO gift_guide_preparation.sessions(token_hash, session_id, cohort)
          VALUES (${hash(token)!}, ${sessionId}, ${cohort})`;
        return {token, sessionId, cohort};
      });
    },
    async revoke(token: string) {
      const key = hash(token); if (!key) return;
      // Parent-row deletion serializes with events, export and attachments.
      // Cascading removal includes every payment link, not business orders.
      await sql`DELETE FROM gift_guide_preparation.sessions WHERE token_hash=${key}`;
    },
    async record(token: string, event: string, consent: boolean) {
      const key = hash(token);
      if (!key || consent !== true || !["viewed", "exposed", "clicked"].includes(event)) return false;
      return sql.begin(async tx => {
        const [s] = await tx`SELECT * FROM gift_guide_preparation.sessions WHERE token_hash=${key}
          AND expires_at > clock_timestamp() FOR UPDATE`;
        if (!s || s.cohort === "control" || (event === "clicked" && !s.events.includes("exposed"))) return false;
        if (!s.events.includes(event)) await tx`UPDATE gift_guide_preparation.sessions SET events=array_append(events, ${event}) WHERE token_hash=${key}`;
        return true;
      });
    },
    /** Trusted checkout adapter must return ONLY its own server-created/owned PI.
     * Never pass a callback that merely returns a browser PI or client_secret. */
    async attach(token: string, consent: boolean, preparedOwnedPayment: () => Promise<string | null>) {
      const key = hash(token); if (!key || consent !== true) return false;
      const paymentId = await preparedOwnedPayment();
      if (!paymentId || !/^pi_[a-zA-Z0-9]{1,100}$/.test(paymentId)) return false;
      return sql.begin(async tx => {
        const [s] = await tx`SELECT token_hash FROM gift_guide_preparation.sessions WHERE token_hash=${key}
          AND expires_at > clock_timestamp() FOR UPDATE`;
        if (!s) return false; // Recheck after async work: withdrawal cannot resurrect.
        const [count] = await tx`SELECT count(*)::int AS n FROM gift_guide_preparation.checkouts WHERE token_hash=${key}`;
        const [existing] = await tx`SELECT token_hash FROM gift_guide_preparation.checkouts WHERE payment_intent_id=${paymentId}`;
        if (existing) return existing.token_hash === key;
        if (count.n >= 100) return false;
        const inserted = await tx`INSERT INTO gift_guide_preparation.checkouts(payment_intent_id,token_hash)
          VALUES (${paymentId},${key}) ON CONFLICT DO NOTHING RETURNING token_hash`;
        return inserted.length === 1;
      });
    },
    /** Trusted offline export only; never expose through the public route. */
    async journal(token: string): Promise<GuideJournal | null> {
      const key = hash(token); if (!key) return null;
      return sql.begin(async tx => {
        const [s] = await tx`SELECT * FROM gift_guide_preparation.sessions
          WHERE token_hash=${key} AND retain_until > clock_timestamp() FOR UPDATE`;
        if (!s) return null;
        const links = await tx`SELECT payment_intent_id FROM gift_guide_preparation.checkouts WHERE token_hash=${key} ORDER BY payment_intent_id`;
        return {version: 1, sessionId: s.session_id, cohort: s.cohort, consent: true,
          events: s.events, checkouts: links.map(c => ({paymentIntentId: c.payment_intent_id}))} as GuideJournal;
      });
    },
  };
}
/** Server preparation only. No DB/provider imports and no browser transport. */
export async function giftGuideMeasurementRequest(_request: Request, options: {
  enabled: boolean; consent?: () => unknown;
}): Promise<Response> {
  // A public flag, a JSON consent:true or an existing analytics cookie is NOT
  // an authority to enroll. A reviewed durable consent adapter is still needed.
  return Response.json({error: options.enabled ? "measurement_not_configured" : "not_found"}, {
    status: options.enabled ? 503 : 404, headers: {"Cache-Control": "no-store"},
  });
}
