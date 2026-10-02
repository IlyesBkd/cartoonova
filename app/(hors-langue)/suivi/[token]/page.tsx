import type { Metadata } from "next";
import { getOrderById } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { bonusLiens, getLangFromCountry, orderTrackingPage } from "@/lib/email-i18n";
import { etapeAtteinte, etapesDeLaCommande, prochaineAction } from "@/lib/etapesSuivi";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";

/* Page de suivi de commande.

   Meme principe que la confirmation de poster, qui fonctionne deja bien : un
   lien signe, aucun compte a creer. Le jeton porte l'identifiant et sa
   signature — sans elle, il suffirait d'essayer des identifiants pour lire
   l'adresse et les photos d'un autre client.

   Hors de [locale] : la langue vient du pays detecte a la commande, comme pour
   les e-mails, pas du chemin d'URL. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SuiviPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const orderId = parseOrderTrackingToken(decodeURIComponent(token));
  const order = orderId ? await getOrderById(orderId) : null;

  // Une commande jamais payee n'a pas de suivi a montrer : on repond comme a un
  // lien invalide plutot que d'exposer une commande abandonnee.
  if (!order || order.status === "PENDING") {
    const t = orderTrackingPage.fr;
    const en = orderTrackingPage.en;
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
  const t = orderTrackingPage[lang];
  const ref = order.id.slice(0, 8);
  const opts = order.options;
  const courante = etapeAtteinte(order);
  const ordre = etapesDeLaCommande(order);
  const indexCourant = ordre.indexOf(courante);
  const photos = Array.isArray(order.photo_urls) ? order.photo_urls.length : 0;
  const action = prochaineAction(order);
  const dateRetouche =
    action?.type === "retouche" && action.le
      ? new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "Europe/Paris" }).format(
          new Date(action.le)
        )
      : null;
  const date =new Date(order.created_at).toLocaleDateString(lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* Mesure cote serveur : cette page arrive d'un e-mail, hors de [locale], et
     porte volontairement une coque minimale, sans fournisseur de mesure. Le
     serveur sait deja de quelle commande il s'agit — inutile d'embarquer le
     SDK pour le reapprendre.
     Ce que ce chiffre repond : le lien de suivi ajoute aux e-mails de
     confirmation est-il utilise, et epargne-t-il donc des questions au
     support ? Il avait ete ajoute pour cela, sans moyen de le verifier. */
  await mesureServeur(MESURES.suiviConsulte, {
    identifiant: order.customer_email,
    proprietes: {
      order_id: order.id,
      etape: courante,
      status: order.status,
      detected_country: order.detected_country ?? null,
    },
  });

  return (
    <main className="suivi">
      <div className="suivi__carte">
        <header className="suivi__tete">
          <h1>{t.heading(ref)}</h1>
          <p>{t.passedOn(date)}</p>
        </header>

        {/* ─── Ce qui attend le client ───
            En tete, avant les etapes : c'est la seule chose de la page qui
            depend de lui. Le jeton de suivi ouvre aussi la page de depot. */}
        {action && action.type !== "retouche" && (
          <section className="suivi__bloc suivi__action">
            <h2>{t.actionTitre}</h2>
            <p>{action.type === "photos" ? t.actionPhotosTexte : t.actionApercuTexte}</p>
            <a
              href={
                action.type === "photos"
                  ? `/depot/${encodeURIComponent(token)}`
                  : `/confirm-poster/${encodeURIComponent(order.poster_confirmation_token ?? "")}`
              }
              className="bouton bouton--primaire"
            >
              {action.type === "photos" ? t.actionPhotosBouton : t.actionApercuBouton}
            </a>
          </section>
        )}
        {action?.type === "retouche" && (
          <section className="suivi__bloc suivi__action suivi__action--info">
            <h2>{t.retoucheTitre(dateRetouche)}</h2>
            <p>{t.retoucheTexte}</p>
            {action.note && (
              <blockquote className="suivi__message">
                <span>{t.retoucheNote}</span>
                {action.note}
              </blockquote>
            )}
          </section>
        )}

        {/* ─── Avancement ─── */}
        <ol className="suivi__etapes">
          {ordre.map((cle, i) => {
            const etat = i < indexCourant ? "faite" : i === indexCourant ? "courante" : "avenir";
            return (
              <li key={cle} className={`suivi__etape suivi__etape--${etat}`}>
                <span className="suivi__puce" aria-hidden="true" />
                <div>
                  <b>{t.steps[cle].title}</b>
                  <p>{cle === "recue" && action?.type === "photos" ? t.recueSansPhotos : t.steps[cle].body}</p>
                  {cle === "expediee" && courante === "expediee" && order.suivi_url && order.suivi_url.startsWith("http") && (
                    <a href={order.suivi_url} className="bouton bouton--primaire" target="_blank" rel="noopener noreferrer">
                      {t.trackParcel}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* ─── Le portrait, une fois envoye ─── */}
        {order.final_image_url && order.final_image_sent_at && (
          <section className="suivi__bloc">
            <h2>{t.finalTitle}</h2>
            <p>{t.finalBody}</p>
            {/* Stockage blob distant : hors du domaine confie a l'optimiseur. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={order.final_image_url} alt={t.finalTitle} className="suivi__portrait" />
          </section>
        )}

        {/* ─── Les cadeaux offerts, une fois le portrait envoye ─── */}
        {order.final_image_url && order.final_image_sent_at && (
          <section className="suivi__bloc">
            <h2>{bonusLiens[lang].suiviTitre}</h2>
            <p>{bonusLiens[lang].suiviTexte}</p>
            <a href={`/bonus/${encodeURIComponent(token)}`} className="bouton bouton--primaire">
              {bonusLiens[lang].suiviBouton}
            </a>
          </section>
        )}

        {/* ─── Recapitulatif ─── */}
        <section className="suivi__bloc">
          <h2>{t.summary}</h2>
          <dl className="suivi__liste">
            <div>
              <dt>{t.format}</dt>
              <dd>{opts.format}</dd>
            </div>
            <div>
              <dt>{t.people}</dt>
              <dd>{opts.people}</dd>
            </div>
            {opts.animals > 0 && (
              <div>
                <dt>{t.animals}</dt>
                <dd>{opts.animals}</dd>
              </div>
            )}
            <div>
              <dt>{t.option}</dt>
              <dd>{opts.printOption}</dd>
            </div>
            <div>
              <dt>{t.total}</dt>
              <dd>
                {order.total_price} {order.currency}
              </dd>
            </div>
          </dl>
          {photos > 0 && <p className="suivi__photos">{t.photos(photos)}</p>}
        </section>

        {/* ─── Consignes cadeau, si la commande en porte ─── */}
        {opts.gift && (
          <section className="suivi__bloc suivi__bloc--cadeau">
            <h2>{t.giftTitle}</h2>
            <dl className="suivi__liste">
              {opts.gift.recipientEmail && (
                <div>
                  <dt>{t.giftRecipient}</dt>
                  <dd>{opts.gift.recipientEmail}</dd>
                </div>
              )}
              {opts.gift.deliverAfter && (
                <div>
                  <dt>{t.giftDeliverAfter}</dt>
                  <dd>{opts.gift.deliverAfter}</dd>
                </div>
              )}
            </dl>
            {opts.gift.message && (
              <blockquote className="suivi__message">
                <span>{t.giftMessage}</span>
                {opts.gift.message}
              </blockquote>
            )}
          </section>
        )}

        <footer className="suivi__aide">
          <b>{t.helpTitle}</b>
          <p>{t.helpBody}</p>
        </footer>
      </div>
    </main>
  );
}
