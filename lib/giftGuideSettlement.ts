import {validateGuideJournal, type GuideJournal} from "./giftGuideAttribution";
import {measureGiftGuide} from "./giftGuideMeasurement";
/** Supplied by a trusted offline export, NOT browser events or a client success page.
 * Null means unknown. taxNetMinor is tax retained AFTER refunds; variableCostMinor
 * includes actual processing/production/shipping/labour costs, not a tariff guess. */
export type GuideSettlement = {
  source: "authoritative-payment-export"; paymentIntentId: string; orderId: string;
  status: "succeeded" | "pending" | "failed"; paidAt: string | null;
  currency: string; receivedMinor: number; refundedMinor: number | null;
  taxNetMinor: number | null; variableCostMinor: number | null;
};
const safeAmount = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const identifier = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
export function settleGiftGuide(input: {journals: unknown[]; payments: GuideSettlement[]}) {
  const journals = new Map<string, GuideJournal>();
  const assignments = new Map<string, string>();
  for (const raw of input.journals) {
    const j = validateGuideJournal(raw);
    if (!j) throw Error("Invalid or unauthorized journal");
    const previous = journals.get(j.sessionId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(j)) throw Error("Conflicting session snapshot");
    journals.set(j.sessionId, j);
    for (const c of j.checkouts) {
      if (assignments.has(c.paymentIntentId) && assignments.get(c.paymentIntentId) !== j.sessionId) throw Error("Ambiguous payment attribution");
      assignments.set(c.paymentIntentId, j.sessionId);
    }
  }
  const payments = new Map<string, GuideSettlement>();
  const orderIds = new Map<string, string>();
  for (const p of input.payments) {
    if (p.source !== "authoritative-payment-export" || !/^pi_[a-zA-Z0-9]{1,100}$/.test(p.paymentIntentId)
      || !identifier(p.orderId) || !["succeeded", "pending", "failed"].includes(p.status) || !/^[A-Z]{3}$/.test(p.currency)
      || !safeAmount(p.receivedMinor) || [p.refundedMinor, p.taxNetMinor, p.variableCostMinor].some(v => v !== null && !safeAmount(v))
      || (p.refundedMinor !== null && p.refundedMinor > p.receivedMinor)
      || (p.taxNetMinor !== null && p.refundedMinor !== null && p.taxNetMinor > p.receivedMinor - p.refundedMinor)
      || (p.status === "succeeded" && (p.receivedMinor === 0 || typeof p.paidAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(p.paidAt) || !Number.isFinite(Date.parse(p.paidAt))))) throw Error("Invalid authoritative settlement");
    const previous = payments.get(p.paymentIntentId);
    const fields = ["orderId", "status", "paidAt", "currency", "receivedMinor", "refundedMinor", "taxNetMinor", "variableCostMinor"] as const;
    if (previous && fields.some(k => previous[k] !== p[k])) throw Error("Conflicting settlement snapshot");
    if (orderIds.has(p.orderId) && orderIds.get(p.orderId) !== p.paymentIntentId) throw Error("Ambiguous order payment");
    payments.set(p.paymentIntentId, p); orderIds.set(p.orderId, p.paymentIntentId);
  }
  const orders = [...payments.values()].map(p => ({orderId: p.orderId, sessionId: assignments.get(p.paymentIntentId) ?? "unattributed",
    paid: p.status === "succeeded", currency: p.currency,
    netRevenueMinor: p.refundedMinor === null || p.taxNetMinor === null ? null : p.receivedMinor - p.refundedMinor - p.taxNetMinor,
    variableCostMinor: p.variableCostMinor}));
  const measurement = measureGiftGuide({sessions: [...journals.values()], orders});
  const funnel = (["control", "guided-v1"] as const).flatMap(cohort => {
    const rows = [...journals.values()].filter(j => j.cohort === cohort);
    return rows.length ? [{cohort, assignedSessions: rows.length, viewedSessions: rows.filter(j => j.events.includes("viewed")).length,
      exposedSessions: rows.filter(j => j.events.includes("exposed")).length, clickedSessions: rows.filter(j => j.events.includes("clicked")).length}] : [];
  });
  const refunds = measurement.groups.map(g => {
    const rows = [...payments.values()].filter(p => p.status === "succeeded" && p.currency === g.currency
      && journals.get(assignments.get(p.paymentIntentId) ?? "")?.cohort === g.cohort);
    const unknownRefundOrders = rows.filter(p => p.refundedMinor === null).length;
    const refundedMinor = unknownRefundOrders ? null : rows.reduce((n, p) => n + p.refundedMinor!, 0);
    if (refundedMinor !== null && !Number.isSafeInteger(refundedMinor)) throw Error("Refund total overflow");
    const refundedOrders = unknownRefundOrders ? null : rows.filter(p => p.refundedMinor! > 0).length;
    return {cohort: g.cohort, currency: g.currency, paidOrders: rows.length, refundedMinor, refundedOrders,
      refundOrderRate: refundedOrders === null ? null : refundedOrders / rows.length,
      unknownRefundOrders, unknownTaxOrders: rows.filter(p => p.taxNetMinor === null).length,
      unknownCostOrders: rows.filter(p => p.variableCostMinor === null).length};
  });
  return {contractVersion: 1, inference: "local_observational_no_causal_uplift", measurement, funnel, refunds};
}
