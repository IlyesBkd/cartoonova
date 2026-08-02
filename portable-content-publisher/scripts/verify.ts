import { access, constants } from "node:fs/promises";
import { createAdapters } from "../src/adapters/registry.js";
import { loadConfig } from "../src/config/load.js";
import { PublisherEngine } from "../src/engine/orchestrator.js";

const config = await loadConfig();
for (const path of Object.values(config.paths)) {
  try {
    await access(path, constants.R_OK | constants.W_OK);
  } catch {
    throw new Error(`Runtime directory is missing or unwritable: ${path}\nRun "npm run migrate" first.`);
  }
}
const adapters = createAdapters(config);
const engine = new PublisherEngine(config, adapters, true);
await engine.initialize();
const topics = await engine.discoverTopics();
if (topics.length === 0) throw new Error("No topic candidate available");
const dashboard = await engine.dashboard();
process.stdout.write(`${JSON.stringify({ ok: true, project: config.project.id, topics: topics.length, dashboard }, null, 2)}\n`);
