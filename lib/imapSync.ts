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
      /* Rien de neuf — mais le passage compte quand meme. C'est LE cas que le
         battement de coeur doit couvrir : sans cette ligne, la sortie
         anticipee laissait `last_synced_at` fige, et une boite calme etait
         indiscernable d'une synchronisation morte. */
      await setImapSyncState(lastUid);
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
      const bodyText = parsed.text || "";
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

    /* Le passage est enregistre A CHAQUE FOIS, y compris quand la boite est
       vide. Auparavant l'ecriture etait conditionnee a l'arrivee de courrier :
       une synchronisation saine sans nouveau message ne laissait donc aucune
       trace, exactement comme une synchronisation en panne.

       Ce silence a coute cinq semaines. Du 16 juillet au 20 aout, le cron
       partait tous les matins et se faisait refuser : `CRON_SECRET` n'existait
       pas encore en production, la route repondait 401, et rien ne le
       signalait. Un courrier client recu le 21 juillet n'a ete lu que le
       21 aout, au lendemain du premier deploiement qui a rendu la variable
       effective.

       Avec un horodatage a chaque passage, `last_synced_at` devient un vrai
       battement de coeur : une date qui date, c'est une panne. */
    await setImapSyncState(Math.max(maxUid, lastUid));
  } finally {
    await client.logout().catch(() => client.close());
  }

  // Classify all fetched messages concurrently, then persist.
  const categories: (SupportMessageCategory | null)[] = await Promise.all(
    pending.map((msg) => classifySupportMessage({ fromEmail: msg.fromEmail, subject: msg.subject, bodyText: msg.bodyText }))
  );

  await Promise.all(
    pending.map(async (msg, i) => {
      const category = categories[i];
      const { isNew } = await insertSupportMessage({ ...msg, category });
      if (isNew) newMessages++;
    })
  );

  return { checked, newMessages };
}
