import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const {
      paymentIntentId,
      email,
      firstName,
      lastName,
      address,
      city,
      postalCode,
      country,
      phone,
      format,
      people,
      animals,
      background,
      printOption,
      total,
      currency,
      description,
      photoUrls,
      style,
    } = await req.json();

    if (!paymentIntentId || !email) {
      return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
    }

    const customerName = [firstName, lastName].filter(Boolean).join(" ") || null;

    const options = JSON.stringify({
      format,
      people,
      animals,
      background,
      printOption,
      style: style || null,
      description,
      phone: phone || null,
      postalCode: postalCode || null,
      city: city || null,
      country: country || null,
    });

    const photoUrlsJson = JSON.stringify(photoUrls || []);

    const rows = await sql`
      INSERT INTO orders (
        payment_intent_id, customer_email, customer_name, customer_address,
        total_price, currency, options, photo_urls, status
      ) VALUES (
        ${paymentIntentId},
        ${email},
        ${customerName},
        ${address || null},
        ${total},
        ${(currency || "EUR").toUpperCase()},
        ${options}::jsonb,
        ${photoUrlsJson}::jsonb,
        'PENDING'
      )
      RETURNING id
    `;

    const orderId = rows[0]?.id;
    console.log(`✅ Commande ${orderId} créée en PENDING | PI: ${paymentIntentId}`);

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("DB insert error:", error);
    return NextResponse.json({ error: "Erreur création commande." }, { status: 500 });
  }
}
