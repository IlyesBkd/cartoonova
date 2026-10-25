import { diagnosticJournal } from "@/lib/confidentialiteMesure";
/**
 * Bon de remerciement apres un avis (14 octobre 2026).
 *
 * Le site n'avait aucun avis reel. Un petit bon contre un avis, POSITIF OU
 * NEGATIF, est autorise ; le reserver aux bonnes notes ne l'est pas (et
 * fausserait la moyenne). Il est donc offert des que l'avis est depose sur une
 * commande reconnue (lien signe de l'e-mail), quelle que soit la note.
 *
 * Une seule fois par commande : la cle `avis:<commande>` est unique dans
 * `promo_codes` (`creerBonOffert` renvoie null si le bon existe deja).
 * Dans la devise de la commande, sinon la caisse le refuserait.
 * Ne leve jamais : un bon perdu ne doit pas faire echouer le depot de l'avis.
 */
import { creerBonOffert, formatMontant } from "./bonCadeau";
import { deviseValide } from "./bonCadeauMontants";
import { convertPrice, type Currency } from "./currency";
import { getOrderById } from "./db";
import { langueCommande, type Lang } from "./email-i18n";

export const RECOMPENSE_AVIS_EUR = 3;

function montantAvis(devise: Currency): number {
  return devise === "EUR" ? RECOMPENSE_AVIS_EUR : convertPrice(RECOMPENSE_AVIS_EUR, devise);
}

/** Le montant du bon, formate dans la devise et la langue de la commande. */
export function recompenseAvisFormatee(devise: unknown, lang: Lang): string {
  const d = deviseValide(devise) ?? "EUR";
  return formatMontant(montantAvis(d), d, lang);
}

const TEXTES: Record<Lang, { sujet: (v: string) => string; titre: string; intro: (v: string) => string }> = {
  fr: { sujet: (v) => `Merci pour ton avis : ton bon de ${v}`, titre: "Merci pour ton avis", intro: (v) => `Comme promis, voici ton bon de ${v} pour ta prochaine commande. Merci d'avoir pris le temps.` },
  en: { sujet: (v) => `Thanks for your review: your ${v} voucher`, titre: "Thank you for your review", intro: (v) => `As promised, here is your ${v} voucher for your next order. Thank you for taking the time.` },
  de: { sujet: (v) => `Danke für deine Bewertung: dein Gutschein über ${v}`, titre: "Danke für deine Bewertung", intro: (v) => `Wie versprochen: dein Gutschein über ${v} für deine nächste Bestellung. Danke, dass du dir die Zeit genommen hast.` },
  es: { sujet: (v) => `Gracias por tu opinión: tu vale de ${v}`, titre: "Gracias por tu opinión", intro: (v) => `Como prometimos, aquí tienes tu vale de ${v} para tu próximo pedido. Gracias por dedicarnos tu tiempo.` },
  it: { sujet: (v) => `Grazie per la recensione: il tuo buono da ${v}`, titre: "Grazie per la tua recensione", intro: (v) => `Come promesso, ecco il tuo buono da ${v} per il prossimo ordine. Grazie per il tuo tempo.` },
  nl: { sujet: (v) => `Bedankt voor je review: je tegoedbon van ${v}`, titre: "Bedankt voor je review", intro: (v) => `Zoals beloofd: je tegoedbon van ${v} voor je volgende bestelling. Bedankt dat je de tijd nam.` },
  pt: { sujet: (v) => `Obrigado pela tua opinião: o teu vale de ${v}`, titre: "Obrigado pela tua opinião", intro: (v) => `Como prometido, aqui está o teu vale de ${v} para a próxima encomenda. Obrigado pelo teu tempo.` },
  pl: { sujet: (v) => `Dziękujemy za opinię: Twój bon na ${v}`, titre: "Dziękujemy za opinię", intro: (v) => `Zgodnie z obietnicą: Twój bon na ${v} na następne zamówienie. Dziękujemy, że poświęciłeś czas.` },
  sv: { sujet: (v) => `Tack för ditt omdöme: ditt presentkort på ${v}`, titre: "Tack för ditt omdöme", intro: (v) => `Som utlovat: här är ditt presentkort på ${v} till nästa beställning. Tack för att du tog dig tid.` },
  da: { sujet: (v) => `Tak for din anmeldelse: dit gavekort på ${v}`, titre: "Tak for din anmeldelse", intro: (v) => `Som lovet: her er dit gavekort på ${v} til din næste bestilling. Tak fordi du tog dig tid.` },
};

/** Offre le bon de remerciement pour l'avis depose sur cette commande. */
export async function recompenserAvis(orderId: string): Promise<void> {
  try {
    const order = await getOrderById(orderId);
    if (!order?.customer_email) return;
    const lang = langueCommande(order);
    const devise = deviseValide(order.currency) ?? "EUR";
    const t = TEXTES[lang];
    await creerBonOffert({
      email: order.customer_email,
      montant: montantAvis(devise),
      devise,
      raison: `Avis déposé sur la commande ${orderId.slice(0, 8)}`,
      lang,
      cle: `avis:${orderId}`,
      textes: (valeur) => ({ sujet: t.sujet(valeur), titre: t.titre, intro: t.intro(valeur) }),
    });
  } catch (erreur) {
    console.error("[avis] bon de remerciement impossible pour", orderId, diagnosticJournal(erreur));
  }
}
