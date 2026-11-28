import { NextResponse } from "next/server";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { withFreshDatabaseClient } from "@/lib/db";

export const ADMIN_COOKIE = "cartoonova-admin";
/* Session glissante (28/11/2026, demande d'Ilyes : l'admin se déconnectait toutes les 15 min) :
   prolongée à chaque usage, coupée après 12 h sans activité et 30 jours au plus après la connexion.
   La base fait foi (expires_at) ; le cookie vit 30 jours pour ne pas expirer avant elle. */
const IDLE_HOURS = 12;
const MAX_DAYS = 30;
const TTL = MAX_DAYS * 24 * 3600;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const denied = () => NextResponse.json({ error: "Non autorisé." }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "Authentification indisponible." }, { status: 503 });
function originFailure(req: Request) {
  return req.headers.get("origin") !== new URL(req.url).origin
    ? NextResponse.json({ error: "Origine invalide." }, { status: 403 }) : null;
}
function token(req: Request) {
  const value = req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function sessionCookie(response: NextResponse, value: string, maxAge = TTL) {
  response.cookies.set(ADMIN_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
/** Await this guard before touching admin data. Raw passwords are login-only. */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return unavailable();
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const refusal = originFailure(req);
    if (refusal) return refusal;
  }
  const value = token(req);
  if (!value) return denied();
  /* Une lecture admin ouvre une connexion neuve (tunnel SSH depuis Vercel).
     Le 27/11/2026, une sur quatorze a echoue puis reussi au coup suivant :
     on retente une fois avant de repondre « indisponible ». Un refus
     (session absente ou expiree) n'est jamais retente. */
  const credential = createHmac("sha256", password).update(value).digest("hex");
  for (let essai = 1; ; essai++) {
    try {
      const rows = await withFreshDatabaseClient(async db => {
        const found = await db`SELECT token_hash, expires_at < now() + make_interval(hours => ${IDLE_HOURS - 1}) AS due FROM admin_sessions
          WHERE token_hash = ${hash(value)} AND credential_hash = ${credential} AND expires_at > now()`;
        // Prolonge au plus une fois par heure (pas d'écriture à chaque clic), sans dépasser 30 jours.
        if (found[0]?.due) await db`UPDATE admin_sessions
          SET expires_at = LEAST(now() + make_interval(hours => ${IDLE_HOURS}), created_at + make_interval(days => ${MAX_DAYS}))
          WHERE token_hash = ${hash(value)} AND expires_at > now()`;
        return found;
      });
      return rows.length ? null : denied();
    } catch {
      if (essai >= 2) return unavailable();
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}
export const refuserSiPasAdmin = requireAdmin;

export async function logoutAdmin(req: Request): Promise<NextResponse> {
  const refusal = originFailure(req);
  if (refusal) return refusal;
  try {
    const value = token(req);
    if (value) await withFreshDatabaseClient(db => db`DELETE FROM admin_sessions WHERE token_hash = ${hash(value)}`);
    return sessionCookie(new NextResponse(null, { status: 204 }), "", 0);
  } catch { return unavailable(); }
}

export async function loginAdmin(req: Request): Promise<NextResponse> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return unavailable();
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  const ingressIP = process.env.ADMIN_TRUST_PROXY === "vercel" && process.env.VERCEL === "1"
    ? req.headers.get("x-vercel-forwarded-for")?.trim() : null;
  // Never trust arbitrary X-Forwarded-For. Invalid/missing trusted ingress
  // deliberately shares one budget, as does every non-Vercel deployment.
  const clientKey = ingressIP && isIP(ingressIP) ? `ip:${hash(ingressIP)}` : "shared";
  try {
    const allowed = await withFreshDatabaseClient(db => db.begin(async tx => {
      // Fixed key order serializes concurrent instances; count every login,
      // including successes, so parallel guesses cannot race a reset.
      for (const [key, limit] of [["global", 100], [clientKey, 5]] as const) {
        const [row] = await tx`INSERT INTO admin_login_buckets (bucket_key, attempts, expires_at)
          VALUES (${key}, 1, now() + interval '15 minutes')
          ON CONFLICT (bucket_key) DO UPDATE SET
            attempts = CASE WHEN admin_login_buckets.expires_at <= now() THEN 1 ELSE LEAST(admin_login_buckets.attempts + 1, ${limit + 1}) END,
            expires_at = CASE WHEN admin_login_buckets.expires_at <= now() THEN now() + interval '15 minutes' ELSE admin_login_buckets.expires_at END
          RETURNING attempts`;
        if (row.attempts > limit) return false;
      }
      return true;
    }));
    if (!allowed) return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
  let supplied: unknown;
  try { supplied = (await req.json()).password; } catch { return denied(); }
  if (typeof supplied !== "string" || !timingSafeEqual(Buffer.from(hash(supplied), "hex"), Buffer.from(hash(password), "hex"))) return denied();
  try {
    const value = randomBytes(32).toString("hex");
    await withFreshDatabaseClient(db => db`INSERT INTO admin_sessions (token_hash, credential_hash, expires_at)
      VALUES (${hash(value)}, ${createHmac("sha256", password).update(value).digest("hex")}, now() + make_interval(hours => ${IDLE_HOURS}))`);
    return sessionCookie(new NextResponse(null, { status: 204 }), value);
  } catch { return unavailable(); }
}
