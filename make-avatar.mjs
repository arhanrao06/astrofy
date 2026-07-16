#!/usr/bin/env node
// make-avatar.mjs — turn any photo into the site's circular avatar.
// Usage:  node make-avatar.mjs <path-to-your-photo>
// Crops to a face-centered square, resizes, and writes public/profile.webp

import sharp from "sharp";
import path from "node:path";
import { existsSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node make-avatar.mjs <path-to-your-photo>");
  console.error("Example: node make-avatar.mjs myphoto.jpg");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`Can't find file: ${input}`);
  process.exit(1);
}

const out = path.join("public", "profile.webp");

await sharp(input)
  // "attention" smart-crops toward the most detailed region — usually the face.
  .resize(400, 400, { fit: "cover", position: sharp.strategy.attention })
  .webp({ quality: 90 })
  .toFile(out);

console.log(`✓ Wrote ${out} (400x400 webp). Refresh your site to see it.`);
