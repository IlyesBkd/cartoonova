import type { Metadata } from "next";
import { getOrderById } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { getLangFromCountry, depotPhotosPage } from "@/lib/email-i18n";
import DepotClient from "./DepotClient";

/**
 * Depot des photos apres paiement.
 *
 * La photo n'est plus exigee avant de payer : sur trente jours, dix visiteurs
 * configuraient un portrait et trois seulement en envoyaient une. Le client
 * paie, recoit ce lien avec sa confirmation, et depose quand il a ses photos
 * sous la main.
 *
 * Le jeton est celui de la page de suivi — identifiant plus signature HMAC,
 * calcule et non stocke (`lib/emailToken.ts`). Aucune colonne, aucune
 * expiration a gerer, et essayer des identifiants ne mene nulle part.
 */

/* Une page qu'on atteint par un lien prive n'a rien a faire dans un index. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DepotPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const orderId = parseOrderTrackingToken(token);
  const order = orderId ? await getOrderById(orderId) : null;

  /* La langue vient du pays detecte a la commande, comme pour les e-mails :
     ce lien arrive par courrier, hors du prefixe de langue du site. */
  const lang = getLangFromCountry(order?.detected_country ?? null);
  const t = depotPhotosPage[lang];

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 text-center space-y-2">
          <h1 className="text-xl font-black text-black">{t.invalidTitle}</h1>
          <p className="text-sm text-black/70">{t.invalidBody}</p>
        </div>
      </div>
    );
  }

  const dejaRecues = Array.isArray(order.photo_urls) && order.photo_urls.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-black text-black uppercase">
              {dejaRecues ? t.alreadyTitle : t.heading}
            </h1>
            <p className="text-sm text-black/70 mt-2">
              {dejaRecues ? t.alreadyBody : t.description(order.id.slice(0, 8))}
            </p>
          </div>

          {/* Les photos deja recues restent visibles : le client qui revient
              doit voir ce que nous avons avant de decider d'en renvoyer. */}
          {dejaRecues && (
            <div className="grid grid-cols-3 gap-2">
              {(order.photo_urls as string[]).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
              ))}
            </div>
          )}

          <DepotClient token={token} lang={lang} />
        </div>
      </div>
    </div>
  );
}
