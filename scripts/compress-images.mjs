// One-shot script to compress JPEG/PNG source files in public/.
// Usage:
//   npm install --save-dev sharp
//   node scripts/compress-images.mjs
//
// Re-encodes JPEGs at quality 82 and PNGs at compression 9, in place.
// Resizes any image wider than 2400px down to 2400px (preserving ratio).

import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";

const MAX_WIDTH = 2400;
const JPEG_QUALITY = 82;

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("⚠ sharp is not installed. Run: npm install --save-dev sharp");
  process.exit(1);
}

function walk(dir, results = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

const files = walk("public").filter((f) => /\.(jpe?g|png)$/i.test(f));
let before = 0, after = 0;

for (const file of files) {
  const original = readFileSync(file);
  before += original.length;

  const ext = extname(file).toLowerCase();
  const meta = await sharp(original).metadata();
  let pipeline = sharp(original);
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const out = await (ext === ".png"
    ? pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
    : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer());

  if (out.length < original.length) {
    writeFileSync(file, out);
    console.log(`✓ ${file}  ${(original.length / 1024).toFixed(0)}kB → ${(out.length / 1024).toFixed(0)}kB`);
    after += out.length;
  } else {
    after += original.length;
  }
}

const saved = ((before - after) / before * 100).toFixed(1);
console.log(`\nTotal: ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB  (-${saved}%)`);
