import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { readPreparedSupportReply } from "@/lib/supportPreparedReplies";

export const dynamic = "force-dynamic";
export async function GET(req: Request, context: { params: Promise<{ id: string; position: string }> }): Promise<Response> {
  const refusal = await refuserSiPasAdmin(req);
  if (refusal) return refusal;
  try {
    const { id, position } = await context.params;
    if (!/^[0-2]$/.test(position)) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const draft = await readPreparedSupportReply(id);
    const file = draft?.attachments[Number(position)];
    if (!file) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return new Response(new Uint8Array(file.bytes), { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
