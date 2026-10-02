import { NextRequest, NextResponse } from "next/server";
import { subscribeToNewsletter } from "@/lib/db";
import { sendWelcomeStep } from "@/lib/welcomeSequence";
import { locales } from "@/i18n/config";
import { emailValide } from "@/lib/email";
import { cleDepuisRequete, limiteur } from "@/lib/rateLimit";

/* 3 inscriptions par IP et par 10 min : chaque inscription envoie un e-mail
   de bienvenue, a n'importe quelle adresse saisie. Sans limite, la route
   pouvait servir a bombarder des tiers et abimer la reputation d'envoi. */
const tropDInscriptions = limiteur(3, 10 * 60 * 1000);

export const dynamic = "force-dynamic";

// Volontairement permissif : on refuse ce qui n'est manifestement pas un email,
// la validation reelle se fait a l'envoi.

export async function POST(req: NextRequest) {
  if (tropDInscriptions(cleDepuisRequete(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as {
      email?: unknown;
      locale?: unknown;
      source?: unknown;
    };

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email || !emailValide(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const rawLocale = typeof body.locale === "string" ? body.locale : "";
    const locale = (locales as readonly string[]).includes(rawLocale) ? rawLocale : null;

    const rawSource = typeof body.source === "string" ? body.source.slice(0, 60) : "";
    const source = rawSource || null;

    const { created } = await subscribeToNewsletter({ email, locale, source });

    // Le premier email part tout de suite : une inscription qui reste sans
    // reponse pendant 24 h ne ressemble plus a une inscription. Un echec
    // d'envoi ne doit pas faire echouer l'inscription elle-meme.
    if (created) {
      try {
        await sendWelcomeStep({ email, locale }, 1);
      } catch (error) {
        console.error("[POST /api/newsletter] email de bienvenue non envoye:", error);
      }
    }

    // Reponse identique qu'il s'agisse d'une nouvelle inscription ou non :
    // pas de fuite d'information sur qui est deja inscrit.
    return NextResponse.json({ ok: true, created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/newsletter] Error:", message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
