import { createHash, randomUUID } from "node:crypto";
import { sql } from "@/lib/db";

const MAX_BYTES = 2 * 1024 * 1024;

/** Server-only: bytes never leave the database without the admin guard. */
export async function storeSupportAttachment(input: {
  replyId: number;
  name: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ id: string }> {
  if (!Number.isSafeInteger(input.replyId) || input.replyId <= 0 ||
      typeof input.name !== "string" || !input.name.trim() || input.name.length > 180 ||
      /[\x00-\x1f\x7f/\\]/.test(input.name) ||
      typeof input.contentType !== "string" || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType) ||
      input.contentType.length > 100 || !Buffer.isBuffer(input.bytes) ||
      input.bytes.length === 0 || input.bytes.length > MAX_BYTES) {
    throw new Error("Pièce jointe invalide.");
  }
  const id = randomUUID();
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  await sql`INSERT INTO support_private_attachments (id, reply_id, filename, content_type, content, sha256)
    VALUES (${id}::uuid, ${input.replyId}, ${input.name}, ${input.contentType}, ${input.bytes}, ${sha256})`;
  return { id };
}

export async function readSupportAttachment(id: string): Promise<{ name: string; bytes: Buffer } | null> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return null;
  const rows = await sql`SELECT filename, content, sha256 FROM support_private_attachments WHERE id = ${id}::uuid`;
  if (!rows.length) return null;
  const row = rows[0];
  const bytes = Buffer.from(row.content as Buffer);
  if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error("Pièce jointe corrompue.");
  return { name: row.filename as string, bytes };
}
