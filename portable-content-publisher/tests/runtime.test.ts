import assert from "node:assert/strict";
import test from "node:test";
import { isWithinWindow, stableHash } from "../src/core/runtime.js";

test("publication windows support intervals crossing midnight", () => {
  assert.equal(isWithinWindow(new Date("2026-01-15T23:30:00Z"), "UTC", "22:00", "02:00"), true);
  assert.equal(isWithinWindow(new Date("2026-01-15T12:00:00Z"), "UTC", "22:00", "02:00"), false);
});

test("idempotency fingerprints are stable", () => {
  assert.equal(stableHash({ a: 1, b: "x" }), stableHash({ a: 1, b: "x" }));
  assert.notEqual(stableHash({ a: 1 }), stableHash({ a: 2 }));
});
