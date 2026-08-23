import type { Metadata } from "next";
import { getOrderById } from "@/lib/db";
import type { DbOrder } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { getLangFromCountry, orderTrackingPage, type EtapeSuivi } from "@/lib/email-i18n";
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

/** Etape atteinte, deduite de ce que la commande porte deja. */
function etapeAtteinte(order: DbOrder): EtapeSuivi {
  if (order.final_image_sent_at) return "envoyee";
  if (order.poster_confirmation_sent_at) return "apercu";
  return "dessin";
}

const ORDRE: EtapeSuivi[] = ["recue", "dessin", "apercu", "envoyee"];

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
  const indexCourant = ORDRE.indexOf(courante);
  const photos = Array.isArray(order.photo_urls) ? order.photo_urls.length : 0;
  const date = new Date(order.created_at).toLocaleDateString(lang, {
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

        {/* ─── Avancement ─── */}
        <ol className="suivi__etapes">
          {ORDRE.map((cle, i) => {
            const etat = i < indexCourant ? "faite" : i === indexCourant ? "courante" : "avenir";
            return (
              <li key={cle} className={`suivi__etape suivi__etape--${etat}`}>
                <span className="suivi__puce" aria-hidden="true" />
                <div>
                  <b>{t.steps[cle].title}</b>
                  <p>{t.steps[cle].body}</p>
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
