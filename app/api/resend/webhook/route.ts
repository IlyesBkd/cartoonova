import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { alerteDiscord, COULEUR_ALERTE, COULEUR_ATTENTION } from "@/lib/discord";
import { findOrderByCustomerEmail } from "@/lib/db";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";

/* Retours de Resend sur chaque e-mail envoye.

   On savait qu'un e-mail etait parti, jamais s'il etait arrive. Un client qui
   tape « gmial.com » ne recoit ni sa confirmation, ni son apercu, ni son
   portrait — et personne ne le savait. Ici, un refus ou un signalement spam
   part sur Discord avec la commande concernee, et tout est compte dans PostHog.

   Authentification : cle dans l'URL, derivee de CRON_SECRET (aucun secret de
   plus a configurer chez Vercel). Si RESEND_WEBHOOK_SECRET est un jour pose,
   la signature Svix de Resend est verifiee en plus. */

export const dynamic = "force-dynamic";

/** Cle attendue dans `?cle=` : derivee, jamais le secret lui-meme. */
function cleWebhookResend(): string | null {
  const secret = process.env.CRON_SECRET;
  return secret ? createHash("sha256").update(`${secret}:resend-webhook`).digest("hex").slice(0, 40) : null;
}

function egal(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signature Svix (format des webhooks Resend), si le secret est configure. */
function signatureValide(req: NextRequest, corps: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;
  const id = req.headers.get("svix-id"), horodatage = req.headers.get("svix-timestamp"), signatures = req.headers.get("svix-signature");
  if (!id || !horodatage || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(horodatage)) > 300) return false;
  const cle = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const attendu = createHmac("sha256", cle).update(`${id}.${horodatage}.${corps}`).digest("base64");
  return signatures.split(" ").some((s) => egal(s.split(",")[1] ?? "", attendu));
}

interface EvenementResend {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
}

export async function POST(req: NextRequest) {
  const attendue = cleWebhookResend();
  const recue = req.nextUrl.searchParams.get("cle") ?? "";
  if (!attendue || !egal(recue, attendue)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const corps = await req.text();
  if (!signatureValide(req, corps)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let ev: EvenementResend;
  try {
    ev = JSON.parse(corps);
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const destinataire = (Array.isArray(ev.data?.to) ? ev.data?.to[0] : ev.data?.to) ?? "";
  const sujet = ev.data?.subject ?? "";
  const proprietes = { sujet: sujet.slice(0, 120), email_id: ev.data?.email_id ?? null };

  const nomEvenement =
    ev.type === "email.delivered" ? MESURES.emailDistribue
    : ev.type === "email.bounced" ? MESURES.emailRefuse
    : ev.type === "email.complained" ? MESURES.emailSpam
    : ev.type === "email.delivery_delayed" ? MESURES.emailRetarde
    : null;
  if (!nomEvenement || !destinataire) return NextResponse.json({ ignore: ev.type ?? null });

  await mesureServeur(nomEvenement, {
    identifiant: destinataire,
    proprietes: { ...proprietes, bounce_type: ev.data?.bounce?.type ?? null },
  });

  /* Refus, spam ou retard : quelqu'un doit agir (corriger l'adresse, renvoyer
     par un autre moyen). La commande la plus recente de l'adresse est jointe. */
  if (ev.type !== "email.delivered") {
    const commande = await findOrderByCustomerEmail(destinataire).catch(() => null);
    const titres: Record<string, string> = {
      "email.bounced": "📭 E-mail refusé : le client ne l'a pas reçu",
      "email.complained": "🚫 E-mail signalé comme spam",
      "email.delivery_delayed": "⏳ E-mail retardé",
    };
    await alerteDiscord({
      titre: titres[ev.type ?? ""] ?? `E-mail : ${ev.type}`,
      couleur: ev.type === "email.delivery_delayed" ? COULEUR_ATTENTION : COULEUR_ALERTE,
      champs: [
        { name: "Destinataire", value: destinataire, inline: true },
        { name: "Commande", value: commande ? `#${String(commande.id).slice(0, 8)}` : "aucune", inline: true },
        { name: "Sujet", value: sujet.slice(0, 200) || "?" },
        ...(ev.data?.bounce?.message
          ? [{ name: "Motif", value: `${ev.data.bounce.type ?? ""} ${ev.data.bounce.subType ?? ""} — ${ev.data.bounce.message}`.slice(0, 500) }]
          : []),
      ],
      piedDePage: "Vérifier l'adresse dans l'admin et renvoyer si besoin",
    });
  }

  return NextResponse.json({ ok: true });
}
