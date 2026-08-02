import type {
  ContentImage,
  ContentRecord,
  GenerationRequest,
  GenerationResult,
  PerformanceMetric,
  ProjectConfig,
  QualityIssue,
  SerpResult,
  TopicCandidate,
} from "../core/types.js";

export interface CmsAdapter {
  initialize(): Promise<void>;
  list(filters?: Partial<Pick<ContentRecord, "status" | "kind" | "locale">>): Promise<ContentRecord[]>;
  get(id: string): Promise<ContentRecord | null>;
  findByFingerprint(fingerprint: string): Promise<ContentRecord | null>;
  createDraft(record: ContentRecord): Promise<{ record: ContentRecord; created: boolean }>;
  update(record: ContentRecord, expectedRevision: number): Promise<ContentRecord>;
  publish(id: string, expectedRevision: number, publishedAt: string): Promise<ContentRecord>;
}

export interface AiAdapter {
  generate(request: GenerationRequest): Promise<GenerationResult>;
  repair(request: GenerationRequest, previous: GenerationResult, issues: QualityIssue[]): Promise<GenerationResult>;
  translate(record: ContentRecord, targetLocale: string, config: ProjectConfig): Promise<GenerationResult>;
}

export interface SearchAdapter {
  discover(config: ProjectConfig): Promise<TopicCandidate[]>;
  serp(query: string, locale: string, limit: number): Promise<SerpResult[]>;
}

export interface AnalyticsAdapter {
  metrics(from: string, to: string): Promise<PerformanceMetric[]>;
}

export interface MediaAdapter {
  select(query: string, config: ProjectConfig, usedSources: Set<string>): Promise<ContentImage | null>;
  verify(image: ContentImage): Promise<boolean>;
}

export interface DistributionAdapter {
  enqueue(record: ContentRecord): Promise<void>;
  drain(): Promise<number>;
}

export interface AdapterBundle {
  cms: CmsAdapter;
  ai: AiAdapter;
  search: SearchAdapter;
  analytics: AnalyticsAdapter;
  media: MediaAdapter;
  distribution: DistributionAdapter;
}
