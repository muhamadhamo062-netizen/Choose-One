/* eslint-disable no-console */
/**
 * Renders PrivacyEraser brand mark into PWA / Apple touch PNGs.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");

const BG = { r: 11, g: 15, b: 26 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t))
  };
}

function setPx(png, size, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const alpha = a / 255;
  png.data[i] = Math.round(lerp(png.data[i], rgb.r, alpha));
  png.data[i + 1] = Math.round(lerp(png.data[i + 1], rgb.g, alpha));
  png.data[i + 2] = Math.round(lerp(png.data[i + 2], rgb.b, alpha));
  png.data[i + 3] = 255;
}

function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function inRoundedRect(x, y, size, radius) {
  const m = radius;
  const max = size - 1 - m;
  if (x >= m && x <= max && y >= m && y <= max) return true;
  if (x < m && y < m) return dist(x, y, m, m) <= m;
  if (x > max && y < m) return dist(x, y, max, m) <= m;
  if (x < m && y > max) return dist(x, y, m, max) <= m;
  if (x > max && y > max) return dist(x, y, max, max) <= m;
  return x >= m && x <= max && (y < m || y > max);
}

function inShield(nx, ny) {
  if (ny < 0.12 || ny > 0.92) return false;
  const topHalf = 1 - Math.abs(nx - 0.5) / 0.34;
  const bottom = 1 - (ny - 0.55) / 0.37;
  const width = 0.18 + 0.52 * Math.min(1, topHalf) * Math.max(0.2, bottom);
  return Math.abs(nx - 0.5) <= width;
}

function inInnerShield(nx, ny) {
  if (ny < 0.22 || ny > 0.82) return false;
  const topHalf = 1 - Math.abs(nx - 0.5) / 0.28;
  const bottom = 1 - (ny - 0.5) / 0.32;
  const width = 0.12 + 0.4 * Math.min(1, topHalf) * Math.max(0.25, bottom);
  return Math.abs(nx - 0.5) <= width;
}

function sweepIntensity(nx, ny) {
  const lineY = 0.72 - (nx - 0.28) * 0.55;
  const d = Math.abs(ny - lineY);
  if (d > 0.08) return 0;
  return (1 - d / 0.08) * (nx > 0.25 && nx < 0.82 ? 1 : 0);
}

function makeBrandIcon(PNG, size) {
  const png = new PNG({ width: size, height: size });
  const radius = Math.round(size * 0.27);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRoundedRect(x, y, size, radius)) {
        png.data[i + 3] = 0;
        continue;
      }
      png.data[i] = BG.r;
      png.data[i + 1] = BG.g;
      png.data[i + 2] = BG.b;
      png.data[i + 3] = 255;

      const nx = x / size;
      const ny = y / size;

      if (inShield(nx, ny) && !inInnerShield(nx, ny)) {
        const t = ny * 0.7 + nx * 0.3;
        const c = mixColor({ r: 165, g: 180, b: 252 }, { r: 79, g: 70, b: 229 }, t);
        setPx(png, size, x, y, c, 255);
      }

      const sweep = sweepIntensity(nx, ny);
      if (sweep > 0) {
        setPx(png, size, x, y, { r: 52, g: 211, b: 153 }, Math.round(180 * sweep));
      }

      const cx = 0.5;
      const cy = 0.55;
      const r = dist(nx, ny, cx, cy);
      if (r < 0.11) {
        setPx(png, size, x, y, { r: 34, g: 197, b: 94 }, r < 0.055 ? 255 : Math.round(80 * (1 - r / 0.11)));
      }
    }
  }

  return PNG.sync.write(png);
}

try {
  const { PNG } = require("pngjs");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "icon-192.png"), makeBrandIcon(PNG, 192));
  fs.writeFileSync(path.join(outDir, "icon-512.png"), makeBrandIcon(PNG, 512));
  fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), makeBrandIcon(PNG, 180));
  console.log("[pwa-generate-icons] Wrote branded icons to public/icons/");
} catch (e) {
  if (e && (e.code === "MODULE_NOT_FOUND" || /pngjs/.test(String(e.message)))) {
    console.error("[pwa-generate-icons] Run `npm install` (needs pngjs).");
    process.exit(1);
  }
  throw e;
}
