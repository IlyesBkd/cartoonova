import { getOrderByConfirmationToken } from "@/lib/db";
import { posterConfirmationPage, langueCommande } from "@/lib/email-i18n";
import ConfirmClient from "./ConfirmClient";

export default async function ConfirmPosterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderByConfirmationToken(token);

  /* Lien inconnu : langue inconnue, donc francais puis anglais, avec les
     textes traduits et le meme gabarit que les autres pages apres-vente. */
  if (!order) {
    const fr = posterConfirmationPage.fr;
    const en = posterConfirmationPage.en;
    return (
      <main className="suivi">
        <div className="suivi__carte suivi__carte--vide">
          <h1>{fr.invalidTitle}</h1>
          <p>{fr.invalidBody}</p>
          <hr />
          <h1>{en.invalidTitle}</h1>
          <p>{en.invalidBody}</p>
        </div>
      </main>
    );
  }

  const lang = langueCommande(order);
  const t = posterConfirmationPage[lang];
  const ref = order.id.slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-black text-black uppercase">{t.heading(ref)}</h1>
            <p className="text-sm text-black/70 mt-2">{t.description}</p>
          </div>

          {order.final_image_url && (
            <img
              src={order.final_image_url}
              alt="Cartoonova poster"
              className="w-full rounded-xl"
            />
          )}

          <ConfirmClient
            token={token}
            lang={lang}
            initialStatus={order.poster_confirmation_status}
            respondedAt={order.poster_confirmation_responded_at}
            initialNote={order.poster_confirmation_note}
            initialPhotos={
              order.poster_confirmation_status !== "changes_requested"
                ? []
                : typeof order.poster_confirmation_photos === "string"
                ? JSON.parse(order.poster_confirmation_photos)
                : order.poster_confirmation_photos ?? []
            }
          />
        </div>
      </div>
    </div>
  );
}
