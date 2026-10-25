import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { alerteDiscord, COULEUR_ALERTE, COULEUR_ATTENTION } from "@/lib/discord";
import { findOrderByCustomerEmail, sql } from "@/lib/db";
import { mesureServeur } from "@/lib/analyticsServeur";
import { MESURES } from "@/lib/evenementsMesure";

/* Retours de Resend sur chaque e-mail envoye.

   On savait qu'un e-mail etait parti, jamais s'il etait arrive. Un client qui
   tape « gmial.com » ne recoit ni sa confirmation, ni son apercu, ni son
   portrait — et personne ne le savait. Ici, un refus ou un signalement spam
   part sur Discord avec la commande concernee, et tout est compte dans PostHog.

   Authentification : signature Svix obligatoire avec RESEND_WEBHOOK_SECRET.
   Une cle dans l'URL ne constitue jamais une authentification. */

export const dynamic = "force-dynamic";

function egal(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signature Svix obligatoire (format des webhooks Resend). */
function signatureValide(req: NextRequest, corps: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("svix-id"), horodatage = req.headers.get("svix-timestamp"), signatures = req.headers.get("svix-signature");
  if (!id || !horodatage || !signatures) return false;
  const timestamp = Number(horodatage);
  if (!/^\d+$/.test(horodatage) || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const cle = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const attendu = createHmac("sha256", cle).update(`${id}.${horodatage}.${corps}`).digest("base64");
  return signatures.split(/\s+/).some((s) => s.startsWith("v1,") && egal(s.slice(3), attendu));
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

  // Claim durable AVANT tout effet externe. Ne jamais supprimer/reprendre un
  // claim : un crash peut survenir apres acceptation distante (at-most-once).
  const id = req.headers.get("svix-id")!;
  let claimed = false;
  try {
    const claim = await sql`
      INSERT INTO resend_webhook_events (svix_id) VALUES (${id})
      ON CONFLICT (svix_id) DO NOTHING RETURNING svix_id
    `;
    if (!claim.length) return NextResponse.json({ ok: true, duplicate: true });
    claimed = true;

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

    await sql`UPDATE resend_webhook_events SET status = 'completed', completed_at = now() WHERE svix_id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch {
    if (claimed) {
      // Ne jamais liberer le claim, meme si l'echec a precede certains effets.
      try {
        await sql`UPDATE resend_webhook_events SET status = 'failed' WHERE svix_id = ${id} AND status = 'processing'`;
      } catch {
        // Base indisponible : le claim processing reste definitivement reserve.
      }
    }
    return NextResponse.json({ error: "Traitement indisponible." }, { status: 503 });
  }
}
