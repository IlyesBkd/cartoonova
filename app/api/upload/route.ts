import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getOrderByConfirmationToken } from "@/lib/db";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { cleDepuisRequete } from "@/lib/rateLimit";
import { TYPES_PHOTO_AUTORISES, TAILLE_MAX_PHOTO } from "@/lib/photoUpload";
import {
  consommerQuotaUpload,
  MAX_UPLOADS_AUTORISES,
  MAX_UPLOADS_CHECKOUT,
  MAX_TENTATIVES_UPLOAD,
  lireCorpsBorne,
  parseUploadIntent,
  pathnameAutoriseUpload,
  type IntentionUpload,
} from "@/lib/uploadPolicy";

const TAILLE_MAX_REQUETE = 8 * 1024;
const DUREE_JETON_MS = 15 * 60 * 1000;
const EN_TETES_SANS_CACHE = { "Cache-Control": "no-store" };

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return Boolean(valeur) && typeof valeur === "object" && !Array.isArray(valeur);
}

function clePourUpload(req: Request): string {
  // Vercel garantit ce champ meme si un proxy amont ecrase x-forwarded-for.
  const ipVercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return ipVercel || cleDepuisRequete(req);
}

function estMemeOrigine(req: Request): boolean {
  const origine = req.headers.get("origin");
  if (!origine) return false;
  try {
    return new URL(origine).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function reponseErreur(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error },
    { status, headers: { ...EN_TETES_SANS_CACHE, ...Object.fromEntries(new Headers(headers).entries()) } }
  );
}

function reserverQuotaUpload(cle: string, maximum: number): NextResponse | null {
  const quota = consommerQuotaUpload(cle, maximum);
  if (quota.autorise) return null;
  return reponseErreur("upload_rate_limited", 429, { "Retry-After": String(quota.reessayerDans) });
}

export async function POST(req: NextRequest) {
  const typeContenu = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!typeContenu.startsWith("application/json")) return reponseErreur("invalid_content_type", 415);

  const tailleDeclaree = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(tailleDeclaree) && tailleDeclaree > TAILLE_MAX_REQUETE) {
    return reponseErreur("request_too_large", 413);
  }

  let corpsBrut: string | null;
  let valeur: unknown;
  try {
    corpsBrut = await lireCorpsBorne(req.body, TAILLE_MAX_REQUETE);
    if (corpsBrut === null) return reponseErreur("request_too_large", 413);
    valeur = JSON.parse(corpsBrut);
  } catch {
    return reponseErreur("invalid_json", 400);
  }

  if (!estObjet(valeur) || !estMemeOrigine(req)) return reponseErreur("forbidden", 403);

  const type = valeur.type;
  if (type !== "blob.generate-client-token" && type !== "blob.upload-completed") {
    return reponseErreur("invalid_upload_event", 400);
  }
  if (!estObjet(valeur.payload)) return reponseErreur("invalid_upload_event", 400);

  let corps: HandleUploadBody;
  let intention: IntentionUpload | null = null;
  let cheminAutorise: string | null = null;
  let payloadAutorise: string | null = null;

  if (type === "blob.generate-client-token") {
    const payload = valeur.payload;
    if (
      typeof payload.pathname !== "string" ||
      typeof payload.multipart !== "boolean" ||
      (typeof payload.clientPayload !== "string" && payload.clientPayload !== null)
    ) {
      return reponseErreur("invalid_upload_event", 400);
    }

    intention = parseUploadIntent(payload.clientPayload);
    if (!intention) return reponseErreur("invalid_upload_intent", 400);
    if (!pathnameAutoriseUpload(intention.scope, payload.pathname)) {
      return reponseErreur("upload_path_not_allowed", 403);
    }

    // Le quota d'essais protège les lectures en base non authentifiees; le
    // quota d'emission ci-dessous n'est consomme qu'apres autorisation.
    const ip = clePourUpload(req);
    const refusTentatives = reserverQuotaUpload(`tentatives:${ip}`, MAX_TENTATIVES_UPLOAD);
    if (refusTentatives) return refusTentatives;

    if (intention.scope === "checkout") {
      const refusQuota = reserverQuotaUpload(`emission:checkout:${ip}`, MAX_UPLOADS_CHECKOUT);
      if (refusQuota) return refusQuota;
    } else if (intention.scope === "order") {
      if (!parseOrderTrackingToken(intention.token)) return reponseErreur("invalid_order_token", 403);
      const refusQuota = reserverQuotaUpload(`emission:order:${ip}`, MAX_UPLOADS_AUTORISES);
      if (refusQuota) return refusQuota;
    } else if (intention.scope === "retouch") {
      if (!(await getOrderByConfirmationToken(intention.token))) {
        return reponseErreur("invalid_retouch_token", 403);
      }
      const refusQuota = reserverQuotaUpload(`emission:retouch:${ip}`, MAX_UPLOADS_AUTORISES);
      if (refusQuota) return refusQuota;
    } else {
      const refus = refuserSiPasAdmin(req);
      if (refus) return refus;
      const refusQuota = reserverQuotaUpload(`emission:admin:${ip}`, MAX_UPLOADS_AUTORISES);
      if (refusQuota) return refusQuota;
    }

    cheminAutorise = payload.pathname;
    payloadAutorise = payload.clientPayload;
    corps = valeur as unknown as HandleUploadBody;
  } else {
    if (!estObjet(valeur.payload.blob)) return reponseErreur("invalid_upload_event", 400);
    corps = valeur as unknown as HandleUploadBody;
  }

  try {
    const jsonResponse = await handleUpload({
      body: corps,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (
          !intention ||
          pathname !== cheminAutorise ||
          clientPayload !== payloadAutorise
        ) {
          throw new Error("Upload non autorisé");
        }
        return {
          allowedContentTypes: [...TYPES_PHOTO_AUTORISES],
          maximumSizeInBytes: TAILLE_MAX_PHOTO,
          validUntil: Date.now() + DUREE_JETON_MS,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    return NextResponse.json(jsonResponse, { headers: EN_TETES_SANS_CACHE });
  } catch {
    // Ne jamais renvoyer ni journaliser le jeton Blob, le chemin ou l'URL client.
    console.error("[POST /api/upload] Échec de la préparation du jeton Blob");
    return reponseErreur("upload_failed", 500);
  }
}
