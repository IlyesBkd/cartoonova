import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileCmsAdapter } from "../src/adapters/file-adapters.js";
import { MockAiAdapter } from "../src/adapters/ai.js";
import { PublisherEngine } from "../src/engine/orchestrator.js";
import type { AdapterBundle } from "../src/adapters/contracts.js";
import type { ContentRecord, ProjectConfig } from "../src/core/types.js";

async function makeConfig(root: string): Promise<ProjectConfig> {
  return {
    version: 1,
    project: {
      id: "test-project",
      name: "Test Project",
      siteUrl: "https://example.org",
      timezone: "UTC",
      topic: "test",
      description: "test",
      editorial: { voice: "neutral", audience: "everyone", principles: [], forbiddenPatterns: [] },
    },
    contentTypes: [
      { id: "article", label: "Article", minWords: 5, maxWords: 5000, requiredImages: 0, dailyTargets: { fr: 1 }, reserveTargets: { fr: 1 }, categories: ["general"] },
    ],
    locales: [
      { id: "fr", language: "French", market: "France", isDefault: true, publicationWindows: [{ start: "00:00", end: "23:59" }] },
    ],
    sources: { seeds: [], allowDomains: [], denyDomains: [], requireAttribution: false },
    adapters: {
      cms: { type: "file", options: { file: "content.json" } },
      ai: { type: "mock", options: {} },
      search: { type: "fixture", options: {} },
      analytics: { type: "file", options: {} },
      media: { type: "local-catalog", options: {} },
      distribution: { type: "json-outbox", options: {} },
    },
    ai: { model: "test", translationModel: "test", temperature: 0, maxCallsPerDay: 100, maxTokensPerDay: 1_000_000, maxAttemptsPerItem: 1, maxCorrectionsPerItem: 0, retryDelayMs: 0, circuitBreakerFailures: 100, circuitBreakerCooldownMs: 0 },
    seo: { enabled: false, minTitleLength: 1, maxTitleLength: 200, minDescriptionLength: 1, maxDescriptionLength: 500, competitorCount: 1, refreshLookbackDays: 1, minimumImpressionsForRefresh: 1, protectedPaths: [] },
    images: { minWidth: 0, minHeight: 0, maxBytes: 10_000_000, allowedMimeTypes: ["image/jpeg"], requireDistinctSources: false },
    publishing: { minDelayMinutes: 0, maxDelayMinutes: 0, requireCompleteTranslations: false, timezone: "UTC" },
    workers: { generationIntervalMs: 1000, publicationIntervalMs: 1000, seoIntervalMs: 1000, lockTtlMs: 5000 },
    paths: { data: root, state: root, temp: root, logs: root },
  };
}

function draftRecord(id: string, kind: string, locale: string): ContentRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId: "test-project",
    topicId: `topic-${id}`,
    kind,
    locale,
    category: "general",
    slug: id,
    title: `Title ${id}`,
    excerpt: `Excerpt ${id}`,
    body: "word ".repeat(20),
    images: [],
    sourceUrls: [],
    seo: { title: `Title ${id}`, description: `Description ${id}`, canonicalPath: `/${locale}/article/${id}`, keywords: [] },
    status: "draft",
    fingerprint: id,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

test("publishEligible paces one publication per call and respects the daily target", async () => {
  const root = await mkdtemp(join(tmpdir(), "publisher-publish-"));
  try {
    const config = await makeConfig(root);
    const cms = new FileCmsAdapter(config);
    await cms.initialize();
    await cms.createDraft(draftRecord("one", "article", "fr"));
    await cms.createDraft(draftRecord("two", "article", "fr"));

    const adapters: AdapterBundle = {
      cms,
      ai: new MockAiAdapter(),
      search: { discover: async () => [], serp: async () => [] },
      analytics: { metrics: async () => [] },
      media: { select: async () => null, verify: async () => true },
      distribution: { enqueue: async () => {}, drain: async () => 0 },
    };
    const engine = new PublisherEngine(config, adapters, false);

    const first = await engine.publishEligible(new Date("2026-01-15T10:00:00Z"));
    assert.equal(first.published, 1);

    const published = await cms.list({ status: "published" });
    assert.equal(published.length, 1);
    const drafts = await cms.list({ status: "draft" });
    assert.equal(drafts.length, 1);

    const second = await engine.publishEligible(new Date("2026-01-15T10:05:00Z"));
    assert.equal(second.published, 0, "daily target of 1 is already met for this kind/locale");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("publishEligible defers everything outside the publication window", async () => {
  const root = await mkdtemp(join(tmpdir(), "publisher-publish-window-"));
  try {
    const config = await makeConfig(root);
    config.locales[0]!.publicationWindows = [{ start: "09:00", end: "10:00" }];
    const cms = new FileCmsAdapter(config);
    await cms.initialize();
    await cms.createDraft(draftRecord("one", "article", "fr"));

    const adapters: AdapterBundle = {
      cms,
      ai: new MockAiAdapter(),
      search: { discover: async () => [], serp: async () => [] },
      analytics: { metrics: async () => [] },
      media: { select: async () => null, verify: async () => true },
      distribution: { enqueue: async () => {}, drain: async () => 0 },
    };
    const engine = new PublisherEngine(config, adapters, false);

    const result = await engine.publishEligible(new Date("2026-01-15T22:00:00Z"));
    assert.equal(result.published, 0);
    assert.equal(result.deferred, 1);
    assert.equal((await cms.list({ status: "draft" })).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
