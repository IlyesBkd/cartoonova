import { refuserSiPasAdmin } from "@/lib/adminAuth";
import { readSupportAttachment } from "@/lib/supportAttachments";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const refusal = await refuserSiPasAdmin(req);
  if (refusal) return refusal;
  try {
    const { id } = await context.params;
    const file = await readSupportAttachment(id);
    if (!file) return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    // Force a download: untrusted attachments must never execute in the admin origin.
    return new Response(new Uint8Array(file.bytes), { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
