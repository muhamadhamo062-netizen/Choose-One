/* eslint-disable no-console */
/**
 * Generates solid-theme PWA icons (192, 512, 180 for Apple touch).
 * Run from predev/prebuild so /public/icons exists before `next start` or dev.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");

function makeIcon(PNG, size, rgb) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      png.data[i] = rgb.r;
      png.data[i + 1] = rgb.g;
      png.data[i + 2] = rgb.b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

try {
  const { PNG } = require("pngjs");
  fs.mkdirSync(outDir, { recursive: true });
  const theme = { r: 11, g: 15, b: 26 }; // #0B0F1A
  fs.writeFileSync(path.join(outDir, "icon-192.png"), makeIcon(PNG, 192, theme));
  fs.writeFileSync(path.join(outDir, "icon-512.png"), makeIcon(PNG, 512, theme));
  fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), makeIcon(PNG, 180, theme));
} catch (e) {
  if (e && (e.code === "MODULE_NOT_FOUND" || /pngjs/.test(String(e.message)))) {
    console.error(
      "[pwa-generate-icons] Run `npm install` (needs dev dependency pngjs) to build PWA icons."
    );
    process.exit(1);
  }
  throw e;
}
