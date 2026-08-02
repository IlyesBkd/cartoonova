import type {
  ContentImage,
  ContentRecord,
  PerformanceMetric,
  ProjectConfig,
  SerpResult,
  TopicCandidate,
} from "../core/types.js";
import type { AnalyticsAdapter, CmsAdapter, DistributionAdapter, MediaAdapter, SearchAdapter } from "./contracts.js";

class JsonHttpClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: Record<string, unknown>) {
    this.baseUrl = String(options.baseUrl ?? "").replace(/\/$/, "");
    this.token = String(options.token ?? "");
    if (!this.baseUrl) throw new Error("HTTP adapter baseUrl is required");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { accept: "application/json", "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP adapter ${method} ${path} failed with ${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export class HttpCmsAdapter implements CmsAdapter {
  private readonly client: JsonHttpClient;

  constructor(config: ProjectConfig) {
    this.client = new JsonHttpClient(config.adapters.cms.options);
  }

  async initialize(): Promise<void> {
    await this.client.request("POST", "/initialize", { schemaVersion: 1 });
  }

  list(filters: Partial<Pick<ContentRecord, "status" | "kind" | "locale">> = {}): Promise<ContentRecord[]> {
    return this.client.request("POST", "/content/query", filters);
  }

  async get(id: string): Promise<ContentRecord | null> {
    return this.client.request("GET", `/content/${encodeURIComponent(id)}`);
  }

  async findByFingerprint(fingerprint: string): Promise<ContentRecord | null> {
    return this.client.request("GET", `/content/by-fingerprint/${encodeURIComponent(fingerprint)}`);
  }

  async createDraft(record: ContentRecord): Promise<{ record: ContentRecord; created: boolean }> {
    return this.client.request("POST", "/content", record);
  }

  async update(record: ContentRecord, expectedRevision: number): Promise<ContentRecord> {
    return this.client.request("PUT", `/content/${encodeURIComponent(record.id)}`, { record, expectedRevision });
  }

  async publish(id: string, expectedRevision: number, publishedAt: string): Promise<ContentRecord> {
    return this.client.request("POST", `/content/${encodeURIComponent(id)}/publish`, { expectedRevision, publishedAt });
  }
}

export class HttpSearchAdapter implements SearchAdapter {
  private readonly client: JsonHttpClient;

  constructor(config: ProjectConfig) {
    this.client = new JsonHttpClient(config.adapters.search.options);
  }

  discover(config: ProjectConfig): Promise<TopicCandidate[]> {
    return this.client.request("POST", "/discover", { project: config.project, sources: config.sources, contentTypes: config.contentTypes, locales: config.locales });
  }

  serp(query: string, locale: string, limit: number): Promise<SerpResult[]> {
    return this.client.request("POST", "/serp", { query, locale, limit });
  }
}

export class HttpAnalyticsAdapter implements AnalyticsAdapter {
  private readonly client: JsonHttpClient;

  constructor(config: ProjectConfig) {
    this.client = new JsonHttpClient(config.adapters.analytics.options);
  }

  metrics(from: string, to: string): Promise<PerformanceMetric[]> {
    return this.client.request("POST", "/metrics", { from, to });
  }
}

export class HttpMediaAdapter implements MediaAdapter {
  private readonly client: JsonHttpClient;

  constructor(config: ProjectConfig) {
    this.client = new JsonHttpClient(config.adapters.media.options);
  }

  select(query: string, config: ProjectConfig, usedSources: Set<string>): Promise<ContentImage | null> {
    return this.client.request("POST", "/media/select", { query, rules: config.images, usedSources: [...usedSources], allowDomains: config.sources.allowDomains });
  }

  async verify(image: ContentImage): Promise<boolean> {
    const response = await fetch(image.url, { method: "HEAD", signal: AbortSignal.timeout(10_000) }).catch(() => null);
    return Boolean(response?.ok);
  }
}

export class HttpDistributionAdapter implements DistributionAdapter {
  private readonly client: JsonHttpClient;

  constructor(config: ProjectConfig) {
    this.client = new JsonHttpClient(config.adapters.distribution.options);
  }

  async enqueue(record: ContentRecord): Promise<void> {
    await this.client.request("POST", "/outbox", { idempotencyKey: record.id, record });
  }

  async drain(): Promise<number> {
    const result = await this.client.request<{ sent: number }>("POST", "/outbox/drain");
    return result.sent;
  }
}
