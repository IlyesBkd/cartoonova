import type { AiAdapter } from "./contracts.js";
import type { ContentRecord, GenerationRequest, GenerationResult, ProjectConfig, QualityIssue } from "../core/types.js";

function paragraphs(request: GenerationRequest, count: number): string[] {
  const locale = request.locale.id;
  const subject = request.topic.title;
  const source = request.topic.summary;
  const principles = request.project.project.editorial.principles.join(", ");
  return Array.from({ length: count }, (_, index) =>
    locale === "fr"
      ? `## ${index + 1}. Un angle concret sur ${subject}\n\n${source} Cette analyse examine les conséquences pratiques, les limites et les décisions possibles pour le public visé. Elle distingue les faits vérifiables des hypothèses, relie le sujet à son contexte et expose ce qui reste encore à confirmer. Les principes éditoriaux appliqués sont : ${principles}.`
      : `## ${index + 1}. A practical angle on ${subject}\n\n${source} This analysis examines practical consequences, limits and decisions for the intended audience. It separates verified facts from assumptions, connects the topic to its context and states what still needs confirmation. The editorial principles applied are: ${principles}.`,
  );
}

export class MockAiAdapter implements AiAdapter {
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const sections = Math.max(5, Math.ceil(request.kind.minWords / 65));
    const title = request.topic.title;
    return {
      title,
      excerpt: request.topic.summary,
      body: paragraphs(request, sections).join("\n\n"),
      seoTitle: title.slice(0, request.project.seo.maxTitleLength),
      seoDescription: request.topic.summary.slice(0, request.project.seo.maxDescriptionLength),
      imageQueries: [title, `${request.topic.category} ${request.topic.keywords[0] ?? "overview"}`],
    };
  }

  async repair(request: GenerationRequest, previous: GenerationResult, issues: QualityIssue[]): Promise<GenerationResult> {
    const extra = paragraphs(request, Math.max(2, issues.length));
    return {
      ...previous,
      body: `${previous.body}\n\n${extra.join("\n\n")}`,
      seoDescription: previous.seoDescription.padEnd(request.project.seo.minDescriptionLength, ".").slice(0, request.project.seo.maxDescriptionLength),
    };
  }

  async translate(record: ContentRecord, targetLocale: string, config: ProjectConfig): Promise<GenerationResult> {
    const suffix = targetLocale === "fr" ? "Version française" : `Localized ${targetLocale} edition`;
    return {
      title: `${record.title} - ${suffix}`,
      excerpt: `${record.excerpt} (${suffix})`,
      body: `${record.body}\n\n_Translation target: ${targetLocale}. Editorial voice: ${config.project.editorial.voice}._`,
      seoTitle: record.seo.title,
      seoDescription: record.seo.description,
      imageQueries: record.images.map((image) => image.alt),
    };
  }
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function assertGenerationResult(value: unknown): asserts value is GenerationResult {
  if (!value || typeof value !== "object") throw new Error("AI response is not a JSON object");
  const candidate = value as Partial<GenerationResult>;
  for (const field of ["title", "excerpt", "body", "seoTitle", "seoDescription"] as const) {
    if (typeof candidate[field] !== "string" || candidate[field]!.trim() === "") {
      throw new Error(`AI response is missing a non-empty string field: ${field}`);
    }
  }
  if (!Array.isArray(candidate.imageQueries) || candidate.imageQueries.some((query) => typeof query !== "string")) {
    throw new Error("AI response field imageQueries must be a string array");
  }
}

export class OpenAiCompatibleAdapter implements AiAdapter {
  constructor(private readonly config: ProjectConfig) {}

  private async call(system: string, payload: unknown, model: string): Promise<GenerationResult> {
    const endpoint = String(this.config.adapters.ai.options.endpoint ?? "");
    const apiKey = String(this.config.adapters.ai.options.apiKey ?? "");
    if (!endpoint || !apiKey) throw new Error("AI endpoint and apiKey are required");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: this.config.ai.temperature, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }] }),
    });
    if (!response.ok) throw new Error(`AI request failed with ${response.status}`);
    const json = (await response.json()) as ChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI response is empty");
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI response is not valid JSON");
    }
    assertGenerationResult(parsed);
    return parsed;
  }

  generate(request: GenerationRequest): Promise<GenerationResult> {
    const system = [
      `Write entirely in ${request.locale.language} (locale "${request.locale.id}", market ${request.locale.market}). Every field — title, excerpt, body, seoTitle, seoDescription — must be in that language, with no other language mixed in.`,
      `Editorial voice: ${request.project.project.editorial.voice}. Audience: ${request.project.project.editorial.audience}.`,
      `Principles: ${request.project.project.editorial.principles.join("; ")}.`,
      `Never use these forbidden phrasings or their direct translation: ${request.project.project.editorial.forbiddenPatterns.join("; ") || "none"}.`,
      `Body must be Markdown with "##" section headings, between ${request.kind.minWords} and ${request.kind.maxWords} words, and read as original analysis rather than a rewritten source summary.`,
      `seoTitle must be ${request.project.seo.minTitleLength}-${request.project.seo.maxTitleLength} characters. seoDescription must be ${request.project.seo.minDescriptionLength}-${request.project.seo.maxDescriptionLength} characters.`,
      "imageQueries must be 2-4 short English keyword phrases describing the images this article needs (used to search a media catalog, not shown to readers).",
      "Return strictly valid JSON with keys: title, excerpt, body, seoTitle, seoDescription, imageQueries. No prose outside the JSON object.",
    ].join("\n");
    return this.call(system, request, this.config.ai.model);
  }

  repair(request: GenerationRequest, previous: GenerationResult, issues: QualityIssue[]): Promise<GenerationResult> {
    const system = [
      `Repair the article below so it satisfies every listed issue, while preserving verified facts and staying entirely in ${request.locale.language} (locale "${request.locale.id}").`,
      `Editorial voice: ${request.project.project.editorial.voice}.`,
      "Return the complete corrected JSON object with keys: title, excerpt, body, seoTitle, seoDescription, imageQueries. No prose outside the JSON object.",
    ].join("\n");
    return this.call(system, { request, previous, issues }, this.config.ai.model);
  }

  translate(record: ContentRecord, targetLocale: string, config: ProjectConfig): Promise<GenerationResult> {
    const locale = config.locales.find((candidate) => candidate.id === targetLocale);
    const system = [
      `Translate and fully localize this article into ${locale?.language ?? targetLocale} (locale "${targetLocale}"). Do not leave any sentence in the source language.`,
      `Preserve facts and structure (Markdown "##" headings). Editorial voice: ${config.project.editorial.voice}.`,
      "Return the same JSON content contract: title, excerpt, body, seoTitle, seoDescription, imageQueries. No prose outside the JSON object.",
    ].join("\n");
    return this.call(system, { record, targetLocale, editorial: config.project.editorial }, this.config.ai.translationModel);
  }
}
