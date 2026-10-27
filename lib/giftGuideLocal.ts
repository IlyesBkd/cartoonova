"use client";
import {createGiftGuideJournal} from "./giftGuideAttribution";
import {lireChoixMesure, observerChoixMesure} from "./consentementMesure";
const KEY = "cartoonova_guide_local_v1";
// Per-tab, NON-authorizing tombstone: same-origin navigation/anchors/reload
// must not expose a withdrawn but still readable Storage copy. No identifiers.
// Append/remove only our suffix, preserving any preexisting window.name verbatim.
const NAME_REVOKED = "\n[cartoonova-guide-revoked:v1]";
const REVOKED = "cn-guide-revoked"; // Read old fragment markers for compatibility.
function writableName(): string {
  const name = window.name;
  // Test an actual change too: a silently ignored setter is not persistence.
  window.name = name + NAME_REVOKED;
  if (window.name !== name + NAME_REVOKED) throw new Error("Local guide unavailable: window.name is not writable");
  window.name = name;
  if (window.name !== name) throw new Error("Local guide unavailable: window.name is not writable");
  return name;
}
function markNameRevoked(value: boolean): void {
  const name = writableName();
  const next = value ? (name.endsWith(NAME_REVOKED) ? name : name + NAME_REVOKED)
    : (name.endsWith(NAME_REVOKED) ? name.slice(0, -NAME_REVOKED.length) : name);
  window.name = next;
  if (window.name !== next) throw new Error("Local guide unavailable: window.name tombstone failed");
}
function revoked(): boolean {
  // Access failures propagate to the journal's fail-closed read/save boundary.
  const name = writableName();
  if (new URLSearchParams(window.location.hash.slice(1)).has(REVOKED)) {
    markNameRevoked(true); // Migrate historical markers before navigation loses them.
    return true;
  }
  return name.endsWith(NAME_REVOKED);
}
function markRevoked(value: boolean): void {
  const url = new URL(window.location.href);
  // Keep unrelated raw fragments intact (e.g. #configurateur, not #configurateur=).
  const parts = url.hash.slice(1).split("&").filter(part => part && !new URLSearchParams(part).has(REVOKED));
  if (value) parts.push(`${REVOKED}=1`);
  url.hash = parts.join("&");
  window.history.replaceState(window.history.state, "", url);
}
/** Literal env access remains compile-time replaceable; uncompiled fixtures fail closed. */
export function localGiftGuideServerSnapshot(): "pending" | null {
  try { return process.env.NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT === "1" ? "pending" : null; }
  catch { return null; } // No process global in a plain browser fixture.
}
/** Deliberately impossible on a public hostname, even if someone sets the flag. */
export function localGiftGuideEnabled(): boolean {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
    && localGiftGuideServerSnapshot() === "pending";
}
export const localGiftGuide = createGiftGuideJournal({
  enabled: localGiftGuideEnabled, consent: lireChoixMesure,
  read: () => revoked() ? null : JSON.parse(sessionStorage.getItem(KEY) ?? "null"),
  write: value => {
    if (!localGiftGuideEnabled()) return;
    if (value) {
      writableName(); // No collection if a navigation-safe tombstone is impossible.
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(KEY, serialized);
      if (sessionStorage.getItem(KEY) !== serialized) throw new Error("Local guide write was not durable");
      markRevoked(false);
      markNameRevoked(false); // Only a durable new generation clears our suffix.
    } else {
      markNameRevoked(true); // Must precede deletion, which may throw SecurityError.
      markRevoked(true); // Compatibility only; navigation safety does not rely on it.
      sessionStorage.removeItem(KEY);
    }
  },
  id: () => crypto.randomUUID(), random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
});
if (typeof window !== "undefined") {
  observerChoixMesure(choice => { if (choice !== "granted") localGiftGuide.revoke(); });
}
/** DevTools local export; rechecks authorization and returns no data on withdrawal. */
export function exportLocalGiftGuide() { return localGiftGuide.export(); }
export function subscribeLocalGiftGuide(listener: () => void): () => void {
  localGiftGuide.enroll();
  return observerChoixMesure(choice => {
    if (choice === "granted") localGiftGuide.enroll();
    listener();
  });
}
export function localGiftGuideCohort() {
  return localGiftGuideEnabled() ? localGiftGuide.export()?.cohort ?? null : null;
}
if (localGiftGuideEnabled()) {
  Object.defineProperty(window, "cartoonovaGiftGuideExport", {value: exportLocalGiftGuide, configurable: true});
}
