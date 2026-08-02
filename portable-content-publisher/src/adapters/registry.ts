import type { ProjectConfig } from "../core/types.js";
import type { AdapterBundle } from "./contracts.js";
import { MockAiAdapter, OpenAiCompatibleAdapter } from "./ai.js";
import {
  FileAnalyticsAdapter,
  FileCmsAdapter,
  FixtureSearchAdapter,
  JsonOutboxDistributionAdapter,
  LocalMediaAdapter,
} from "./file-adapters.js";
import { HttpAnalyticsAdapter, HttpCmsAdapter, HttpDistributionAdapter, HttpMediaAdapter, HttpSearchAdapter } from "./http-adapters.js";
import { NeonCmsAdapter } from "./neon.js";
import { SerpApiSearchAdapter } from "./serpapi.js";

export function createAdapters(config: ProjectConfig): AdapterBundle {
  const cms = config.adapters.cms.type === "file" ? new FileCmsAdapter(config) : config.adapters.cms.type === "http-json" ? new HttpCmsAdapter(config) : config.adapters.cms.type === "neon" ? new NeonCmsAdapter(config) : null;
  const search = config.adapters.search.type === "fixture" ? new FixtureSearchAdapter(config) : config.adapters.search.type === "http-json" ? new HttpSearchAdapter(config) : config.adapters.search.type === "serpapi" ? new SerpApiSearchAdapter(config) : null;
  const analytics = config.adapters.analytics.type === "file" ? new FileAnalyticsAdapter(config) : config.adapters.analytics.type === "http-json" ? new HttpAnalyticsAdapter(config) : null;
  const media = config.adapters.media.type === "local-catalog" ? new LocalMediaAdapter(config) : config.adapters.media.type === "http-json" ? new HttpMediaAdapter(config) : null;
  const distribution = config.adapters.distribution.type === "json-outbox" ? new JsonOutboxDistributionAdapter(config) : config.adapters.distribution.type === "http-json" ? new HttpDistributionAdapter(config) : null;
  if (!cms) throw new Error(`Unsupported CMS adapter: ${config.adapters.cms.type}`);
  if (!search) throw new Error(`Unsupported search adapter: ${config.adapters.search.type}`);
  if (!analytics) throw new Error(`Unsupported analytics adapter: ${config.adapters.analytics.type}`);
  if (!media) throw new Error(`Unsupported media adapter: ${config.adapters.media.type}`);
  if (!distribution) throw new Error(`Unsupported distribution adapter: ${config.adapters.distribution.type}`);
  const ai = config.adapters.ai.type === "mock"
    ? new MockAiAdapter()
    : config.adapters.ai.type === "openai-compatible"
      ? new OpenAiCompatibleAdapter(config)
      : null;
  if (!ai) throw new Error(`Unsupported AI adapter: ${config.adapters.ai.type}`);
  return {
    cms,
    ai,
    search,
    analytics,
    media,
    distribution,
  };
}
