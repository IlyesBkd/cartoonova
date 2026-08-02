import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config/load.js";
import { slugify, validateGenerated } from "../src/engine/quality.js";
import type { ContentImage, GenerationResult } from "../src/core/types.js";

const config = await loadConfig("config/project.example.json");
const kind = config.contentTypes[0]!;

const goodImage: ContentImage = {
  url: "https://example.org/photo.jpg",
  alt: "photo",
  sourceUrl: "https://example.org/photo.jpg",
  width: 1600,
  height: 900,
  mimeType: "image/jpeg",
  bytes: 200_000,
};

function goodGeneration(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    title: "A sufficiently detailed example title",
    excerpt: "A sufficiently detailed excerpt for the portable test record.",
    body: "word ".repeat(400),
    seoTitle: "A sufficiently detailed example title for SEO",
    seoDescription: "A sufficiently detailed search description that satisfies the configured minimum length for this verification case.",
    imageQueries: ["example"],
    ...overrides,
  };
}

test("validateGenerated passes a compliant draft", () => {
  const report = validateGenerated(goodGeneration(), kind, [goodImage, { ...goodImage, url: "https://example.org/two.jpg", sourceUrl: "https://example.org/two.jpg" }], config);
  assert.equal(report.passed, true);
  assert.equal(report.issues.length, 0);
});

test("validateGenerated rejects a body that is too short", () => {
  const report = validateGenerated(goodGeneration({ body: "word ".repeat(10) }), kind, [goodImage, goodImage], config);
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "BODY_TOO_SHORT"));
});

test("validateGenerated rejects missing or duplicate-source images", () => {
  const missing = validateGenerated(goodGeneration(), kind, [goodImage], config);
  assert.equal(missing.passed, false);
  assert.ok(missing.issues.some((issue) => issue.code === "MISSING_IMAGES"));

  const duplicate = validateGenerated(goodGeneration(), kind, [goodImage, goodImage], config);
  assert.equal(duplicate.passed, false);
  assert.ok(duplicate.issues.some((issue) => issue.code === "DUPLICATE_IMAGE_SOURCE"));
});

test("validateGenerated rejects forbidden editorial patterns", () => {
  const report = validateGenerated(
    goodGeneration({ body: `${"word ".repeat(400)} guaranteed miracle results` }),
    kind,
    [goodImage, { ...goodImage, url: "https://example.org/two.jpg", sourceUrl: "https://example.org/two.jpg" }],
    config,
  );
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "FORBIDDEN_PATTERN"));
});

test("slugify normalizes accents and strips unsafe characters", () => {
  assert.equal(slugify("Rénovation énergétique : le Guide !"), "renovation-energetique-le-guide");
});
