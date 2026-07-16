import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  getImapSyncState,
  setImapSyncState,
  insertSupportMessage,
  findOrderByOutboundMessageId,
  findOrderByCustomerEmail,
  type SupportMessageCategory,
} from "./db";
import { classifySupportMessage } from "./aiClassify";

interface PendingMessage {
  messageId: string;
  fromEmail: string;
  subject: string | null;
  bodyText: string;
  receivedAt: Date;
  orderId: string | null;
}

async function notifySupportDiscord(msg: {
  fromEmail: string;
  subject: string;
  bodyText: string;
  orderId: string | null;
}) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const fields = [{ name: "📧 De", value: msg.fromEmail, inline: true }];
    if (msg.orderId) {
      fields.push({ name: "📦 Commande liée", value: msg.orderId.slice(0, 8), inline: true });
    }
    if (msg.bodyText) {
      fields.push({ name: "Message", value: msg.bodyText.slice(0, 1000), inline: false });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `📩 Nouveau message client : ${msg.subject || "(sans objet)"}`,
            color: 3447003,
            fields,
            footer: { text: "Cartoonova • Boîte support" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[IMAP-SYNC] Erreur notification Discord:", error);
  }
}

export async function syncSupportInbox(): Promise<{ checked: number; newMessages: number }> {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT || 993);
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("IMAP non configuré (IMAP_HOST / IMAP_USER / IMAP_PASSWORD manquants).");
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  let checked = 0;
  let newMessages = 0;
  const pending: PendingMessage[] = [];

  await client.connect();

  try {
    const { lastUid } = await getImapSyncState();
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });

    if (mailbox.uidNext - 1 <= lastUid) {
      return { checked: 0, newMessages: 0 };
    }

    let maxUid = lastUid;

    for await (const message of client.fetch(
      `${lastUid + 1}:*`,
      { source: true, envelope: true },
      { uid: true }
    )) {
      checked++;
      if (message.uid > maxUid) maxUid = message.uid;
      if (!message.source) continue;

      const parsed = await simpleParser(message.source);
      const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() || "inconnu";
      const subject = parsed.subject || null;
      const bodyText = (parsed.text || "").slice(0, 5000);
      const messageId = parsed.messageId || `uid-${message.uid}@imap-fallback`;
      const receivedAt = parsed.date || new Date();

      const referenceIds = [
        ...(parsed.inReplyTo ? parsed.inReplyTo.split(/\s+/) : []),
        ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []),
      ].filter(Boolean);

      let orderId: string | null = null;
      for (const ref of referenceIds) {
        const order = await findOrderByOutboundMessageId(ref);
        if (order) {
          orderId = order.id;
          break;
        }
      }
      if (!orderId && fromEmail !== "inconnu") {
        const order = await findOrderByCustomerEmail(fromEmail);
        if (order) orderId = order.id;
      }

      pending.push({ messageId, fromEmail, subject, bodyText, receivedAt, orderId });
    }

    if (maxUid > lastUid) {
      await setImapSyncState(maxUid);
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  // Classify all fetched messages concurrently, then persist + notify.
  const categories: SupportMessageCategory[] = await Promise.all(
    pending.map((msg) => classifySupportMessage({ fromEmail: msg.fromEmail, subject: msg.subject, bodyText: msg.bodyText }))
  );

  await Promise.all(
    pending.map(async (msg, i) => {
      const category = categories[i];
      const { isNew } = await insertSupportMessage({ ...msg, category });
      if (isNew) {
        newMessages++;
        if (category === "customer") {
          await notifySupportDiscord({ fromEmail: msg.fromEmail, subject: msg.subject || "", bodyText: msg.bodyText, orderId: msg.orderId });
        }
      }
    })
  );

  return { checked, newMessages };
}
