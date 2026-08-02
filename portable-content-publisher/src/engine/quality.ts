import type { ContentImage, ContentTypeConfig, GenerationResult, ProjectConfig, QualityIssue, QualityReport } from "../core/types.js";

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function validateGenerated(
  generated: GenerationResult,
  kind: ContentTypeConfig,
  images: ContentImage[],
  config: ProjectConfig,
): QualityReport {
  const issues: QualityIssue[] = [];
  const words = countWords(generated.body.replace(/[#*_`>\[\]()]/g, " "));
  if (words < kind.minWords) issues.push({ code: "BODY_TOO_SHORT", severity: "error", message: `${words}/${kind.minWords} words` });
  if (words > kind.maxWords) issues.push({ code: "BODY_TOO_LONG", severity: "warning", message: `${words}/${kind.maxWords} words` });
  if (generated.seoTitle.length < config.seo.minTitleLength || generated.seoTitle.length > config.seo.maxTitleLength) {
    issues.push({ code: "SEO_TITLE_LENGTH", severity: "error", message: `SEO title length is ${generated.seoTitle.length}` });
  }
  if (generated.seoDescription.length < config.seo.minDescriptionLength || generated.seoDescription.length > config.seo.maxDescriptionLength) {
    issues.push({ code: "SEO_DESCRIPTION_LENGTH", severity: "error", message: `SEO description length is ${generated.seoDescription.length}` });
  }
  if (images.length < kind.requiredImages) issues.push({ code: "MISSING_IMAGES", severity: "error", message: `${images.length}/${kind.requiredImages} images` });
  if (config.images.requireDistinctSources && new Set(images.map((image) => image.sourceUrl)).size !== images.length) {
    issues.push({ code: "DUPLICATE_IMAGE_SOURCE", severity: "error", message: "Image sources must be distinct" });
  }
  for (const image of images) {
    if (image.width < config.images.minWidth || image.height < config.images.minHeight) {
      issues.push({ code: "IMAGE_TOO_SMALL", severity: "error", message: image.url });
    }
    if (image.bytes > config.images.maxBytes || !config.images.allowedMimeTypes.includes(image.mimeType)) {
      issues.push({ code: "IMAGE_INVALID", severity: "error", message: image.url });
    }
  }
  const searchable = `${generated.title}\n${generated.excerpt}\n${generated.body}`.toLowerCase();
  for (const forbidden of config.project.editorial.forbiddenPatterns) {
    if (searchable.includes(forbidden.toLowerCase())) issues.push({ code: "FORBIDDEN_PATTERN", severity: "error", message: forbidden });
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return { passed: errors === 0, score: Math.max(0, 100 - errors * 20 - (issues.length - errors) * 5), wordCount: words, issues };
}

export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}
