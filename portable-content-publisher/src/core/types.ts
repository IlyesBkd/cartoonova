export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export interface PublicationWindow {
  start: string;
  end: string;
  weight?: number;
}

export interface LocaleConfig {
  id: string;
  language: string;
  market: string;
  isDefault: boolean;
  publicationWindows: PublicationWindow[];
}

export interface ContentTypeConfig {
  id: string;
  label: string;
  minWords: number;
  maxWords: number;
  requiredImages: number;
  dailyTargets: Record<string, number>;
  reserveTargets: Record<string, number>;
  categories: string[];
}

export interface AdapterConfig {
  type: string;
  options: Record<string, unknown>;
}

export interface ProjectConfig {
  version: 1;
  project: {
    id: string;
    name: string;
    siteUrl: string;
    timezone: string;
    topic: string;
    description: string;
    editorial: {
      voice: string;
      audience: string;
      principles: string[];
      forbiddenPatterns: string[];
    };
  };
  contentTypes: ContentTypeConfig[];
  locales: LocaleConfig[];
  sources: {
    seeds: string[];
    /**
     * Seeds written in each market's own language. Topic discovery queries a
     * localized Google (domain, `hl`, `gl`), so a French seed sent to
     * google.pl returns French pages: without per-locale seeds, every market
     * inherits the default locale's topics.
     *
     * Locales absent from this map are not discovered in — they still receive
     * translations of what the default locale discovered.
     */
    seedsByLocale?: Record<string, string[]>;
    /**
     * Cap on seeds queried per non-default locale, per discovery run. Each
     * seed is one paid search: this is the knob that bounds the bill when the
     * locale count grows.
     */
    maxSeedsPerLocale?: number;
    allowDomains: string[];
    denyDomains: string[];
    requireAttribution: boolean;
  };
  adapters: {
    cms: AdapterConfig;
    ai: AdapterConfig;
    search: AdapterConfig;
    analytics: AdapterConfig;
    media: AdapterConfig;
    distribution: AdapterConfig;
  };
  ai: {
    model: string;
    translationModel: string;
    temperature: number;
    maxCallsPerDay: number;
    maxTokensPerDay: number;
    maxAttemptsPerItem: number;
    maxCorrectionsPerItem: number;
    retryDelayMs: number;
    circuitBreakerFailures: number;
    circuitBreakerCooldownMs: number;
  };
  seo: {
    enabled: boolean;
    minTitleLength: number;
    maxTitleLength: number;
    minDescriptionLength: number;
    maxDescriptionLength: number;
    competitorCount: number;
    refreshLookbackDays: number;
    minimumImpressionsForRefresh: number;
    protectedPaths: string[];
  };
  images: {
    minWidth: number;
    minHeight: number;
    maxBytes: number;
    allowedMimeTypes: string[];
    requireDistinctSources: boolean;
  };
  publishing: {
    minDelayMinutes: number;
    maxDelayMinutes: number;
    requireCompleteTranslations: boolean;
    timezone: string;
  };
  workers: {
    generationIntervalMs: number;
    publicationIntervalMs: number;
    seoIntervalMs: number;
    lockTtlMs: number;
  };
  paths: {
    data: string;
    state: string;
    temp: string;
    logs: string;
  };
}

export interface TopicCandidate {
  id: string;
  title: string;
  summary: string;
  sourceUrls: string[];
  keywords: string[];
  category: string;
  freshness: number;
  demand: number;
  authority: number;
  discoveredAt: string;
  /**
   * Market the topic was found in. Generation still happens in the default
   * locale before translation — this records provenance, so a topic that only
   * matters in one market can be recognised as such.
   */
  discoveredIn?: string;
}

export interface ContentImage {
  url: string;
  alt: string;
  sourceUrl: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
}

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  keywords: string[];
}

export interface ContentRecord {
  id: string;
  projectId: string;
  topicId: string;
  kind: string;
  locale: string;
  category: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  images: ContentImage[];
  sourceUrls: string[];
  seo: SeoMetadata;
  status: ContentStatus;
  fingerprint: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
}

export interface QualityIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
}

export interface QualityReport {
  passed: boolean;
  score: number;
  wordCount: number;
  issues: QualityIssue[];
}

export interface SerpResult {
  query: string;
  url: string;
  title: string;
  description: string;
  position: number;
  headings: string[];
}

export interface PerformanceMetric {
  contentId: string;
  locale: string;
  date: string;
  impressions: number;
  clicks: number;
  position: number;
  engagedSeconds: number;
}

export interface GenerationRequest {
  topic: TopicCandidate;
  kind: ContentTypeConfig;
  locale: LocaleConfig;
  project: ProjectConfig;
}

export interface GenerationResult {
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  imageQueries: string[];
}

export interface RunSummary {
  command: string;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  counters: Record<string, number>;
  messages: string[];
}
