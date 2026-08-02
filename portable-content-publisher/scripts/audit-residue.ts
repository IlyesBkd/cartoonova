import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", "data", ".state", ".tmp", "logs"]);
const textExtensions = new Set([".ts", ".js", ".cjs", ".json", ".md", ".sh", ".example", ""]);
const encodedPatterns = [
  "amV1Wy4tXT92aWRlbw==",
  "XGJib2x0XGI=",
  "XGJwcm94bW94XGI=",
  "XGJwY3RccytleGVjXGI=",
  "L3Nydi93ZWJzaXRlcy8=",
  "XGJzdGVhbVxi",
  "XGJnYW1pbmdcYg==",
  "Y2FzY2FkZXByb2plY3Rz",
];
const forbidden = encodedPatterns.map((encoded) => new RegExp(Buffer.from(encoded, "base64").toString("utf8"), "i"));

async function files(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) output.push(...await files(full));
    else if (textExtensions.has(extname(entry.name)) || entry.name.startsWith(".env")) output.push(full);
  }
  return output;
}

const violations: string[] = [];
for (const file of await files(root)) {
  const content = await readFile(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) violations.push(`${relative(root, file)}: ${pattern}`);
  }
}
if (violations.length) throw new Error(`Project-specific residue found:\n${violations.join("\n")}`);
process.stdout.write("Residue audit passed\n");
