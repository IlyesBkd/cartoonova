import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
  ContentImage,
  ContentRecord,
  PerformanceMetric,
  ProjectConfig,
  SerpResult,
  TopicCandidate,
} from "../core/types.js";
import { ensureDirectory, readJson, withFileLock, writeJsonAtomic } from "../core/runtime.js";
import type { AnalyticsAdapter, CmsAdapter, DistributionAdapter, MediaAdapter, SearchAdapter } from "./contracts.js";

const CMS_LOCK_TTL_MS = 30_000;

function optionString(options: Record<string, unknown>, key: string, fallback: string): string {
  const value = options[key];
  return typeof value === "string" && value ? value : fallback;
}

function resolveOption(root: string, options: Record<string, unknown>, key: string, fallback: string): string {
  const value = optionString(options, key, fallback);
  return isAbsolute(value) ? value : resolve(root, value);
}

export class FileCmsAdapter implements CmsAdapter {
  private readonly path: string;
  private readonly lockPath: string;

  constructor(config: ProjectConfig) {
    this.path = resolveOption(config.paths.data, config.adapters.cms.options, "file", "content.json");
    this.lockPath = join(config.paths.state, "cms.lock");
  }

  async initialize(): Promise<void> {
    await ensureDirectory(dirname(this.path));
    const records = await readJson<ContentRecord[]>(this.path, []);
    await writeJsonAtomic(this.path, records);
  }

  private records(): Promise<ContentRecord[]> {
    return readJson<ContentRecord[]>(this.path, []);
  }

  async list(filters: Partial<Pick<ContentRecord, "status" | "kind" | "locale">> = {}): Promise<ContentRecord[]> {
    return (await this.records()).filter((record) => Object.entries(filters).every(([key, value]) => record[key as keyof typeof filters] === value));
  }

  async get(id: string): Promise<ContentRecord | null> {
    return (await this.records()).find((record) => record.id === id) ?? null;
  }

  async findByFingerprint(fingerprint: string): Promise<ContentRecord | null> {
    return (await this.records()).find((record) => record.fingerprint === fingerprint) ?? null;
  }

  async createDraft(record: ContentRecord): Promise<{ record: ContentRecord; created: boolean }> {
    return withFileLock(this.lockPath, CMS_LOCK_TTL_MS, async () => {
      const records = await this.records();
      const existing = records.find((candidate) => candidate.fingerprint === record.fingerprint);
      if (existing) return { record: existing, created: false };
      records.push(record);
      await writeJsonAtomic(this.path, records);
      return { record, created: true };
    });
  }

  private async updateLocked(records: ContentRecord[], record: ContentRecord, expectedRevision: number): Promise<ContentRecord> {
    const index = records.findIndex((candidate) => candidate.id === record.id);
    if (index < 0) throw new Error(`Content not found: ${record.id}`);
    if (records[index]!.revision !== expectedRevision) throw new Error(`Revision conflict: ${record.id}`);
    const updated = { ...record, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    records[index] = updated;
    await writeJsonAtomic(this.path, records);
    return updated;
  }

  async update(record: ContentRecord, expectedRevision: number): Promise<ContentRecord> {
    return withFileLock(this.lockPath, CMS_LOCK_TTL_MS, async () => this.updateLocked(await this.records(), record, expectedRevision));
  }

  async publish(id: string, expectedRevision: number, publishedAt: string): Promise<ContentRecord> {
    return withFileLock(this.lockPath, CMS_LOCK_TTL_MS, async () => {
      const records = await this.records();
      const record = records.find((candidate) => candidate.id === id) ?? null;
      if (!record) throw new Error(`Content not found: ${id}`);
      if (record.status === "published") return record;
      if (record.status !== "draft" && record.status !== "scheduled") throw new Error(`Invalid publish transition: ${record.status}`);
      return this.updateLocked(records, { ...record, status: "published", publishedAt }, expectedRevision);
    });
  }
}

export class FixtureSearchAdapter implements SearchAdapter {
  private readonly topicsPath: string;
  private readonly serpPath: string;

  constructor(config: ProjectConfig) {
    this.topicsPath = resolveOption(process.cwd(), config.adapters.search.options, "topicsFile", "fixtures/topics.json");
    this.serpPath = resolveOption(process.cwd(), config.adapters.search.options, "serpFile", "fixtures/serp.json");
  }

  async discover(_config: ProjectConfig): Promise<TopicCandidate[]> {
    return JSON.parse(await readFile(this.topicsPath, "utf8")) as TopicCandidate[];
  }

  async serp(query: string, _locale: string, limit: number): Promise<SerpResult[]> {
    const all = JSON.parse(await readFile(this.serpPath, "utf8")) as SerpResult[];
    return all.filter((result) => result.query.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(result.query.toLowerCase())).slice(0, limit);
  }
}

export class FileAnalyticsAdapter implements AnalyticsAdapter {
  private readonly path: string;

  constructor(config: ProjectConfig) {
    this.path = resolveOption(process.cwd(), config.adapters.analytics.options, "file", "fixtures/analytics.json");
  }

  async metrics(from: string, to: string): Promise<PerformanceMetric[]> {
    const metrics = JSON.parse(await readFile(this.path, "utf8")) as PerformanceMetric[];
    return metrics.filter((metric) => metric.date >= from && metric.date <= to);
  }
}

export class LocalMediaAdapter implements MediaAdapter {
  private readonly catalogPath: string;

  constructor(config: ProjectConfig) {
    this.catalogPath = resolveOption(process.cwd(), config.adapters.media.options, "catalogFile", "fixtures/media.json");
  }

  async select(query: string, config: ProjectConfig, usedSources: Set<string>): Promise<ContentImage | null> {
    const images = JSON.parse(await readFile(this.catalogPath, "utf8")) as Array<ContentImage & { tags?: string[] }>;
    const terms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    return images.find((image) => {
      const matches = (image.tags ?? []).some((tag) => terms.has(tag.toLowerCase()));
      const sourceAllowed = !config.images.requireDistinctSources || !usedSources.has(image.sourceUrl);
      return matches && sourceAllowed;
    }) ?? images.find((image) => !config.images.requireDistinctSources || !usedSources.has(image.sourceUrl)) ?? null;
  }

  async verify(image: ContentImage): Promise<boolean> {
    return image.url.startsWith("https://") || image.url.startsWith("file://");
  }
}

interface OutboxItem {
  contentId: string;
  locale: string;
  title: string;
  url: string;
  enqueuedAt: string;
  sentAt?: string;
}

export class JsonOutboxDistributionAdapter implements DistributionAdapter {
  private readonly path: string;
  private readonly siteUrl: string;

  constructor(config: ProjectConfig) {
    this.path = resolveOption(config.paths.data, config.adapters.distribution.options, "file", "distribution-outbox.json");
    this.siteUrl = config.project.siteUrl;
  }

  async enqueue(record: ContentRecord): Promise<void> {
    const outbox = await readJson<OutboxItem[]>(this.path, []);
    if (outbox.some((item) => item.contentId === record.id)) return;
    outbox.push({
      contentId: record.id,
      locale: record.locale,
      title: record.title,
      url: new URL(record.seo.canonicalPath, this.siteUrl).toString(),
      enqueuedAt: new Date().toISOString(),
    });
    await writeJsonAtomic(this.path, outbox);
  }

  async drain(): Promise<number> {
    const outbox = await readJson<OutboxItem[]>(this.path, []);
    let count = 0;
    const sent = outbox.map((item) => {
      if (item.sentAt) return item;
      count += 1;
      return { ...item, sentAt: new Date().toISOString() };
    });
    await writeJsonAtomic(this.path, sent);
    return count;
  }
}
