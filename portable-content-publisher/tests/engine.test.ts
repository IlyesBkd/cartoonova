import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAdapters } from "../src/adapters/registry.js";
import { loadConfig } from "../src/config/load.js";
import { PublisherEngine } from "../src/engine/orchestrator.js";

test("dry-run exercises generation without persisting or publishing", async () => {
  const root = await mkdtemp(join(tmpdir(), "publisher-engine-"));
  try {
    const config = structuredClone(await loadConfig("config/project.example.json"));
    config.paths = { data: join(root, "data"), state: join(root, "state"), temp: join(root, "tmp"), logs: join(root, "logs") };
    config.ai.retryDelayMs = 0;
    const adapters = createAdapters(config);
    const engine = new PublisherEngine(config, adapters, true);
    await engine.initialize();
    const summary = await engine.dryRunSimulation();
    assert.equal(summary.dryRun, true);
    assert.ok(summary.counters.generated! > 0);
    assert.equal((await adapters.cms.list()).length, 0);
    assert.equal(await adapters.distribution.drain(), 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
