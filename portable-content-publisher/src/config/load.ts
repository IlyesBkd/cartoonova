import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { ProjectConfig } from "../core/types.js";

async function loadDotEnv(): Promise<void> {
  const path = resolve(process.env.PUBLISHER_ROOT ?? process.cwd(), ".env");
  const content = await readFile(path, "utf8").catch(() => "");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function expandEnvironment(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_match, name: string, fallback: string | undefined) => {
      const resolved = process.env[name] ?? fallback;
      if (resolved === undefined) throw new Error(`Missing environment variable: ${name}`);
      return resolved;
    });
  }
  if (Array.isArray(value)) return value.map(expandEnvironment);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, expandEnvironment(nested)]));
  }
  return value;
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
}

function validateClock(value: string, path: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${path} must use HH:MM`);
}

export function validateConfig(value: unknown): asserts value is ProjectConfig {
  if (!value || typeof value !== "object") throw new Error("Configuration must be an object");
  const config = value as Partial<ProjectConfig>;
  if (config.version !== 1) throw new Error("Unsupported configuration version");
  if (!config.project) throw new Error("project is required");
  requireString(config.project.id, "project.id");
  requireString(config.project.name, "project.name");
  requireString(config.project.siteUrl, "project.siteUrl");
  requireString(config.project.timezone, "project.timezone");
  requireString(config.project.topic, "project.topic");
  try {
    new URL(config.project.siteUrl);
    new Intl.DateTimeFormat("en", { timeZone: config.project.timezone });
  } catch {
    throw new Error("project.siteUrl or project.timezone is invalid");
  }
  if (!Array.isArray(config.locales) || config.locales.length === 0) throw new Error("At least one locale is required");
  if (config.locales.filter((locale) => locale.isDefault).length !== 1) throw new Error("Exactly one default locale is required");
  for (const locale of config.locales) {
    requireString(locale.id, "locales[].id");
    if (!Array.isArray(locale.publicationWindows) || locale.publicationWindows.length === 0) {
      throw new Error(`Locale ${locale.id} needs a publication window`);
    }
    locale.publicationWindows.forEach((window, index) => {
      validateClock(window.start, `locales.${locale.id}.publicationWindows.${index}.start`);
      validateClock(window.end, `locales.${locale.id}.publicationWindows.${index}.end`);
    });
  }
  if (!Array.isArray(config.contentTypes) || config.contentTypes.length === 0) throw new Error("At least one content type is required");
  for (const kind of config.contentTypes) {
    requireString(kind.id, "contentTypes[].id");
    if (kind.minWords < 1 || kind.maxWords < kind.minWords) throw new Error(`Invalid word limits for ${kind.id}`);
    for (const locale of config.locales) {
      if (!Number.isInteger(kind.dailyTargets[locale.id]) || kind.dailyTargets[locale.id]! < 0) {
        throw new Error(`Missing daily target for ${kind.id}/${locale.id}`);
      }
      if (!Number.isInteger(kind.reserveTargets[locale.id]) || kind.reserveTargets[locale.id]! < 0) {
        throw new Error(`Missing reserve target for ${kind.id}/${locale.id}`);
      }
    }
  }
  if (!config.adapters?.cms || !config.adapters.ai || !config.adapters.search || !config.adapters.analytics || !config.adapters.media || !config.adapters.distribution) {
    throw new Error("All adapters must be configured");
  }
  if (!config.ai || config.ai.maxCallsPerDay < 1 || config.ai.maxAttemptsPerItem < 1) throw new Error("Invalid AI budget");
  if (!config.paths) throw new Error("paths is required");
}

export async function loadConfig(path?: string): Promise<ProjectConfig> {
  await loadDotEnv();
  const resolvedPath = path ?? process.env.PROJECT_CONFIG ?? "config/project.example.json";
  const absolutePath = isAbsolute(resolvedPath) ? resolvedPath : resolve(process.cwd(), resolvedPath);
  const raw = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  const expanded = expandEnvironment(raw);
  validateConfig(expanded);
  const root = process.env.PUBLISHER_ROOT ?? process.cwd();
  for (const key of ["data", "state", "temp", "logs"] as const) {
    if (!isAbsolute(expanded.paths[key])) expanded.paths[key] = resolve(root, expanded.paths[key]);
  }
  return expanded;
}
