"use client";
import { upload } from "@vercel/blob/client";
import { isPrivateStorageReference } from "./storageDisplay";

type UploadScope = { purpose: "checkout"; product: string } | { purpose: "depot" | "poster"; token: string } | { purpose: "admin"; orderId: string };
type Context = { context: string; prefix: string; expiresAt: number; provider?: "vps" };
const contexts = new Map<string, Promise<Context>>();
// Concurrent products must not mint competing first-session cookies. Browser
// Web Locks extend the serialization to other tabs where supported.
let checkoutContextQueue: Promise<void> = Promise.resolve();
/** Contexts stay in browser memory only; filenames never contain customer data. */
export async function uploadImage(file: File, scope: UploadScope) {
  const key = JSON.stringify(scope);
  let pending = contexts.get(key);
  if (!pending || (await pending).expiresAt <= Date.now() + 120_000) {
    const issue = async () => {
      const response = await fetch("/api/upload/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      });
      if (!response.ok) throw new Error("Dépôt indisponible ou quota atteint.");
      return await response.json() as Context;
    };
    if (scope.purpose === "checkout") {
      pending = checkoutContextQueue.then(async () => {
        if (typeof navigator !== "undefined" && navigator.locks) {
          return await navigator.locks.request("cartoonova-photo-session", issue);
        }
        return await issue();
      });
      checkoutContextQueue = pending.then(() => {}, () => {});
    } else pending = issue();
    contexts.set(key, pending);
  }
  let context: Context;
  try { context = await pending; } catch (error) { contexts.delete(key); throw error; }
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Format d'image invalide.");
  const pathname = `${context.prefix}${crypto.randomUUID()}.${extension}`;
  if (context.provider === "vps") {
    // Fail closed: never publish to Blob as a fallback after a private failure.
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Image limitée à 10 Mio.");
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    const reserved = await fetch("/api/upload/vps-grant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname, context: context.context, sha256, size: file.size, contentType: file.type }),
    });
    if (!reserved.ok) throw new Error("Dépôt indisponible ou quota atteint.");
    const { url, grant, reference } = await reserved.json() as { url: string; grant: string; reference: string };
    const destination = new URL(url);
    if (destination.protocol !== "https:" || destination.username || destination.password || destination.search || destination.hash || !grant || !isPrivateStorageReference(reference) || reference !== `vps://private/${pathname}`) {
      throw new Error("Dépôt privé invalide.");
    }
    const stored = await fetch(destination.href, {
      method: "PUT", headers: { Authorization: `Bearer ${grant}`, "Content-Type": file.type },
      body: file, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
    });
    if (!stored.ok) throw new Error("Dépôt privé impossible.");
    const completed = await fetch("/api/upload/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, context: context.context }),
    });
    if (!completed.ok) throw new Error("Vérification et sauvegarde du dépôt impossibles.");
    return { url: reference };
  }
  return upload(pathname, file, {
    access: "public", handleUploadUrl: "/api/upload", clientPayload: context.context,
  });
}
