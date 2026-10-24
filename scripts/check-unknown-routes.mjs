import assert from "node:assert/strict";

// Local-only regression check: never send POST probes to the live store.
const base = "http://127.0.0.1:3217";
const cases = [
  ["GET", "/xmlrpc.php", 404],
  ["POST", "/xmlrpc.php", 404],
  ["GET", "/wp-login.php", 404],
  ["GET", "/xmlrpc.php/a", 404],
  ["GET", "/fr/adresse-inconnue-test", 404],
  ["GET", "/fr", 200],
  ["GET", "/en", 200],
  ["GET", "/favicon_io/favicon.ico", 200],
];
let failures = 0;
for (const [method, path, expected] of cases) {
  const response = await fetch(`${base}${path}`, { method, redirect: "manual" });
  const body = await response.text();
  try {
    assert.equal(response.status, expected);
    assert.ok(!body.includes("Incorrect locale information provided"));
    if (path === "/xmlrpc.php" || path === "/wp-login.php") {
      assert.ok(body.includes('data-cartoonova-404'), "Expected the branded Cartoonova 404 page");
    }
    console.log(`PASS ${method} ${path}: ${response.status}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${method} ${path}: ${response.status}, expected ${expected}: ${error.message}`);
  }
}
assert.equal(failures, 0, `${failures} route checks failed`);
