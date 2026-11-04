import type postgres from "postgres";

type Client = ReturnType<typeof postgres>;
type Attachment = { id: string; name: string };

/** Metadata only; file bytes are available solely through the admin download route. */
export async function enrichSupportReplies<T extends { id: number }>(db: Client, replies: T[]): Promise<(T & { attachments: Attachment[] })[]> {
  if (!replies.length) return [];
  const ids = [...new Set(replies.map(reply => reply.id))];
  const rows = await db`SELECT id,reply_id,filename FROM support_private_attachments WHERE reply_id = ANY(${db.array(ids, 23)}) ORDER BY created_at,id`;
  const byReply = new Map<number, Attachment[]>();
  for (const row of rows) {
    const key = Number(row.reply_id), existing = byReply.get(key) ?? [];
    existing.push({ id: row.id as string, name: row.filename as string });
    byReply.set(key, existing);
  }
  return replies.map(reply => ({ ...reply, attachments: byReply.get(reply.id) ?? [] }));
}
