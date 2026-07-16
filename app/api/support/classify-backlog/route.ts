import { NextRequest, NextResponse } from "next/server";
import {
  getUnclassifiedSupportMessages,
  setSupportMessageCategory,
  countUnclassifiedSupportMessages,
} from "@/lib/db";
import { classifySupportMessage } from "@/lib/aiClassify";

const BATCH_SIZE = 20;

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

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
