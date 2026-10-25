import type { Currency } from "./currency";
import type { Prices } from "./types";

export const PRICE_MESSAGES: Record<string, { unavailable: string; retry: string }> = {
  fr: { unavailable: "Les prix sont temporairement indisponibles.", retry: "Réessayer" },
  en: { unavailable: "Prices are temporarily unavailable.", retry: "Try again" },
  de: { unavailable: "Die Preise sind vorübergehend nicht verfügbar.", retry: "Erneut versuchen" },
  es: { unavailable: "Los precios no están disponibles temporalmente.", retry: "Reintentar" },
  it: { unavailable: "I prezzi sono temporaneamente non disponibili.", retry: "Riprova" },
  nl: { unavailable: "De prijzen zijn tijdelijk niet beschikbaar.", retry: "Opnieuw proberen" },
  pt: { unavailable: "Os preços estão temporariamente indisponíveis.", retry: "Tentar novamente" },
  pl: { unavailable: "Ceny są chwilowo niedostępne.", retry: "Spróbuj ponownie" },
  sv: { unavailable: "Priserna är tillfälligt otillgängliga.", retry: "Försök igen" },
  da: { unavailable: "Priserne er midlertidigt utilgængelige.", retry: "Prøv igen" },
};

/** One bounded attempt. A visible retry is preferable to an infinite spinner. */
export async function loadProductPrices(
  currency: Currency,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<Prices> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Prices timed out")), 8000);
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) cancel();
  });
  try {
    return await Promise.race([read(), cancelled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", onAbort);
  }

  async function read(): Promise<Prices> {
    const response = await fetcher(`/api/prices?currency=${currency}`, { signal: controller.signal });
    if (!response.ok) throw new Error("Prices unavailable");
    const prices: unknown = await response.json();
    const fields: (keyof Prices)[] = ["base", "fullbodyExtra", "extraPerson", "extraAnimal", "digital", "canvas", "poster", "posterSimple", "banner", "extraDecor", "express", "carteVoeux", "calendrier", "shipping"];
    if (!prices || typeof prices !== "object" || fields.some((field) => {
      const value = (prices as Record<string, unknown>)[field];
      return typeof value !== "number" || !Number.isFinite(value) || value < 0;
    })) throw new Error("Invalid prices");
    return prices as Prices;
  }
}
