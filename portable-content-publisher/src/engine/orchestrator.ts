import { join } from "node:path";
import type { AdapterBundle } from "../adapters/contracts.js";
import type {
  ContentImage,
  ContentRecord,
  ContentTypeConfig,
  GenerationRequest,
  GenerationResult,
  LocaleConfig,
  ProjectConfig,
  QualityReport,
  RunSummary,
  TopicCandidate,
} from "../core/types.js";
import { AiBudget, Logger, isWithinWindow, newId, readJson, retryBounded, stableHash, withFileLock, writeJsonAtomic } from "../core/runtime.js";
import { slugify, validateGenerated } from "./quality.js";

interface GenerationOutcome {
  created: number;
  skipped: number;
  blocked: number;
}

export class PublisherEngine {
  private readonly logger: Logger;
  private readonly budget: AiBudget;
  private readonly previewRecords: ContentRecord[] = [];

  constructor(
    readonly config: ProjectConfig,
    readonly adapters: AdapterBundle,
    readonly dryRun = false,
  ) {
    this.logger = new Logger("engine", join(config.paths.logs, "publisher.jsonl"));
    this.budget = new AiBudget(config);
  }

  async initialize(): Promise<void> {
    await this.adapters.cms.initialize();
  }

  /**
   * A host matches a listed domain when it is that domain or a subdomain of it.
   *
   * Exact equality was the previous rule, which made the lists near-useless:
   * `amazon.fr` did not match `www.amazon.fr`, so a marketplace listed as
   * denied still supplied topics â€” and the site published an article steering
   * readers to a competitor.
   */
  private static hostMatches(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
  }

  async discoverTopics(): Promise<TopicCandidate[]> {
    const topics = await this.adapters.search.discover(this.config);
    const denied = this.config.sources.denyDomains.map((domain) => domain.toLowerCase());
    const allowed = this.config.sources.allowDomains.map((domain) => domain.toLowerCase());
    return topics
      .filter((topic) => topic.sourceUrls.length > 0)
      .filter((topic) => topic.sourceUrls.every((url) => {
        const host = new URL(url).hostname.toLowerCase();
        if (denied.some((domain) => PublisherEngine.hostMatches(host, domain))) return false;
        return allowed.length === 0 || allowed.some((domain) => PublisherEngine.hostMatches(host, domain));
      }))
      .sort((a, b) => this.topicScore(b) - this.topicScore(a));
  }

  private topicScore(topic: TopicCandidate): number {
    return topic.freshness * 0.4 + topic.demand * 0.35 + topic.authority * 0.25;
  }

  private async selectImages(generated: GenerationResult, kind: ContentTypeConfig): Promise<ContentImage[]> {
    const images: ContentImage[] = [];
    const usedSources = new Set<string>();
    for (const query of generated.imageQueries) {
      if (images.length >= kind.requiredImages) break;
      const image = await this.adapters.media.select(query, this.config, usedSources);
      if (!image || !(await this.adapters.media.verify(image))) continue;
      images.push(image);
      usedSources.add(image.sourceUrl);
    }
    return images;
  }

  private async aiCall<T>(estimatedTokens: number, task: () => Promise<T>): Promise<T> {
    await this.budget.assertAvailable(estimatedTokens);
    try {
      const result = await task();
      await this.budget.recordSuccess(estimatedTokens);
      return result;
    } catch (error) {
      await this.budget.recordFailure();
      throw error;
    }
  }

  private async generateOne(topic: TopicCandidate, kind: ContentTypeConfig, locale: LocaleConfig): Promise<{ generated: GenerationResult; images: ContentImage[]; quality: QualityReport }> {
    const request: GenerationRequest = { topic, kind, locale, project: this.config };
    let generated = await retryBounded(this.config.ai.maxAttemptsPerItem, this.config.ai.retryDelayMs, () =>
      this.aiCall(kind.maxWords * 2, () => this.adapters.ai.generate(request)),
    );
    let images = await this.selectImages(generated, kind);
    let quality = validateGenerated(generated, kind, images, this.config);
    for (let correction = 0; !quality.passed && correction < this.config.ai.maxCorrectionsPerItem; correction += 1) {
      generated = await this.aiCall(kind.maxWords * 2, () => this.adapters.ai.repair(request, generated, quality.issues));
      images = await this.selectImages(generated, kind);
      quality = validateGenerated(generated, kind, images, this.config);
    }
    return { generated, images, quality };
  }

  private recordFrom(topic: TopicCandidate, kind: ContentTypeConfig, locale: LocaleConfig, generated: GenerationResult, images: ContentImage[]): ContentRecord {
    const now = new Date().toISOString();
    const fingerprint = stableHash({ project: this.config.project.id, topic: topic.id, kind: kind.id, locale: locale.id });
    return {
      id: newId("content"),
      projectId: this.config.project.id,
      topicId: topic.id,
      kind: kind.id,
      locale: locale.id,
      category: topic.category,
      slug: slugify(generated.title),
      title: generated.title,
      excerpt: generated.excerpt,
      body: generated.body,
      images,
      sourceUrls: topic.sourceUrls,
      seo: {
        title: generated.seoTitle,
        description: generated.seoDescription,
        canonicalPath: `/${locale.id}/${kind.id}/${slugify(generated.title)}`,
        keywords: topic.keywords,
      },
      status: "draft",
      fingerprint,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  async fillDraftInventory(): Promise<GenerationOutcome> {
    return withFileLock(join(this.config.paths.state, "generation.lock"), this.config.workers.lockTtlMs, async () => {
      const topics = await this.discoverTopics();
      const all = await this.adapters.cms.list();
      const outcome: GenerationOutcome = { created: 0, skipped: 0, blocked: 0 };
      let cursor = 0;
      for (const kind of this.config.contentTypes) {
        for (const locale of this.config.locales) {
          const current = all.filter((record) => record.kind === kind.id && record.locale === locale.id && (record.status === "draft" || record.status === "scheduled")).length;
          const deficit = Math.max(0, kind.reserveTargets[locale.id]! - current);
          for (let index = 0; index < deficit; index += 1) {
            const topic = topics[cursor % topics.length];
            cursor += 1;
            if (!topic) break;
            const fingerprint = stableHash({ project: this.config.project.id, topic: topic.id, kind: kind.id, locale: locale.id });
            if (await this.adapters.cms.findByFingerprint(fingerprint)) {
              outcome.skipped += 1;
              continue;
            }
            const result = await this.generateOne(topic, kind, locale);
            if (!result.quality.passed) {
              outcome.blocked += 1;
              await this.logger.log("warn", "Draft blocked by quality gate", { topic: topic.id, kind: kind.id, locale: locale.id, issues: result.quality.issues });
              continue;
            }
            const record = this.recordFrom(topic, kind, locale, result.generated, result.images);
            if (this.dryRun) {
              this.previewRecords.push(record);
              outcome.created += 1;
              continue;
            }
            const stored = await this.adapters.cms.createDraft(record);
            stored.created ? outcome.created += 1 : outcome.skipped += 1;
          }
        }
      }
      return outcome;
    });
  }

  private localDate(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: this.config.publishing.timezone }).format(date);
  }

  async publishEligible(now = new Date()): Promise<{ published: number; deferred: number; blocked: number }> {
    return withFileLock(join(this.config.paths.state, "publication.lock"), this.config.workers.lockTtlMs, async () => {
      const result = { published: 0, deferred: 0, blocked: 0 };
      const records = [...await this.adapters.cms.list(), ...this.previewRecords];
      const schedulePath = join(this.config.paths.state, "publication-schedule.json");
      const schedule = await readJson<{ nextEligibleAt?: string }>(schedulePath, {});
      if (schedule.nextEligibleAt && now < new Date(schedule.nextEligibleAt)) {
        result.deferred = records.filter((record) => record.status === "draft").length;
        return result;
      }
      const today = this.localDate(now);
      let publicationCompleted = false;
      for (const kind of this.config.contentTypes) {
        for (const locale of this.config.locales) {
          if (publicationCompleted) break;
          const target = kind.dailyTargets[locale.id]!;
          const publishedToday = records.filter((record) => record.kind === kind.id && record.locale === locale.id && record.status === "published" && record.publishedAt && this.localDate(new Date(record.publishedAt)) === today).length;
          let remaining = Math.max(0, target - publishedToday);
          if (remaining === 0) continue;
          const windowOpen = locale.publicationWindows.some((window) => isWithinWindow(now, this.config.publishing.timezone, window.start, window.end));
          if (!windowOpen) {
            result.deferred += remaining;
            continue;
          }
          const drafts = records.filter((record) => record.kind === kind.id && record.locale === locale.id && record.status === "draft").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          for (const draft of drafts) {
            if (remaining <= 0) break;
            if (this.config.publishing.requireCompleteTranslations) {
              const pairComplete = this.config.locales.every((candidate) => records.some((record) => record.topicId === draft.topicId && record.kind === draft.kind && record.locale === candidate.id));
              if (!pairComplete) {
                result.deferred += 1;
                continue;
              }
            }
            const quality = validateGenerated({ title: draft.title, excerpt: draft.excerpt, body: draft.body, seoTitle: draft.seo.title, seoDescription: draft.seo.description, imageQueries: [] }, kind, draft.images, this.config);
            if (!quality.passed) {
              result.blocked += 1;
              continue;
            }
            if (!this.dryRun) {
              const published = await this.adapters.cms.publish(draft.id, draft.revision, now.toISOString());
              await this.adapters.distribution.enqueue(published);
              const spread = Math.max(0, this.config.publishing.maxDelayMinutes - this.config.publishing.minDelayMinutes);
              const jitter = spread === 0 ? 0 : Number.parseInt(stableHash(draft.id).slice(0, 8), 16) % (spread + 1);
              await writeJsonAtomic(schedulePath, { nextEligibleAt: new Date(now.getTime() + (this.config.publishing.minDelayMinutes + jitter) * 60_000).toISOString(), contentId: draft.id });
            }
            result.published += 1;
            remaining -= 1;
            publicationCompleted = true;
            break;
          }
        }
        if (publicationCompleted) break;
      }
      return result;
    });
  }

  async translateMissing(): Promise<{ created: number; skipped: number }> {
    const records = await this.adapters.cms.list();
    const defaultLocale = this.config.locales.find((locale) => locale.isDefault)!;
    const result = { created: 0, skipped: 0 };
    for (const source of records.filter((record) => record.locale === defaultLocale.id)) {
      for (const locale of this.config.locales.filter((candidate) => candidate.id !== defaultLocale.id)) {
        const fingerprint = stableHash({ project: this.config.project.id, topic: source.topicId, kind: source.kind, locale: locale.id });
        if (await this.adapters.cms.findByFingerprint(fingerprint)) {
          result.skipped += 1;
          continue;
        }
        const translated = await this.aiCall(source.body.length / 3, () => this.adapters.ai.translate(source, locale.id, this.config));
        const kind = this.config.contentTypes.find((candidate) => candidate.id === source.kind)!;
        const quality = validateGenerated(translated, kind, source.images, this.config);
        if (!quality.passed) continue;
        const now = new Date().toISOString();
        const { publishedAt: _publishedAt, scheduledAt: _scheduledAt, ...unpublishedSource } = source;
        const record: ContentRecord = {
          ...unpublishedSource,
          id: newId("content"),
          locale: locale.id,
          slug: slugify(translated.title),
          title: translated.title,
          excerpt: translated.excerpt,
          body: translated.body,
          seo: { ...source.seo, title: translated.seoTitle, description: translated.seoDescription, canonicalPath: `/${locale.id}/${source.kind}/${slugify(translated.title)}` },
          status: "draft",
          fingerprint,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        if (!this.dryRun) await this.adapters.cms.createDraft(record);
        result.created += 1;
      }
    }
    return result;
  }

  async analyzeSeo(): Promise<{ opportunities: number; reportPath: string }> {
    const to = new Date();
    const from = new Date(to.getTime() - this.config.seo.refreshLookbackDays * 86_400_000);
    const metrics = await this.adapters.analytics.metrics(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    const records = await this.adapters.cms.list({ status: "published" });
    const opportunities = [];
    for (const record of records) {
      if (this.config.seo.protectedPaths.includes(record.seo.canonicalPath)) continue;
      const recordMetrics = metrics.filter((metric) => metric.contentId === record.id);
      const impressions = recordMetrics.reduce((sum, metric) => sum + metric.impressions, 0);
      const clicks = recordMetrics.reduce((sum, metric) => sum + metric.clicks, 0);
      const position = recordMetrics.length ? recordMetrics.reduce((sum, metric) => sum + metric.position, 0) / recordMetrics.length : 100;
      if (impressions < this.config.seo.minimumImpressionsForRefresh) continue;
      const serp = await this.adapters.search.serp(record.seo.keywords[0] ?? record.title, record.locale, this.config.seo.competitorCount);
      const missingHeadings = [...new Set(serp.flatMap((entry) => entry.headings))].filter((heading) => !record.body.toLowerCase().includes(heading.toLowerCase()));
      opportunities.push({ contentId: record.id, title: record.title, impressions, clicks, ctr: impressions ? clicks / impressions : 0, position, missingHeadings, competitors: serp });
    }
    const reportPath = join(this.config.paths.data, "seo-opportunities.json");
    await writeJsonAtomic(reportPath, opportunities.sort((a, b) => b.impressions - a.impressions));
    return { opportunities: opportunities.length, reportPath };
  }

  async optimizeSeo(limit = 10, apply = false): Promise<{ reviewed: number; updated: number; blocked: number }> {
    const reportPath = join(this.config.paths.data, "seo-opportunities.json");
    const opportunities = await readJson<Array<{ contentId: string; missingHeadings: string[] }>>(reportPath, []);
    const result = { reviewed: 0, updated: 0, blocked: 0 };
    for (const opportunity of opportunities.slice(0, limit)) {
      const record = await this.adapters.cms.get(opportunity.contentId);
      if (!record || this.config.seo.protectedPaths.includes(record.seo.canonicalPath)) continue;
      result.reviewed += 1;
      const kind = this.config.contentTypes.find((candidate) => candidate.id === record.kind);
      const locale = this.config.locales.find((candidate) => candidate.id === record.locale);
      if (!kind || !locale) continue;
      const topic: TopicCandidate = {
        id: record.topicId,
        title: record.title,
        summary: record.excerpt,
        sourceUrls: record.sourceUrls,
        keywords: record.seo.keywords,
        category: record.category,
        freshness: 0,
        demand: 0,
        authority: 0,
        discoveredAt: record.createdAt,
      };
      const request: GenerationRequest = { topic, kind, locale, project: this.config };
      const previous: GenerationResult = { title: record.title, excerpt: record.excerpt, body: record.body, seoTitle: record.seo.title, seoDescription: record.seo.description, imageQueries: record.images.map((image) => image.alt) };
      const issues = opportunity.missingHeadings.slice(0, 8).map((heading) => ({ code: "COMPETITOR_GAP", severity: "warning" as const, message: heading }));
      const revised = await this.aiCall(kind.maxWords * 2, () => this.adapters.ai.repair(request, previous, issues));
      const quality = validateGenerated(revised, kind, record.images, this.config);
      if (!quality.passed) {
        result.blocked += 1;
        continue;
      }
      if (apply && !this.dryRun) {
        const backupPath = join(this.config.paths.state, "seo-backups", `${record.id}-r${record.revision}.json`);
        await writeJsonAtomic(backupPath, record);
        await this.adapters.cms.update({ ...record, title: revised.title, excerpt: revised.excerpt, body: revised.body, seo: { ...record.seo, title: revised.seoTitle, description: revised.seoDescription } }, record.revision);
        result.updated += 1;
      }
    }
    return result;
  }

  async learnFromPerformance(): Promise<{ samples: number; reportPath: string }> {
    const to = new Date();
    const from = new Date(to.getTime() - 28 * 86_400_000);
    const metrics = await this.adapters.analytics.metrics(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    const records = await this.adapters.cms.list({ status: "published" });
    const cohorts = this.config.contentTypes.flatMap((kind) => this.config.locales.map((locale) => {
      const ids = new Set(records.filter((record) => record.kind === kind.id && record.locale === locale.id).map((record) => record.id));
      const sample = metrics.filter((metric) => ids.has(metric.contentId));
      const impressions = sample.reduce((sum, metric) => sum + metric.impressions, 0);
      const clicks = sample.reduce((sum, metric) => sum + metric.clicks, 0);
      return { kind: kind.id, locale: locale.id, samples: sample.length, impressions, clicks, ctr: impressions ? clicks / impressions : 0 };
    }));
    const reportPath = join(this.config.paths.data, "performance-learning.json");
    await writeJsonAtomic(reportPath, { generatedAt: new Date().toISOString(), cohorts });
    return { samples: metrics.length, reportPath };
  }

  async auditLinks(): Promise<{ checked: number; broken: number }> {
    const records = await this.adapters.cms.list();
    const urls = [...new Set(records.flatMap((record) => record.sourceUrls))];
    let broken = 0;
    for (const url of urls) {
      try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
        if (!response.ok) broken += 1;
      } catch {
        broken += 1;
      }
    }
    return { checked: urls.length, broken };
  }

  async dashboard(): Promise<Record<string, unknown>> {
    const records = await this.adapters.cms.list();
    const inventory = Object.fromEntries(this.config.contentTypes.flatMap((kind) => this.config.locales.map((locale) => {
      const key = `${kind.id}:${locale.id}`;
      const values = records.filter((record) => record.kind === kind.id && record.locale === locale.id);
      return [key, { draft: values.filter((record) => record.status === "draft").length, published: values.filter((record) => record.status === "published").length, reserveTarget: kind.reserveTargets[locale.id], dailyTarget: kind.dailyTargets[locale.id] }];
    })));
    return { generatedAt: new Date().toISOString(), project: this.config.project.id, inventory, aiBudget: await this.budget.snapshot() };
  }

  async dryRunSimulation(): Promise<RunSummary> {
    const startedAt = new Date().toISOString();
    const topics = await this.discoverTopics();
    const generation = await this.fillDraftInventory();
    const publication = await this.publishEligible(new Date("2026-01-15T10:30:00Z"));
    const seo = await this.analyzeSeo();
    const summary: RunSummary = {
      command: "dry-run",
      dryRun: true,
      startedAt,
      completedAt: new Date().toISOString(),
      counters: { topics: topics.length, generated: generation.created, skipped: generation.skipped, blocked: generation.blocked, publishable: publication.published, deferred: publication.deferred, seoOpportunities: seo.opportunities },
      messages: ["No CMS publication was performed", "No distribution message was sent"],
    };
    await writeJsonAtomic(join(this.config.paths.temp, "last-dry-run.json"), summary);
    return summary;
  }
}
