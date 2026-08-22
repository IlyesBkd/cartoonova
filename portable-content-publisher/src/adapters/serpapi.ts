import { join } from "node:path";
import type { ProjectConfig, SerpResult, TopicCandidate } from "../core/types.js";
import type { SearchAdapter } from "./contracts.js";
import { readJson, writeJsonAtomic } from "../core/runtime.js";

const LOCALE_MARKET: Record<string, { domain: string; hl: string; gl: string }> = {
  fr: { domain: "google.fr", hl: "fr", gl: "fr" },
  en: { domain: "google.com", hl: "en", gl: "us" },
  es: { domain: "google.es", hl: "es", gl: "es" },
  de: { domain: "google.de", hl: "de", gl: "de" },
  it: { domain: "google.it", hl: "it", gl: "it" },
  nl: { domain: "google.nl", hl: "nl", gl: "nl" },
  pl: { domain: "google.pl", hl: "pl", gl: "pl" },
  sv: { domain: "google.se", hl: "sv", gl: "se" },
  da: { domain: "google.dk", hl: "da", gl: "dk" },
  pt: { domain: "google.pt", hl: "pt", gl: "pt" },
};

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

interface SerpApiOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpApiRelatedQuestion {
  question?: string;
  snippet?: string;
  link?: string;
}

export interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  related_questions?: SerpApiRelatedQuestion[];
  related_searches?: Array<{ query?: string }>;
  error?: string;
}

async function extractHeadings(url: string, fetchImpl: typeof fetch): Promise<string[]> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) return [];
    const html = await response.text();
    const matches = [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gis)];
    return matches
      .map((match) => match[1]!.replace(/<[^>]+>/g, "").trim())
      .filter((text) => text.length > 3 && text.length < 150)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Discovers real topics and competitor SERP results via SerpAPI (https://serpapi.com).
 * `discover()` results are cached to disk for `discoverCacheTtlMs` (default 24h) so the
 * generate worker's frequent polling doesn't burn API quota on identical queries — without
 * this, a 30-minute worker interval would mean ~48 calls/day per seed keyword.
 */
export class SerpApiSearchAdapter implements SearchAdapter {
  private readonly apiKey: string;
  private readonly cachePath: string;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProjectConfig, fetchImpl: typeof fetch = fetch) {
    const options = config.adapters.search.options;
    this.apiKey = String(options.apiKey ?? "");
    if (!this.apiKey) throw new Error("SerpAPI adapter requires adapters.search.options.apiKey");
    this.cachePath = join(config.paths.state, "serpapi-discover-cache.json");
    this.cacheTtlMs = Number(options.discoverCacheTtlMs ?? 24 * 60 * 60 * 1000);
    this.fetchImpl = fetchImpl;
  }

  private async search(query: string, locale: string, num: number): Promise<SerpApiResponse> {
    const market = LOCALE_MARKET[locale] ?? LOCALE_MARKET.fr!;
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("google_domain", market.domain);
    url.searchParams.set("hl", market.hl);
    url.searchParams.set("gl", market.gl);
    url.searchParams.set("num", String(num));
    url.searchParams.set("api_key", this.apiKey);
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`SerpAPI request failed with ${response.status}`);
    const json = (await response.json()) as SerpApiResponse;
    if (json.error) throw new Error(`SerpAPI error: ${json.error}`);
    return json;
  }

  async discover(config: ProjectConfig): Promise<TopicCandidate[]> {
    const cached = await readJson<{ cachedAt?: string; topics?: TopicCandidate[] }>(this.cachePath, {});
    if (cached.cachedAt && cached.topics && Date.now() - Date.parse(cached.cachedAt) < this.cacheTtlMs) {
      return cached.topics;
    }

    const defaultLocale = config.locales.find((locale) => locale.isDefault) ?? config.locales[0]!;
    const fallbackCategory = config.contentTypes[0]?.categories[0] ?? "general";
    const topics: TopicCandidate[] = [];
    const seen = new Set<string>();

    /*
     * Discovery used to run against the default locale only: every seed was
     * sent to that market's Google, so the whole pipeline saw a single
     * country's questions. Markets differ - "cadeau fete des meres" and
     * "Muttertag Geschenk" do not surface the same "people also ask" - and a
     * topic found in Germany is what makes the German article worth writing
     * rather than being a translation of a French one.
     *
     * Each seed is one paid search, so the fan-out is bounded twice: only
     * locales listed in `seedsByLocale` are discovered in, and each of them
     * contributes at most `maxSeedsPerLocale` seeds.
     */
    const maxSeeds = config.sources.maxSeedsPerLocale ?? config.sources.seeds.length;
    const seedsByLocale = config.sources.seedsByLocale ?? {};

    const plan: Array<{ locale: string; seed: string }> = config.sources.seeds.map((seed) => ({
      locale: defaultLocale.id,
      seed,
    }));

    for (const locale of config.locales) {
      if (locale.id === defaultLocale.id) continue;
      const seeds = seedsByLocale[locale.id];
      if (!seeds?.length || !LOCALE_MARKET[locale.id]) continue;
      for (const seed of seeds.slice(0, maxSeeds)) {
        plan.push({ locale: locale.id, seed });
      }
    }

    for (const { locale: targetLocale, seed } of plan) {
      let response: SerpApiResponse;
      try {
        response = await this.search(seed, targetLocale, 10);
      } catch {
        continue;
      }
      const relatedCount = (response.related_questions?.length ?? 0) + (response.related_searches?.length ?? 0);
      const demand = Math.min(100, relatedCount * 12);

      for (const question of response.related_questions ?? []) {
        const title = question.question?.trim();
        if (!title) continue;
        const id = slug(title);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const fallbackLink = response.organic_results?.[0]?.link;
        topics.push({
          id,
          title,
          summary: question.snippet?.trim() || title,
          sourceUrls: question.link ? [question.link] : fallbackLink ? [fallbackLink] : [],
          keywords: [seed],
          category: fallbackCategory,
          freshness: 85,
          demand,
          authority: 60,
          discoveredAt: new Date().toISOString(),
          discoveredIn: targetLocale,
        });
      }

      for (const result of (response.organic_results ?? []).slice(0, 3)) {
        const title = result.title?.trim();
        const link = result.link?.trim();
        if (!title || !link) continue;
        const id = slug(title);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        topics.push({
          id,
          title,
          summary: result.snippet?.trim() || title,
          sourceUrls: [link],
          keywords: [seed],
          category: fallbackCategory,
          freshness: 80,
          demand,
          authority: Math.max(30, 100 - (result.position ?? 10) * 8),
          discoveredAt: new Date().toISOString(),
          discoveredIn: targetLocale,
        });
      }
    }

    const withSources = topics.filter((topic) => topic.sourceUrls.length > 0);
    await writeJsonAtomic(this.cachePath, { cachedAt: new Date().toISOString(), topics: withSources });
    return withSources;
  }

  async serp(query: string, locale: string, limit: number): Promise<SerpResult[]> {
    const response = await this.search(query, locale, limit);
    const results = (response.organic_results ?? []).slice(0, limit);
    return Promise.all(
      results.map(async (result) => ({
        query,
        url: result.link ?? "",
        title: result.title ?? "",
        description: result.snippet ?? "",
        position: result.position ?? 0,
        headings: result.link ? await extractHeadings(result.link, this.fetchImpl) : [],
      })),
    );
  }
}
