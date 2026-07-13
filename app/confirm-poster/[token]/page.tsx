import { getOrderByConfirmationToken } from "@/lib/db";
import { getLangFromCountry, posterConfirmationPage } from "@/lib/email-i18n";
import ConfirmClient from "./ConfirmClient";

export default async function ConfirmPosterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderByConfirmationToken(token);

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center space-y-2">
          <h1 className="text-xl font-black text-black">Lien invalide ou expiré</h1>
          <p className="text-sm text-black/70">
            Ce lien de confirmation n&apos;est plus valide. Contactez-nous à info.cartoonova@gmail.com avec votre numéro de commande.
          </p>
          <hr className="border-black/10 my-2" />
          <h1 className="text-xl font-black text-black">Invalid or expired link</h1>
          <p className="text-sm text-black/70">
            This confirmation link is no longer valid. Contact us at info.cartoonova@gmail.com with your order number.
          </p>
        </div>
      </div>
    );
  }

  const lang = getLangFromCountry(order.detected_country);
  const t = posterConfirmationPage[lang];
  const ref = order.id.slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-black text-black uppercase">{t.heading(ref)}</h1>
            <p className="text-sm text-black/70 mt-2">{t.description}</p>
          </div>

          {order.final_image_url && (
            <img
              src={order.final_image_url}
              alt="Cartoonova poster"
              className="w-full rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
          )}

          <ConfirmClient
            token={token}
            lang={lang}
            initialStatus={order.poster_confirmation_status}
            respondedAt={order.poster_confirmation_responded_at}
          />
        </div>
      </div>
    </div>
  );
}
