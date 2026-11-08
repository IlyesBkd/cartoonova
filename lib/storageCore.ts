import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const STORAGE_MAX_BYTES = 10 * 1024 * 1024;
export type StorageNamespace = "orders" | "retouches" | "final" | "extras";
import { isVpsReference } from "./storageReference";
export { isVpsReference } from "./storageReference";
export const vpsStorageEnabled = () => process.env.CARTOONOVA_STORAGE_PROVIDER === "vps";
export const storageHash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export function storagePath(reference: string) {
  if (!isVpsReference(reference)) throw new Error("Invalid storage reference");
  return new URL(reference).pathname;
}
export function servicePath(reference: string) {
  const path = storagePath(reference);
  return `/v1/files/${path.split("/")[1]}/${storageHash(path).slice(0, 32)}`;
}
export function storageOrigin() {
  const value = process.env.STORAGE_VPS_ORIGIN;
  if (!value || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/.test(value) || new URL(value).origin !== value) throw new Error("Invalid storage configuration");
  return value;
}
function secret() {
  const value = process.env.STORAGE_HMAC_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new Error("Storage unavailable");
  return value;
}
function key(domain: string) { return createHmac("sha256", secret()).update(`cartoonova-storage:${domain}:v1`).digest(); }
export interface StorageDescriptor { reference: string; sha256: string; bytes: number; content_type: string; status: "pending" | "completed" }
export function storageGrant(d: StorageDescriptor, method: "GET" | "PUT") {
  if (!/^[0-9a-f]{64}$/.test(d.sha256) || !Number.isInteger(d.bytes) || d.bytes < 1 || d.bytes > STORAGE_MAX_BYTES) throw new Error("Invalid storage metadata");
  const payload = Buffer.from(JSON.stringify({ v: 1, method, path: servicePath(d.reference), exp: Math.floor(Date.now() / 1000) + 60, sha256: d.sha256, type: d.content_type, maxbytes: d.bytes })).toString("base64url");
  return payload + "." + createHmac("sha256", secret()).update("cartoonova-storage-v1." + payload).digest("base64url");
}
export function emailCapability(reference: string) {
  storagePath(reference);
  return createHmac("sha256", key("email-read")).update(`GET\n${reference}\nv1`).digest("hex");
}
export function verifyEmailCapability(reference: string, signature: string) {
  if (!isVpsReference(reference) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = emailCapability(reference);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
