/** Local-only CRO-11 journal. No provider, URL, email, IP or payment secret is stored. */
export type GuideCohort = "control" | "guided-v1";
export type GuideEvent = "viewed" | "exposed" | "clicked";
export type GuideJournal = {
  version: 1;
  sessionId: string;
  cohort: GuideCohort;
  consent: true;
  events: GuideEvent[];
  checkouts: { paymentIntentId: string }[];
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PI = /^pi_[a-zA-Z0-9]{1,100}$/;
export function validateGuideJournal(value: unknown): GuideJournal | null {
  if (!value || typeof value !== "object") return null;
  const j = value as GuideJournal;
  if (j.version !== 1 || !UUID.test(j.sessionId) || j.consent !== true || !["control", "guided-v1"].includes(j.cohort)
    || !Array.isArray(j.events) || j.events.length > 3 || new Set(j.events).size !== j.events.length
    || j.events.some(e => !["viewed", "exposed", "clicked"].includes(e))
    || (j.cohort === "control" && j.events.length > 0)
    || (j.events.includes("clicked") && !j.events.includes("exposed"))
    || !Array.isArray(j.checkouts) || j.checkouts.length > 100
    || j.checkouts.some(c => !c || !PI.test(c.paymentIntentId))) return null;
  // Project onto known fields: never round-trip arbitrary stored properties.
  return {version: 1, sessionId: j.sessionId, cohort: j.cohort, consent: true,
    events: [...j.events], checkouts: j.checkouts.map(c => ({paymentIntentId: c.paymentIntentId}))};
}
export function createGiftGuideJournal(io: {
  enabled: () => boolean; consent: () => string; read: () => unknown;
  write: (value: GuideJournal | null) => void; id: () => string; random: () => number;
}) {
  // This tombstone is independent of best-effort physical Storage deletion.
  let invalidated = false;
  let generation = 0;
  const revoke = (): void => {
    generation++;
    invalidated = true;
    try { io.write(null); } catch { /* Never authorize the stale readable copy. */ }
  };
  const current = (): GuideJournal | null => {
    try {
      if (!io.enabled() || io.consent() !== "granted") { revoke(); return null; }
      if (invalidated) return null;
      return validateGuideJournal(io.read());
    } catch { return null; }
  };
  const save = (j: GuideJournal): GuideJournal | null => {
    try {
      if (!io.enabled() || io.consent() !== "granted") { revoke(); return null; }
      io.write(j); invalidated = false; return j;
    } catch { return null; }
  };
  return {
    revoke,
    enroll(): GuideJournal | null {
      const existing = current(); if (existing) return existing;
      if (!io.enabled() || io.consent() !== "granted") return null;
      return save({version: 1, sessionId: io.id(), cohort: io.random() < 0.5 ? "control" : "guided-v1", consent: true, events: [], checkouts: []});
    },
    record(event: GuideEvent): void {
      const j = current();
      if (!j || j.cohort === "control" || j.events.includes(event)
        || (event === "clicked" && !j.events.includes("exposed"))) return;
      save({...j, events: [...j.events, event]});
    },
    captureCheckout(): { sessionId: string; generation: number } | null {
      const j = current();
      return j ? {sessionId: j.sessionId, generation} : null;
    },
    attachCheckout(clientSecret: unknown, started: { sessionId: string; generation: number } | null): void {
      const j = current();
      if (!j || !started || started.sessionId !== j.sessionId || started.generation !== generation
        || typeof clientSecret !== "string") return;
      const match = /^(pi_[a-zA-Z0-9]{1,100})_secret_[a-zA-Z0-9]+$/.exec(clientSecret);
      if (!match || j.checkouts.some(c => c.paymentIntentId === match[1]) || j.checkouts.length >= 100) return;
      save({...j, checkouts: [...j.checkouts, {paymentIntentId: match[1]}]});
    },
    export: current,
  };
}
