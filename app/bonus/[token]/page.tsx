import type { Metadata } from "next";
import { getOrderById } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { bonusPage, getLangFromCountry } from "@/lib/email-i18n";
import { infosParrainage } from "@/lib/parrainage";
import { parrainageTextes } from "@/lib/i18n/relances";
import BonusClient from "./BonusClient";

/* Les cadeaux offerts avec chaque portrait : fond d'ecran, avatar rond, carte
   a imprimer. Tout est fabrique dans le navigateur a partir du portrait final
   — aucune dependance d'image ni de PDF cote serveur.

   Meme jeton que /suivi, meme regle de langue (pays detecte a la commande). */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function BonusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const orderId = parseOrderTrackingToken(decodeURIComponent(token));
  const order = orderId ? await getOrderById(orderId) : null;

  if (!order || order.status === "PENDING") {
    const t = bonusPage.fr;
    const en = bonusPage.en;
    return (
      <main className="suivi">
        <div className="suivi__carte suivi__carte--vide">
          <h1>{t.invalidTitle}</h1>
          <p>{t.invalidBody}</p>
          <hr />
          <h1>{en.invalidTitle}</h1>
          <p>{en.invalidBody}</p>
        </div>
      </main>
    );
  }

  const lang = getLangFromCountry(order.detected_country);
  const t = bonusPage[lang];

  if (!order.final_image_url || !order.final_image_sent_at) {
    return (
      <main className="suivi">
        <div className="suivi__carte suivi__carte--vide">
          <h1>{t.notReadyTitle}</h1>
          <p>{t.notReadyBody}</p>
        </div>
      </main>
    );
  }

  /* Le code ami, cree au besoin (meme code que dans l'e-mail de livraison).
     Sans base joignable, la page des cadeaux s'affiche quand meme, sans la
     carte de parrainage. */
  const tp = parrainageTextes[lang];
  const parrainage = await infosParrainage(order.customer_email, lang)
    .then(({ code, recompense }) => ({
      code,
      titre: tp.titre,
      offre: tp.offre(recompense),
      etiquette: tp.code,
      copier: tp.copier,
      copie: tp.copie,
    }))
    .catch((erreur: unknown) => {
      console.error("[bonus] code de parrainage indisponible:", order.id, erreur);
      return null;
    });

  return <BonusClient token={token} lang={lang} ref8={order.id.slice(0, 8)} parrainage={parrainage} />;
}
