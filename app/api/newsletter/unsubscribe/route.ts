import { NextRequest, NextResponse } from "next/server";
import { unsubscribeFromNewsletter } from "@/lib/db";
import { verifyEmailToken } from "@/lib/emailToken";
import { getLangFromCountry, LANGS, type Lang } from "@/lib/email-i18n";

export const dynamic = "force-dynamic";

const CONFIRMATION: Record<Lang, { title: string; body: string }> = {
  fr: {
    title: "C'est fait",
    body: "Vous ne recevrez plus d'emails marketing de Cartoonova. Les emails liés à une commande en cours continuent d'arriver.",
  },
  en: {
    title: "Done",
    body: "You won't receive marketing emails from Cartoonova anymore. Emails about an ongoing order still come through.",
  },
  es: {
    title: "Hecho",
    body: "Ya no recibirás emails de marketing de Cartoonova. Los emails sobre un pedido en curso siguen llegando.",
  },
  de: {
    title: "Erledigt",
    body: "Sie erhalten keine Marketing-E-Mails von Cartoonova mehr. E-Mails zu einer laufenden Bestellung kommen weiterhin an.",
  },
  it: {
    title: "Fatto",
    body: "Non riceverai più email di marketing da Cartoonova. Le email relative a un ordine in corso continuano ad arrivare.",
  },
  nl: {
    title: "Gebeurd",
    body: "Je krijgt geen marketingmails meer van Cartoonova. Mails over een lopende bestelling blijven wel komen.",
  },
  pl: {
    title: "Gotowe",
    body: "Nie będziesz już dostawać maili marketingowych od Cartoonova. Maile dotyczące trwającego zamówienia nadal przychodzą.",
  },
  sv: {
    title: "Klart",
    body: "Du får inga fler marknadsmejl från Cartoonova. Mejl som rör en pågående beställning kommer fortfarande fram.",
  },
  da: {
    title: "Sådan",
    body: "Du får ikke flere markedsføringsmails fra Cartoonova. Mails om en igangværende bestilling kommer stadig frem.",
  },
  pt: {
    title: "Feito",
    body: "Deixas de receber emails de marketing da Cartoonova. Os emails sobre uma encomenda em curso continuam a chegar.",
  }
};

function page(title: string, body: string, status: number) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
     <body style="font-family:Arial,sans-serif;background:#fef3c7;margin:0;padding:40px 20px;">
       <div style="max-width:520px;margin:0 auto;background:#fff;border:4px solid #000;box-shadow:8px 8px 0 rgba(0,0,0,1);padding:32px;">
         <h1 style="font-size:24px;font-weight:900;margin:0 0 12px;color:#000;">${title}</h1>
         <p style="font-size:16px;color:#333;margin:0;">${body}</p>
       </div>
     </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const demandee = req.nextUrl.searchParams.get("lang") as Lang;
  const lang = LANGS.includes(demandee) ? demandee : getLangFromCountry(null);

  if (!email || !verifyEmailToken(email, token)) {
    return page("Lien invalide", "Ce lien de désinscription n'est pas valide.", 400);
  }

  try {
    await unsubscribeFromNewsletter(email);
    const t = CONFIRMATION[lang];
    return page(t.title, t.body, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/newsletter/unsubscribe] Error:", message);
    return page("Erreur", "La désinscription a échoué. Écrivez-nous à support@cartoonova.com.", 500);
  }
}
