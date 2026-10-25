"use client";
import { upload } from "@vercel/blob/client";

type UploadScope = { purpose: "checkout"; product: string } | { purpose: "depot" | "poster"; token: string } | { purpose: "admin"; orderId: string; password: string };
type Context = { context: string; prefix: string; expiresAt: number };
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
      const { password, ...body } = scope.purpose === "admin" ? scope : { ...scope, password: undefined };
      const response = await fetch("/api/upload/context", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(password ? { "x-admin-password": password } : {}) },
        body: JSON.stringify(body),
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
  return upload(`${context.prefix}${crypto.randomUUID()}.${extension}`, file, {
    access: "public", handleUploadUrl: "/api/upload", clientPayload: context.context,
  });
}
