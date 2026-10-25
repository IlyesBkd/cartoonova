import assert from "node:assert/strict";
import test from "node:test";
import { simpleParser } from "mailparser";

// GHSA-8c8m-p3m8-cjg8: nested comments must not become extra addresses.
// Exercise the same public parser and fields consumed by lib/imapSync.ts.
test("support email nested From comments cannot inject another sender", async () => {
  const parsed = await simpleParser(Buffer.from([
    "From: trusted@example.com (outer (inner), attacker@example.net)",
    "To: support@example.org",
    "Subject: Comment parsing regression",
    "Message-ID: <nested-comment@example.com>",
    "", "A support message.",
  ].join("\r\n")));

  assert.deepEqual(parsed.from.value.map(({ address }) => address), ["trusted@example.com"]);
});

test("support MIME parsing preserves sender, thread references and HTML fallback", async () => {
  const parsed = await simpleParser(Buffer.from([
    'From: "Client Test" <client@example.com>',
    "To: support@example.org",
    "Subject: =?UTF-8?Q?R=C3=A9ponse?=",
    "Message-ID: <reply@example.com>",
    "In-Reply-To: <order@example.org>",
    "References: <original@example.org> <order@example.org>",
    "Date: Sun, 25 Oct 2026 10:00:00 +0000",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "", "<p>Bonjour <strong>support</strong></p>",
  ].join("\r\n")));

  assert.equal(parsed.from.value[0].address, "client@example.com");
  assert.equal(parsed.subject, "Réponse");
  assert.equal(parsed.messageId, "<reply@example.com>");
  assert.equal(parsed.inReplyTo, "<order@example.org>");
  assert.deepEqual(parsed.references, ["<original@example.org>", "<order@example.org>"]);
  assert.match(parsed.text, /Bonjour support/);
  assert.equal(parsed.date.toISOString(), "2026-10-25T10:00:00.000Z");
});
