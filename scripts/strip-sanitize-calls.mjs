import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  "components/sections/HeroSection.tsx",
  "components/sections/ScannerSection.tsx",
  "components/sections/PricingSection.tsx",
  "components/sections/FaqSection.tsx",
  "components/sections/Footer.tsx",
  "components/sections/HowItWorksSection.tsx",
  "components/sections/TrustBadgesSection.tsx",
  "components/paywall/UnlockModal.tsx",
  "components/scanner/ScannerPanel.tsx",
  "components/dashboard/DashboardClient.tsx"
];

function stripFile(rel) {
  const f = path.join(root, rel);
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(
    /import\s+\{\s*sanitizeProductCopy\s*\}\s+from\s+["']@\/lib\/sanitizeProductCopy["'];\r?\n/g,
    ""
  );
  for (;;) {
    const idx = s.indexOf("sanitizeProductCopy(");
    if (idx === -1) break;
    const startArgs = idx + "sanitizeProductCopy(".length;
    let depth = 0;
    let j = startArgs;
    let closed = false;
    for (; j < s.length; j++) {
      const ch = s[j];
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        if (depth > 0) {
          depth--;
        } else {
          const inner = s.slice(startArgs, j);
          s = s.slice(0, idx) + inner + s.slice(j + 1);
          closed = true;
          break;
        }
      }
    }
    if (!closed) {
      throw new Error(`Unbalanced sanitizeProductCopy in ${rel} at ${idx}`);
    }
  }
  fs.writeFileSync(f, s);
  console.log("stripped", rel);
}

for (const f of files) {
  stripFile(f);
}
