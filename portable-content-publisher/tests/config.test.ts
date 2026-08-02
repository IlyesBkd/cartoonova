import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, validateConfig } from "../src/config/load.js";

test("example configuration is complete and valid", async () => {
  const config = await loadConfig("config/project.example.json");
  assert.equal(config.version, 1);
  assert.equal(config.locales.length, 2);
  assert.equal(config.contentTypes.length, 3);
  assert.doesNotThrow(() => validateConfig(config));
});

test("configuration requires exactly one default locale", async () => {
  const config = structuredClone(await loadConfig("config/project.example.json"));
  config.locales[1]!.isDefault = true;
  assert.throws(() => validateConfig(config), /Exactly one default locale/);
});
