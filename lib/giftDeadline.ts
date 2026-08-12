// Delai reel annonce partout sur le site : 24 h de dessin, puis 3 a 5 jours
// ouvres d'impression et livraison. On prend la borne haute pour une date
// cadeau : mieux vaut arriver en avance qu'en retard.
export const DRAWING_BUSINESS_DAYS = 1;
export const PRINT_SHIPPING_BUSINESS_DAYS = 5;
export const TOTAL_BUSINESS_DAYS = DRAWING_BUSINESS_DAYS + PRINT_SHIPPING_BUSINESS_DAYS;

// Combien de temps avant la date limite on commence a afficher le rappel.
const WINDOW_DAYS = 35;

export type SeasonalEventKey = "christmas" | "valentines";

interface SeasonalEventDef {
  key: SeasonalEventKey;
  month: number; // 1-12
  day: number;
}

// Uniquement des dates fixes et communes aux 5 marches. La fete des meres et
// des peres tombe a des dates differentes selon les pays : l'ajouter ici
// donnerait une date fausse pour au moins un marche.
const SEASONAL_EVENTS: SeasonalEventDef[] = [
  { key: "christmas", month: 12, day: 25 },
  { key: "valentines", month: 2, day: 14 },
];

/** Retire `days` jours ouvres (samedi/dimanche exclus, jours feries non geres). */
export function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return result;
}

/** Derniere date de commande pour esperer une reception avant `target`. */
export function getOrderByDate(target: Date): Date {
  return subtractBusinessDays(target, TOTAL_BUSINESS_DAYS);
}

function nextOccurrence(event: SeasonalEventDef, now: Date): Date {
  const target = new Date(now.getFullYear(), event.month - 1, event.day, 23, 59, 59);
  if (target.getTime() < now.getTime()) {
    target.setFullYear(target.getFullYear() + 1);
  }
  return target;
}

export interface ActiveSeasonalEvent {
  key: SeasonalEventKey;
  targetDate: Date;
  orderByDate: Date;
}

/**
 * Evenement a mettre en avant maintenant, ou null hors periode.
 * La fenetre s'arrete le jour de la date limite de commande : passe cette date,
 * annoncer une livraison a temps serait une promesse qu'on ne peut pas tenir.
 */
export function getActiveSeasonalEvent(now: Date = new Date()): ActiveSeasonalEvent | null {
  let best: ActiveSeasonalEvent | null = null;

  for (const event of SEASONAL_EVENTS) {
    const targetDate = nextOccurrence(event, now);
    const orderByDate = getOrderByDate(targetDate);
    const windowStart = new Date(orderByDate.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    if (now >= windowStart && now <= orderByDate) {
      if (!best || orderByDate < best.orderByDate) {
        best = { key: event.key, targetDate, orderByDate };
      }
    }
  }

  return best;
}
