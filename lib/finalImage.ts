/** Final portraits come only from our explicitly configured public Blob store.
 * No wildcard trusts, DNS requests, provider-side URL attachments or URL-bearing errors.
 * Admin uploadPolicy currently issues final/<context UUID>/<file UUID>.<extension>;
 * older final/<filename> objects in that same store remain supported.
 */
import sharp from "sharp";

export const MAX_FINAL_IMAGE_BYTES = 10 * 1024 * 1024;
// Allows 32/48/64 MP poster portraits, while bounding native decode allocation.
export const MAX_FINAL_IMAGE_PIXELS = 64_000_000;
export const MAX_FINAL_IMAGE_DIMENSION = 12_000;
const TIMEOUT_MS = 10_000;
export type FinalImageType = "image/png" | "image/jpeg" | "image/webp";
/** A narrow signature check, never a content-type guess or arbitrary decoder fallback. */
export function finalImageType(bytes: Uint8Array): FinalImageType {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FINAL_IMAGE_BYTES) throw new FinalImageError();
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString("ascii",12,16) === "IHDR") return "image/png";
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.length >= 20 && b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(b.toString("ascii",12,16)) && b.readUInt32LE(4) + 8 === b.length) return "image/webp";
  throw new FinalImageError();
}

export async function downloadFinalImage(value: unknown, { timeoutMs = TIMEOUT_MS }: { timeoutMs?: number } = {}): Promise<{ bytes: Uint8Array; contentType: FinalImageType; url: string }> {
  const url = validateFinalImageUrl(value);
  const controller = new AbortController();
  const budgetMs = Math.min(TIMEOUT_MS, Math.max(1, timeoutMs));
  const expiresAt = performance.now() + budgetMs;
  // One deadline covers headers AND streaming. Race also bounds a stalled reader.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new FinalImageError()); }, budgetMs);
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let decoder: ReturnType<typeof sharp> | undefined;
  const stopDecoder = () => { decoder?.destroy(); };
  controller.signal.addEventListener("abort", stopDecoder, { once: true });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, cache: "no-store", headers: { Accept: "image/png, image/jpeg, image/webp" } });
      if (!response.ok || !response.body) { await response.body?.cancel(); throw new FinalImageError(); }
      reader = response.body.getReader();
      const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      const length = response.headers.get("content-length");
      if (!["image/png", "image/jpeg", "image/webp"].includes(mime ?? "") || (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_FINAL_IMAGE_BYTES))) throw new FinalImageError();
      // A fixed byte budget also bounds bookkeeping for millions of tiny chunks.
      const storage = Buffer.allocUnsafe(MAX_FINAL_IMAGE_BYTES);
      let total = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        // A continuously-ready stream can starve timer callbacks (even empty chunks).
        if (controller.signal.aborted || performance.now() >= expiresAt) throw new FinalImageError();
        if (done) break;
        if (chunk.byteLength > MAX_FINAL_IMAGE_BYTES - total) throw new FinalImageError();
        storage.set(chunk, total);
        total += chunk.byteLength;
      }
      const bytes = Buffer.from(storage.subarray(0, total));
      const contentType = finalImageType(bytes);
      if (contentType !== mime) throw new FinalImageError();
      decoder = sharp(bytes, { failOn: "warning", sequentialRead: true, limitInputPixels: MAX_FINAL_IMAGE_PIXELS, limitInputChannels: 4 })
        .timeout({ seconds: Math.ceil(TIMEOUT_MS / 1000) });
      const metadata = await decoder.metadata();
      if (controller.signal.aborted || !metadata.width || !metadata.height || metadata.width > MAX_FINAL_IMAGE_DIMENSION || metadata.height > MAX_FINAL_IMAGE_DIMENSION) throw new FinalImageError();
      // No resizing: force evaluation of every pixel, not only a header or thumbnail.
      // Raw output is discarded; <=64 MP * 4 channels (256 MB), not retained with
      // the returned compressed bytes. Native timeout also bounds work after abort.
      await decoder.raw({ depth: "uchar" }).toBuffer();
      if (controller.signal.aborted) throw new FinalImageError();
      return { bytes, contentType, url };
    })()]);
  } catch {
    controller.abort();
    throw new FinalImageError();
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", stopDecoder);
    decoder?.destroy();
    // Never await untrusted stream cancellation after the deadline.
    void reader?.cancel().catch(() => {});
  }
}

export class FinalImageError extends Error {
  constructor(message = "Portrait indisponible ou invalide.", public status = 400) { super(message); }
}
export function validateFinalImageUrl(value: unknown): string {
  const configured = process.env.FINAL_IMAGE_STORAGE_ORIGIN;
  if (!configured || !/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(configured)) {
    throw new FinalImageError("Configuration du stockage des portraits manquante ou invalide.", 503);
  }
  // Raw grammar rejects credentials, explicit ports (including :443), query,
  // fragments, escaping, traversal and HTML metacharacters before URL normalization.
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith(configured + "/final/")) throw new FinalImageError();
  const pathname = value.slice(configured.length);
  if (!/^\/final\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(pathname) || pathname.split("/").some(p => p === "." || p === "..")) throw new FinalImageError();
  return value;
}
