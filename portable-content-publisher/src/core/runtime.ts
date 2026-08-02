import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProjectConfig } from "./types.js";

export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await ensureDirectory(dirname(path));
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export async function withFileLock<T>(path: string, ttlMs: number, task: () => Promise<T>): Promise<T> {
  await ensureDirectory(dirname(path));
  try {
    const handle = await open(path, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const lock = await readJson<{ createdAt?: string }>(path, {});
    const age = lock.createdAt ? Date.now() - Date.parse(lock.createdAt) : Number.POSITIVE_INFINITY;
    if (age <= ttlMs) throw new Error(`Worker lock is active: ${path}`);
    await rm(path, { force: true });
    return withFileLock(path, ttlMs, task);
  }
  try {
    return await task();
  } finally {
    await rm(path, { force: true });
  }
}

export class Logger {
  constructor(private readonly scope: string, private readonly logFile?: string) {}

  async log(level: "debug" | "info" | "warn" | "error", message: string, data?: unknown): Promise<void> {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, scope: this.scope, message, data });
    process.stdout.write(`${line}\n`);
    if (this.logFile) {
      await ensureDirectory(dirname(this.logFile));
      await appendFile(this.logFile, `${line}\n`, { mode: 0o600 });
    }
  }
}

interface BudgetState {
  date: string;
  calls: number;
  estimatedTokens: number;
  consecutiveFailures: number;
  circuitOpenedAt?: string;
}

export class AiBudget {
  private readonly path: string;

  constructor(private readonly config: ProjectConfig) {
    this.path = join(config.paths.state, "ai-budget.json");
  }

  private today(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: this.config.project.timezone }).format(new Date());
  }

  private async state(): Promise<BudgetState> {
    const current = await readJson<BudgetState>(this.path, { date: this.today(), calls: 0, estimatedTokens: 0, consecutiveFailures: 0 });
    return current.date === this.today()
      ? current
      : { date: this.today(), calls: 0, estimatedTokens: 0, consecutiveFailures: 0 };
  }

  async assertAvailable(estimatedTokens: number): Promise<void> {
    const state = await this.state();
    if (state.circuitOpenedAt) {
      const elapsed = Date.now() - Date.parse(state.circuitOpenedAt);
      if (elapsed < this.config.ai.circuitBreakerCooldownMs) throw new Error("AI circuit breaker is open");
    }
    if (state.calls >= this.config.ai.maxCallsPerDay) throw new Error("Daily AI call budget exhausted");
    if (state.estimatedTokens + estimatedTokens > this.config.ai.maxTokensPerDay) throw new Error("Daily AI token budget exhausted");
  }

  async recordSuccess(estimatedTokens: number): Promise<void> {
    const state = await this.state();
    const { circuitOpenedAt: _circuitOpenedAt, ...closedState } = state;
    await writeJsonAtomic(this.path, { ...closedState, calls: state.calls + 1, estimatedTokens: state.estimatedTokens + estimatedTokens, consecutiveFailures: 0 });
  }

  async recordFailure(): Promise<void> {
    const state = await this.state();
    const failures = state.consecutiveFailures + 1;
    await writeJsonAtomic(this.path, {
      ...state,
      calls: state.calls + 1,
      consecutiveFailures: failures,
      circuitOpenedAt: failures >= this.config.ai.circuitBreakerFailures ? new Date().toISOString() : state.circuitOpenedAt,
    });
  }

  async snapshot(): Promise<BudgetState> {
    return this.state();
  }
}

export async function retryBounded<T>(attempts: number, delayMs: number, task: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export function isWithinWindow(now: Date, timezone: string, start: string, end: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const parse = (clock: string): number => {
    const [hours = "0", minutes = "0"] = clock.split(":");
    return Number(hours) * 60 + Number(minutes);
  };
  const from = parse(start);
  const to = parse(end);
  return from <= to ? current >= from && current <= to : current >= from || current <= to;
}
