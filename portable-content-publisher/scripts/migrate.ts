import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createAdapters } from "../src/adapters/registry.js";
import { loadConfig } from "../src/config/load.js";
import { writeJsonAtomic } from "../src/core/runtime.js";

const config = await loadConfig();
await Promise.all(Object.values(config.paths).map((path) => mkdir(path, { recursive: true })));
await createAdapters(config).cms.initialize();
await writeJsonAtomic(join(config.paths.state, "schema.json"), { version: 1, migratedAt: new Date().toISOString() });
process.stdout.write(`Initialized project ${config.project.id}\n`);
