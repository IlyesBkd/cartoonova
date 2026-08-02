import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SerpApiSearchAdapter } from "../src/adapters/serpapi.js";
import type { ProjectConfig } from "../src/core/types.js";

function makeConfig(root: string, apiKey = "test-key"): ProjectConfig {
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
      { id: "article", label: "Article", minWords: 5, maxWords: 5000, requiredImages: 0, dailyTargets: { fr: 1 }, reserveTargets: { fr: 1 }, categories: ["gift-guides"] },
    ],
    locales: [{ id: "fr", language: "French", market: "France", isDefault: true, publicationWindows: [{ start: "00:00", end: "23:59" }] }],
    sources: { seeds: ["cadeau original"], allowDomains: [], denyDomains: [], requireAttribution: false },
    adapters: {
      cms: { type: "file", options: {} },
      ai: { type: "mock", options: {} },
      search: { type: "serpapi", options: { apiKey } },
      analytics: { type: "file", options: {} },
      media: { type: "local-catalog", options: {} },
      distribution: { type: "json-outbox", options: {} },
    },
    ai: { model: "test", translationModel: "test", temperature: 0, maxCallsPerDay: 100, maxTokensPerDay: 1_000_000, maxAttemptsPerItem: 1, maxCorrectionsPerItem: 0, retryDelayMs: 0, circuitBreakerFailures: 100, circuitBreakerCooldownMs: 0 },
    seo: { enabled: true, minTitleLength: 1, maxTitleLength: 200, minDescriptionLength: 1, maxDescriptionLength: 500, competitorCount: 3, refreshLookbackDays: 1, minimumImpressionsForRefresh: 1, protectedPaths: [] },
    images: { minWidth: 0, minHeight: 0, maxBytes: 10_000_000, allowedMimeTypes: ["image/jpeg"], requireDistinctSources: false },
    publishing: { minDelayMinutes: 0, maxDelayMinutes: 0, requireCompleteTranslations: false, timezone: "UTC" },
    workers: { generationIntervalMs: 1000, publicationIntervalMs: 1000, seoIntervalMs: 1000, lockTtlMs: 5000 },
    paths: { data: root, state: root, temp: root, logs: root },
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

function htmlResponse(html: string): Response {
  return { ok: true, status: 200, json: async () => ({}), text: async () => html } as unknown as Response;
}

test("SerpApiSearchAdapter requires an apiKey", async () => {
  const root = await mkdtemp(join(tmpdir(), "serpapi-"));
  try {
    assert.throws(() => new SerpApiSearchAdapter(makeConfig(root, "")), /requires adapters.search.options.apiKey/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("discover() maps organic results and related questions into topics, then caches", async () => {
  const root = await mkdtemp(join(tmpdir(), "serpapi-"));
  try {
    const config = makeConfig(root);
    let calls = 0;
    const fetchStub = (async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      assert.ok(url.startsWith("https://serpapi.com/search"));
      assert.ok(url.includes("google_domain=google.fr"));
      return jsonResponse({
        organic_results: [
          { position: 1, title: "Idées cadeaux originales", link: "https://example.org/idees-cadeaux", snippet: "Un guide de cadeaux originaux." },
        ],
        related_questions: [
          { question: "Quel cadeau original offrir ?", snippet: "Plusieurs pistes existent.", link: "https://example.org/faq" },
        ],
        related_searches: [{ query: "cadeau original pas cher" }],
      });
    }) as unknown as typeof fetch;

    const adapter = new SerpApiSearchAdapter(config, fetchStub);
    const topics = await adapter.discover(config);

    assert.equal(calls, 1);
    assert.equal(topics.length, 2);
    const question = topics.find((topic) => topic.title === "Quel cadeau original offrir ?");
    assert.ok(question);
    assert.deepEqual(question!.sourceUrls, ["https://example.org/faq"]);
    assert.equal(question!.category, "gift-guides");
    const organic = topics.find((topic) => topic.title === "Idées cadeaux originales");
    assert.ok(organic);
    assert.deepEqual(organic!.sourceUrls, ["https://example.org/idees-cadeaux"]);

    // Second call within the cache TTL must not hit the network again.
    const cached = await adapter.discover(config);
    assert.equal(calls, 1);
    assert.equal(cached.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("serp() maps organic results and best-effort extracts competitor headings", async () => {
  const root = await mkdtemp(join(tmpdir(), "serpapi-"));
  try {
    const config = makeConfig(root);
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://serpapi.com/search")) {
        return jsonResponse({
          organic_results: [{ position: 1, title: "Guide concurrent", link: "https://competitor.example/guide", snippet: "Un guide complet." }],
        });
      }
      if (url === "https://competitor.example/guide") {
        return htmlResponse("<html><body><h2>Section une</h2><p>texte</p><h3>Sous-section</h3></body></html>");
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const adapter = new SerpApiSearchAdapter(config, fetchStub);
    const results = await adapter.serp("cadeau original", "fr", 5);

    assert.equal(results.length, 1);
    assert.equal(results[0]!.title, "Guide concurrent");
    assert.deepEqual(results[0]!.headings, ["Section une", "Sous-section"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("serp() degrades gracefully when heading extraction fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "serpapi-"));
  try {
    const config = makeConfig(root);
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://serpapi.com/search")) {
        return jsonResponse({ organic_results: [{ position: 1, title: "Résultat", link: "https://broken.example/", snippet: "..." }] });
      }
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const adapter = new SerpApiSearchAdapter(config, fetchStub);
    const results = await adapter.serp("cadeau original", "fr", 5);

    assert.equal(results.length, 1);
    assert.deepEqual(results[0]!.headings, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
