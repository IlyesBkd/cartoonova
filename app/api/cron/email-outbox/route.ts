import { drainerEmails } from "@/lib/emailOutbox";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Endpoint volontairement NON programme ; reutilise l'auth cron existante. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sent = await drainerEmails(null, 20);
    const [counts] = await sql`
      SELECT count(*) FILTER (WHERE sent_at IS NULL AND exhausted_at IS NULL)::int AS pending,
        count(*) FILTER (WHERE sent_at IS NULL AND exhausted_at IS NOT NULL)::int AS exhausted
      FROM email_outbox
    `;
    return Response.json({ sent, pending: Number(counts.pending), exhausted: Number(counts.exhausted) });
  } catch {
    return Response.json({ error: "Email delivery failed; retained for retry" }, { status: 503 });
  }
}
