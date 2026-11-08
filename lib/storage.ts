import { randomUUID } from "node:crypto";
import { withFreshDatabaseClient } from "@/lib/db";
import { STORAGE_MAX_BYTES, type StorageDescriptor, type StorageNamespace, isVpsReference, storagePath, storageHash, servicePath, storageOrigin, storageGrant, emailCapability, vpsStorageEnabled } from "./storageCore";
export { isVpsReference, vpsStorageEnabled } from "./storageCore";

export function storageEmailUrl(reference: string): string {
  if (!isVpsReference(reference)) return reference;
  // Fixed application origin: never infer this from a caller Host header.
  return `https://www.cartoonova.com/api/storage/email?ref=${encodeURIComponent(reference)}&signature=${emailCapability(reference)}`;
}
export function blobStorageUrl(value: string): boolean {
  const store = /^vercel_blob_rw_([a-zA-Z0-9-]+)_[a-zA-Z0-9_-]+$/.exec(process.env.BLOB_READ_WRITE_TOKEN ?? "")?.[1];
  if (!store) return false;
  try {
    const u = new URL(value);
    const origin = `https://${store.toLowerCase()}.public.blob.vercel-storage.com`;
    return u.origin === origin && value.startsWith(origin + "/") && u.href === value && !u.search && !u.hash && !u.username && !u.password;
  } catch { return false; }
}
export async function boundedStorageFetch(url: string, init: RequestInit, maxBytes: number): Promise<{bytes: Buffer; contentType: string}> {
  const controller = new AbortController();
  const end = performance.now() + 10_000;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Storage timeout")); }, 10_000); });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(url, { ...init, redirect: "manual", cache: "no-store", signal: controller.signal });
      if (!response.ok || !response.body) { void response.body?.cancel(); throw new Error("Storage unavailable"); }
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) { void response.body.cancel(); throw new Error("Storage size exceeded"); }
      reader = response.body.getReader();
      const result = Buffer.allocUnsafe(maxBytes);
      let total = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (performance.now() >= end || controller.signal.aborted) throw new Error("Storage timeout");
        if (done) break;
        if (value.length > maxBytes - total) throw new Error("Storage size exceeded");
        result.set(value, total); total += value.length;
      }
      return { bytes: Buffer.from(result.subarray(0, total)), contentType: response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "application/octet-stream" };
    })()]);
  } finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}
export async function storageDescriptor(reference: string): Promise<StorageDescriptor> {
  storagePath(reference);
  const rows = await withFreshDatabaseClient(db => db`SELECT * FROM storage_objects WHERE reference = ${reference}`);
  if (!rows.length) throw new Error("Storage object unavailable");
  return rows[0] as unknown as StorageDescriptor;
}
export async function registerStorageObject(d: StorageDescriptor) {
  storagePath(d.reference);
  await withFreshDatabaseClient(db => db`INSERT INTO storage_objects (reference, internal_path, sha256, bytes, content_type)
    VALUES (${d.reference}, ${servicePath(d.reference)}, ${d.sha256}, ${d.bytes}, ${d.content_type})`);
}
export async function readVpsDescriptor(d: StorageDescriptor) {
  const result = await boundedStorageFetch(storageOrigin() + servicePath(d.reference), { headers: { Authorization: `Bearer ${storageGrant(d, "GET")}` } }, d.bytes);
  if (result.bytes.length !== d.bytes || storageHash(result.bytes) !== d.sha256 || result.contentType !== d.content_type) throw new Error("Storage integrity failure");
  return result;
}
/** Trusted server caller only; user-facing callers must authorize membership first. */
export async function readStoredObject(reference: string): Promise<{bytes: Buffer; contentType: string}> {
  if (!isVpsReference(reference)) {
    if (!blobStorageUrl(reference)) throw new Error("Invalid storage origin");
    return boundedStorageFetch(reference, {}, STORAGE_MAX_BYTES);
  }
  const d = await storageDescriptor(reference);
  if (d.status !== "completed") throw new Error("Storage object pending");
  // New VPS files exist only on the VPS: no secondary copy, no fallback.
  return readVpsDescriptor(d);
}
export async function completeStorageObject(reference: string) {
  storagePath(reference);
  // Serialize finalization. A file is completed only once its VPS bytes are
  // read back and match the registered size, SHA-256 and content type.
  return withFreshDatabaseClient(db => db.begin(async tx => {
    const [row] = await tx`SELECT * FROM storage_objects WHERE reference = ${reference} FOR UPDATE`;
    if (!row) throw new Error("Storage object unavailable");
    const d = row as unknown as StorageDescriptor;
    if (d.status === "completed") return reference;
    await readVpsDescriptor(d);
    const updated = await tx`UPDATE storage_objects SET status = 'completed', completed_at = now()
      WHERE reference = ${reference} AND status = 'pending' RETURNING reference`;
    if (!updated.length) throw new Error("Storage completion failed");
    return reference;
  }));
}
export async function uploadVpsServerObject(bytes: Uint8Array, namespace: StorageNamespace | `extras/${string}`, contentType: string): Promise<string> {
  if (!vpsStorageEnabled()) throw new Error("VPS writes disabled");
  const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
  const extension = extensions[contentType];
  const parts = namespace.split("/");
  if (parts.length > 2 || (parts.length === 2 && parts[0] !== "extras")) throw new Error("Invalid storage namespace");
  const [base, contextId] = parts;
  const reference = `vps://private/${base}/${contextId ?? randomUUID()}/${randomUUID()}.${extension}`;
  if (!extension || !isVpsReference(reference) || bytes.length < 1 || bytes.length > STORAGE_MAX_BYTES) throw new Error("Invalid storage object");
  const d: StorageDescriptor = { reference, sha256: storageHash(bytes), bytes: bytes.length, content_type: contentType, status: "pending" };
  await registerStorageObject(d);
  const response = await fetch(storageOrigin() + servicePath(reference), { method: "PUT", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${storageGrant(d, "PUT")}`, "Content-Type": contentType }, body: Buffer.from(bytes) });
  void response.body?.cancel();
  if (response.status !== 201) throw new Error("Storage upload failed");
  await completeStorageObject(reference);
  return reference;
}
