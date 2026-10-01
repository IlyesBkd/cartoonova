import type { ProjectConfig, SerpResult, TopicCandidate } from "../core/types.js";
import type { SearchAdapter } from "./contracts.js";
import { FixtureSearchAdapter } from "./file-adapters.js";
import { SerpApiSearchAdapter } from "./serpapi.js";

/**
 * Topic discovery backed by the project's own query corpus first, and by live
 * SERP results second.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * The host repository derives a curated topic queue from a corpus of ~15,000
 * qualified queries, clustered by language, intent and competitive difficulty,
 * and recomputes it on every run. It writes that queue to the file named by
 * `topicsFile` — which only `FixtureSearchAdapter` reads. With
 * `SEARCH_ADAPTER=serpapi` in production, nothing ever read it: the most
 * considered strategic work in the project went to a file no code opened,
 * while discovery depended entirely on a metered third-party API.
 *
 * That dependency then failed in the way metered APIs do. The SerpAPI quota ran
 * out, discovery returned nothing, and generation stopped for a week.
 *
 * ── The ordering is the point ────────────────────────────────────────────
 *
 * The corpus is the backbone: it is free, deterministic, offline, and reflects
 * what the project actually knows about its market. Live results are the
 * supplement: they bring what a static corpus cannot — questions asked this
 * month, in each market's own Google.
 *
 * So a live failure degrades the run instead of ending it. Discovery only fails
 * when *both* sources come back empty, because that is the only case where
 * there is genuinely nothing to write about.
 */
export class CorpusFirstSearchAdapter implements SearchAdapter {
  private readonly corpus: FixtureSearchAdapter;
  private readonly live: SerpApiSearchAdapter | null;

  constructor(config: ProjectConfig, fetchImpl: typeof fetch = fetch) {
    this.corpus = new FixtureSearchAdapter(config);
    // No key is a valid configuration, not an error: the corpus alone is
    // enough to run. Losing the supplement must not cost the backbone.
    this.live = config.adapters.search.options.apiKey
      ? new SerpApiSearchAdapter(config, fetchImpl)
      : null;
  }

  async discover(config: ProjectConfig): Promise<TopicCandidate[]> {
    const problems: string[] = [];

    let corpusTopics: TopicCandidate[] = [];
    try {
      corpusTopics = await this.corpus.discover(config);
    } catch (error) {
      problems.push(`corpus: ${error instanceof Error ? error.message : String(error)}`);
    }

    let liveTopics: TopicCandidate[] = [];
    if (this.live) {
      try {
        liveTopics = await this.live.discover(config);
      } catch (error) {
        // Logged, not thrown. A quota wall is a bad day for freshness, not a
        // reason to stop publishing.
        problems.push(`live: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`[search] live discovery unavailable, falling back to the corpus — ${problems.at(-1)}`);
      }
    }

    // Corpus first so that, on an id collision, the curated entry wins: it
    // carries the intent and difficulty judgement a scraped title does not.
    const merged: TopicCandidate[] = [];
    const seen = new Set<string>();
    for (const topic of [...corpusTopics, ...liveTopics]) {
      if (!topic.id || seen.has(topic.id)) continue;
      seen.add(topic.id);
      merged.push(topic);
    }

    if (merged.length === 0) {
      throw new Error(
        `Topic discovery returned nothing from either source${problems.length ? ` (${problems.join("; ")})` : ""}`,
      );
    }

    console.log(
      `[search] ${merged.length} sujet(s) : ${corpusTopics.length} du corpus, ${liveTopics.length} en direct`,
    );
    return merged;
  }

  /**
   * Competitor SERPs have no corpus equivalent — the corpus holds queries, not
   * ranked pages — so this delegates, and answers empty when there is no key.
   */
  async serp(query: string, locale: string, limit: number): Promise<SerpResult[]> {
    if (!this.live) return [];
    return this.live.serp(query, locale, limit);
  }
}
