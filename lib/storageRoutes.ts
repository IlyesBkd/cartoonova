import { reserveUpload, authorizeReservedUpload, UploadError } from "@/lib/uploadPolicy";
import { isVpsReference, storagePath, servicePath, storageGrant, storageOrigin, vpsStorageEnabled, verifyEmailCapability, type StorageDescriptor } from "./storageCore";
import { registerStorageObject, completeStorageObject, readStoredObject } from "./storage";
import { authorizeStorageRead } from "./storageAuthorization";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
function failure(error: unknown) {
  return Response.json({ error: error instanceof UploadError ? error.message : "Stockage indisponible." }, { status: error instanceof UploadError ? error.status : error instanceof SyntaxError ? 400 : 503, headers });
}
export async function vpsGrantRoute(req: Request) {
  if (!vpsStorageEnabled()) return Response.json({ error: "Dépôt indisponible." }, { status: 404, headers });
  try {
    const input = await req.json();
    const {pathname, context, sha256, size, contentType} = input ?? {};
    const reference = `vps://private/${pathname}`;
    const extensions: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/heic": ["heic"], "image/heif": ["heif"] };
    if (!isVpsReference(reference) || storagePath(reference).startsWith("/extras/") || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256) || !Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024 || !extensions[contentType]?.includes(reference.split(".").pop()!)) throw new UploadError("Fichier invalide.", 400);
    // Check configured origin before spending quota. Never accept a host from input.
    const url = storageOrigin() + servicePath(reference);
    await reserveUpload(req, pathname, context);
    await authorizeReservedUpload(req, pathname, context);
    const d: StorageDescriptor = {reference, sha256, bytes: size, content_type: contentType, status: "pending"};
    const grant = storageGrant(d, "PUT");
    await registerStorageObject(d);
    return Response.json({ url, grant, reference }, { headers });
  } catch (error) { return failure(error); }
}
export async function vpsCompleteRoute(req: Request) {
  if (!vpsStorageEnabled()) return Response.json({ error: "Dépôt indisponible." }, { status: 404, headers });
  try {
    const { reference, context } = await req.json();
    if (!isVpsReference(reference)) throw new UploadError("Fichier invalide.", 400);
    await authorizeReservedUpload(req, storagePath(reference).slice(1), context);
    await completeStorageObject(reference);
    return Response.json({ reference, status: "completed" }, { headers });
  } catch (error) { return failure(error); }
}
export async function storageReadRoute(req: Request, email = false) {
  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get("ref");
    if (!isVpsReference(reference)) throw new UploadError("Fichier invalide.", 400);
    const allowed = email ? verifyEmailCapability(reference, url.searchParams.get("signature") ?? "") : await authorizeStorageRead(req, reference);
    if (!allowed) throw new UploadError("Non autorisé.", 403);
    const object = await readStoredObject(reference);
    return new Response(new Uint8Array(object.bytes), { headers: { ...headers, "Content-Type": object.contentType, "Content-Length": String(object.bytes.length), "Content-Disposition": 'inline; filename="cartoonova.' + reference.split(".").pop() + '"' } });
  } catch (error) { return failure(error); }
}
