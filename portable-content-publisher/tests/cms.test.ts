import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileCmsAdapter } from "../src/adapters/file-adapters.js";
import { loadConfig } from "../src/config/load.js";
import type { ContentRecord } from "../src/core/types.js";

test("file CMS is idempotent and enforces optimistic revisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "publisher-cms-"));
  try {
    const config = structuredClone(await loadConfig("config/project.example.json"));
    config.paths.data = root;
    config.paths.state = root;
    const cms = new FileCmsAdapter(config);
    await cms.initialize();
    const now = new Date().toISOString();
    const record: ContentRecord = {
      id: "one", projectId: config.project.id, topicId: "topic", kind: "article", locale: "fr", category: "energy",
      slug: "example", title: "A sufficiently detailed example title", excerpt: "A sufficiently detailed excerpt for the portable test record.",
      body: "word ".repeat(400), images: [], sourceUrls: ["https://example.org/source"],
      seo: { title: "A sufficiently detailed example title", description: "A sufficiently detailed search description that satisfies the configured minimum length for this verification case.", canonicalPath: "/fr/article/example", keywords: ["example"] },
      status: "draft", fingerprint: "same", revision: 1, createdAt: now, updatedAt: now,
    };
    assert.equal((await cms.createDraft(record)).created, true);
    assert.equal((await cms.createDraft({ ...record, id: "two" })).created, false);
    const published = await cms.publish("one", 1, now);
    assert.equal(published.status, "published");
    assert.equal(published.revision, 2);
    await assert.rejects(() => cms.update({ ...published, title: "conflict" }, 1), /Revision conflict/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
