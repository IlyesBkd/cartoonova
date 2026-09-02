import { NextRequest, NextResponse } from "next/server";
import { validerOrigine } from "@/lib/origineVisite";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { consumePromoCode } from "@/lib/promoCodes";
import { parsePhotoUrls, photosInvalides } from "@/lib/orderPhotos";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";
import { toEUR } from "@/lib/currency";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

let orderPromoSchemaReady: Promise<void> | null = null;

async function ensureOrderPromoSchema(): Promise<void> {
  if (orderPromoSchemaReady) return orderPromoSchemaReady;
  orderPromoSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC`;
    /* `origine` est aussi declaree dans `lib/db.ts`, pour les lecteurs. Il faut
       qu'elle le soit ICI aussi : c'est la seule fonction de schema appelee
       avant l'insertion, et sans elle la toute premiere commande echouerait sur
       une colonne inconnue — la creation etant portee par un autre schema, qui
       n'est jamais appele sur ce chemin. Les deux sont idempotentes. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS origine JSONB`;
  })().catch((e) => {
    orderPromoSchemaReady = null;
    throw e;
  });
  return orderPromoSchemaReady;
}

export async function POST(req: NextRequest) {
  try {
    const {
      paymentIntentId,
      email,
      firstName,
      lastName,
      address,
      addressLine2,
      city,
      postalCode,
      country,
      phone,
      format,
      people,
      animals,
      background,
      printOption,
      printKey,
      description,
      photoUrls,
      style,
      detectedCountry,
      gift,
      origine,
    } = await req.json();

    if (!paymentIntentId || !email) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    /* Les photos sont nettoyees, plus exigees : la commande peut naitre sans,
       et le client les depose apres paiement par un lien signe. Ce qui reste
       verrouille, c'est leur forme — voir `lib/orderPhotos.ts`. */
    const photos = parsePhotoUrls(photoUrls);

    /* Le cookie d'origine est modifiable par le visiteur : on ne recopie que
       des champs connus et tronques. Une origine invalide devient null — on
       perd l'attribution de cette commande, on ne pollue pas la colonne. */
    const origineValidee = validerOrigine(origine);
    if (photosInvalides(photos)) {
      return NextResponse.json({ error: photos.error }, { status: 400 });
    }

    await ensureOrderPromoSchema();

    // Le montant enregistre vient de Stripe, pas du navigateur : c'est le seul
    // chiffre dont on sait qu'il correspond a ce qui a reellement ete demande
    // au client.
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const total = paymentIntent.amount / 100;
    const currency = paymentIntent.currency.toUpperCase();
    const promoCode = paymentIntent.metadata?.promo_code || null;
    const discount = Number(paymentIntent.metadata?.discount || 0) || 0;

    const customerName = [firstName, lastName].filter(Boolean).join(" ") || null;

    /* Options cadeau. Champs libres saisis par le client : on borne la
       longueur et on ne garde une date que si elle a la forme AAAA-MM-JJ,
       pour ne pas stocker n'importe quoi dans le JSON de la commande. */
    const texte = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      const propre = v.trim().slice(0, max);
      return propre || null;
    };
    const cadeau =
      gift && typeof gift === "object"
        ? {
            message: texte(gift.message, 300),
            recipientEmail: texte(gift.recipientEmail, 160),
            deliverAfter: /^\d{4}-\d{2}-\d{2}$/.test(String(gift.deliverAfter ?? ""))
              ? String(gift.deliverAfter)
              : null,
          }
        : null;
    const estCadeau = Boolean(
      cadeau && (cadeau.message || cadeau.recipientEmail || cadeau.deliverAfter)
    );

    const options = JSON.stringify({
      format,
      people,
      animals,
      background,
      printOption,
      /* Cle stable du support. `printOption` est traduit — « Digitale » en
         italien — donc il ne peut pas servir a decider si on imprime. */
      printKey: typeof printKey === "string" ? printKey : null,
      gift: estCadeau ? cadeau : null,
      style: style || null,
      description,
      phone: phone || null,
      postalCode: postalCode || null,
      city: city || null,
      country: country || null,
      addressLine2: addressLine2 || null,
    });

    // Liste nettoyee par parsePhotoUrls : doublons retires, plafond applique.
    const photoUrlsJson = JSON.stringify(photos);

    const rows = await sql`
      INSERT INTO orders (
        payment_intent_id, customer_email, customer_name, customer_address,
        total_price, currency, options, photo_urls, status, detected_country,
        promo_code, discount_amount, origine
      ) VALUES (
        ${paymentIntentId},
        ${email},
        ${customerName},
        ${address || null},
        ${total},
        ${currency},
        ${options}::jsonb,
        ${photoUrlsJson}::jsonb,
        'PENDING',
        ${detectedCountry || null},
        ${promoCode || null},
        ${discount || null},
        ${origineValidee ? JSON.stringify(origineValidee) : null}::jsonb
      )
      RETURNING id
    `;

    const orderId = rows[0]?.id;
    console.log(`✅ Commande ${orderId} créée en PENDING | PI: ${paymentIntentId}`);

    if (promoCode) {
      await consumePromoCode(promoCode).catch((error) =>
        console.error("[order/create] increment du code promo impossible:", error)
      );
    }

    /* La commande existe, le paiement n'est pas encore confirme.
       C'est le denominateur qui manquait : sans lui, un `payment_error` ne
       peut etre rapporte a rien, et l'ecart entre commandes creees et
       commandes payees — les paniers morts entre le formulaire de carte et la
       banque — reste invisible. Le rapprochement se fait sur
       `payment_intent_id`, present ici comme sur l'achat confirme. */
    await mesureServeur(MESURES.commandeCreee, {
      identifiant: email,
      proprietes: {
        order_id: orderId,
        transaction_id: paymentIntentId,
        value: total,
        currency,
        revenue_eur: toEUR(total, currency),
        style: style || null,
        format,
        people,
        animals,
        print_option: printOption,
        is_gift: estCadeau,
        promo_code: promoCode || null,
        detected_country: detectedCountry || null,
        photo_count: photos.length,
      },
    });

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("DB insert error:", error);
    return NextResponse.json({ error: "Erreur création commande." }, { status: 500 });
  }
}
