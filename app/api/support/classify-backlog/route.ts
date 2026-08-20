import { NextRequest, NextResponse } from "next/server";
import {
  getUnclassifiedSupportMessages,
  setSupportMessageCategory,
  countUnclassifiedSupportMessages,
} from "@/lib/db";
import { classifySupportMessage } from "@/lib/aiClassify";
import { refuserSiPasAdmin } from "@/lib/adminAuth";

const BATCH_SIZE = 20;

export async function POST(req: NextRequest) {
  const refus = refuserSiPasAdmin(req);
  if (refus) return refus;

  try {
    const batch = await getUnclassifiedSupportMessages(BATCH_SIZE);

    await Promise.all(
      batch.map(async (msg) => {
        const category = await classifySupportMessage({
          fromEmail: msg.from_email,
          subject: msg.subject,
          bodyText: msg.body_text,
        });
        await setSupportMessageCategory(msg.id, category);
      })
    );

    const remaining = await countUnclassifiedSupportMessages();

    return NextResponse.json({ ok: true, processed: batch.length, remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/support/classify-backlog] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
