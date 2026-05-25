import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    "components/dashboard/DashboardClient.tsx",
    "components/sections/TrustBadgesSection.tsx",
    "components/sections/HowItWorksSection.tsx",
    "components/sections/Footer.tsx",
    "components/sections/FaqSection.tsx",
    "components/sections/PricingSection.tsx",
    "components/paywall/UnlockModal.tsx",
    "components/sections/ScannerSection.tsx",
    "components/scanner/ScannerPanel.tsx",
]


def strip_calls(s: str) -> str:
    s = re.sub(
        r"import\s+\{\s*sanitizeProductCopy\s*\}\s+from\s+['\"]@/lib/sanitizeProductCopy['\"];\r?\n",
        "",
        s,
    )
    for _ in range(5000):
        m = re.search(r"sanitizeProductCopy\(", s)
        if not m:
            break
        i = m.start() + len("sanitizeProductCopy(")
        depth = 0
        j = i
        while j < len(s):
            c = s[j]
            if c == "(":
                depth += 1
            elif c == ")":
                if depth > 0:
                    depth -= 1
                else:
                    inner = s[i:j]
                    s = s[: m.start()] + inner + s[j + 1 :]
                    break
            j += 1
        else:
            raise RuntimeError("unbalanced")
    return s


for rel in FILES:
    p = ROOT / rel
    text = p.read_text(encoding="utf-8")
    p.write_text(strip_calls(text), encoding="utf-8")
    print("ok", rel)
