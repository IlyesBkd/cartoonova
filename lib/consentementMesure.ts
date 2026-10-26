export type ChoixMesure = "granted" | "denied" | "pending";
const CLE = "cartoonova_consent_v1";
const MARQUEUR = "cn-consent";
let choixMemoire: ChoixMesure = "pending";
let prioriteMemoire = false;
const observateurs = new Set<(choix: ChoixMesure) => void>();
let ecoute = false;
export function observerChoixMesure(observateur: (choix: ChoixMesure) => void): () => void {
  observateurs.add(observateur);
  if (!ecoute && typeof window !== "undefined") {
    ecoute = true;
    window.addEventListener("storage", (event) => {
      if (event.storageArea !== localStorage || (event.key !== CLE && event.key !== null)) return;
      // A storage removal/clear is a withdrawal, never the old in-memory grant.
      const choix = event.newValue === "granted" || event.newValue === "denied" ? event.newValue : "pending";
      if (prioriteMemoire && choix === "granted") return;
      choixMemoire = choix;
      for (const notifier of observateurs) notifier(choix);
    });
  }
  return () => { observateurs.delete(observateur); };
}

// A withdrawal must survive a controlled reload even when ALL Storage writes
// throw. This fragment never grants consent and is never sent to the server.
function marquerRetrait(choix: ChoixMesure): void {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (choix === "granted") hash.delete(MARQUEUR);
  else hash.set(MARQUEUR, choix);
  url.hash = hash.toString();
  window.history.replaceState(window.history.state, "", url);
}

let rechargement = false;
/** Unload third-party code; removing a script alone cannot stop its timers. */
export function rechargerSansMesure(choix: ChoixMesure = lireChoixMesure()): void {
  if (rechargement || typeof window === "undefined" || choix === "granted") return;
  marquerRetrait(choix);
  rechargement = true;
  window.location.reload();
  // Deduplicate synchronous observers, not future attempts: beforeunload can
  // cancel navigation and leave this document alive (including preferences).
  window.setTimeout(() => { rechargement = false; }, 0);
}

/** Fail closed; an unpersisted local withdrawal beats stale readable storage. */
export function lireChoixMesure(): ChoixMesure {
  if (typeof window === "undefined") return "pending";
  if (prioriteMemoire) return choixMemoire;
  const marqueur = new URLSearchParams(window.location.hash.slice(1)).get(MARQUEUR);
  if (marqueur === "denied" || marqueur === "pending") return marqueur;
  try {
    const valeur = localStorage.getItem(CLE);
    return valeur === "granted" || valeur === "denied" || valeur === "pending" ? valeur : "pending";
  } catch { return choixMemoire; }
}
export function enregistrerChoixMesure(choix: ChoixMesure): void {
  choixMemoire = choix;
  prioriteMemoire = true;
  try { localStorage.setItem(CLE, choix); prioriteMemoire = false; }
  catch { /* Keep this page's choice, never resurrect the old stored grant. */ }
  marquerRetrait(prioriteMemoire ? choix : "granted");
  for (const notifier of observateurs) notifier(choix);
}
