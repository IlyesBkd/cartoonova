#!/usr/bin/env node
import { join } from "node:path";
import { createAdapters } from "../adapters/registry.js";
import { loadConfig, validateConfig } from "../config/load.js";
import { withFileLock, writeJsonAtomic } from "../core/runtime.js";
import { PublisherEngine } from "../engine/orchestrator.js";

const command = process.argv[2] ?? "help";
const argument = process.argv[3];

const help = `Portable Content Publisher

Commands:
  config:validate       Validate the project configuration
  migrate               Initialize portable data stores
  topics:discover       Rank available topic candidates
  batch                 Refill draft inventory to configured targets
  translate             Create missing localized drafts
  publish               Publish eligible drafts within locale windows
  seo:analyze           Build search and competitor opportunity reports
  seo:optimize          Review or apply versioned content improvements
  learning              Build performance cohorts for editorial learning
  links:audit           Check external source links
  distribution:drain   Drain the distribution outbox
  dashboard             Print current inventory and budget state
  dry-run               Simulate discovery, generation, SEO and publication
  worker <name>         Run generate, publish, seo or all continuously
  help                  Show this help
`;

async function createEngine(dryRun = process.env.DRY_RUN === "1"): Promise<PublisherEngine> {
  const config = await loadConfig();
  const engine = new PublisherEngine(config, createAdapters(config), dryRun);
  await engine.initialize();
  return engine;
}

async function runWorker(name: string): Promise<never> {
  const engine = await createEngine(false);
  const actions = name === "generate"
    ? [{ interval: engine.config.workers.generationIntervalMs, run: () => engine.fillDraftInventory() }]
    : name === "publish"
      ? [{ interval: engine.config.workers.publicationIntervalMs, run: () => engine.publishEligible() }]
      : name === "seo"
        ? [{ interval: engine.config.workers.seoIntervalMs, run: () => engine.analyzeSeo() }]
        : name === "all"
          ? [
              { interval: engine.config.workers.generationIntervalMs, run: () => engine.fillDraftInventory() },
              { interval: engine.config.workers.publicationIntervalMs, run: () => engine.publishEligible() },
              { interval: engine.config.workers.seoIntervalMs, run: () => engine.analyzeSeo() },
            ]
          : [];
  if (actions.length === 0) throw new Error(`Unknown worker: ${name}`);
  const loops = actions.map(async (action) => {
    while (true) {
      try {
        process.stdout.write(`${JSON.stringify(await action.run())}\n`);
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      }
      await new Promise((resolve) => setTimeout(resolve, action.interval));
    }
  });
  await Promise.all(loops);
  throw new Error("Worker loop stopped unexpectedly");
}

async function main(): Promise<void> {
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(help);
    return;
  }
  if (command === "config:validate") {
    validateConfig(await loadConfig());
    process.stdout.write("Configuration valid\n");
    return;
  }
  if (command === "worker") return void await runWorker(argument ?? "all");
  const engine = await createEngine(command === "dry-run");
  let output: unknown;
  switch (command) {
    case "migrate":
      output = { initialized: true };
      break;
    case "topics:discover":
      output = await engine.discoverTopics();
      break;
    case "batch":
      output = await engine.fillDraftInventory();
      break;
    case "translate":
      output = await engine.translateMissing();
      break;
    case "publish":
      output = await engine.publishEligible();
      break;
    case "seo:analyze":
      output = await engine.analyzeSeo();
      break;
    case "seo:optimize":
      output = await engine.optimizeSeo(Number(process.env.SEO_OPTIMIZE_LIMIT ?? 10), process.env.SEO_APPLY === "1");
      break;
    case "learning":
      output = await engine.learnFromPerformance();
      break;
    case "links:audit":
      output = await engine.auditLinks();
      break;
    case "distribution:drain":
      output = { sent: await engine.adapters.distribution.drain() };
      break;
    case "dashboard":
      output = await engine.dashboard();
      await writeJsonAtomic(join(engine.config.paths.data, "dashboard.json"), output);
      break;
    case "dry-run":
      output = await withFileLock(join(engine.config.paths.state, "dry-run.lock"), engine.config.workers.lockTtlMs, () => engine.dryRunSimulation());
      break;
    default:
      throw new Error(`Unknown command: ${command}\n\n${help}`);
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
