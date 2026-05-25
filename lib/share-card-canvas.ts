/**
 * Renders a branded PNG (no new dependencies) for social sharing after scan.
 */
export function downloadExposureShareCardPng(opts: {
  title?: string;
  score: number;
  brokers: number;
  risk: string;
  filename?: string;
}): void {
  if (typeof document === "undefined") {
    return;
  }
  const title = opts.title ?? "My Personal Data Exposure Report";
  const w = 1080;
  const h = 1200;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.scale(scale, scale);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(0.5, "#1e1b4b");
  g.addColorStop(1, "#0f172a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = "rgba(248, 113, 113, 0.9)";
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PrivacyEraser.ai", w / 2, 100);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 36px system-ui, sans-serif";
  const maxW = w - 120;
  let t = title;
  while (ctx.measureText(t).width > maxW && t.length > 8) {
    t = `${t.slice(0, -4)}…`;
  }
  ctx.fillText(t, w / 2, 210);

  ctx.fillStyle = "#fee2e2";
  ctx.font = "900 120px system-ui, sans-serif";
  ctx.fillText(`${opts.score}`, w / 2, 450);
  ctx.font = "700 48px system-ui, sans-serif";
  ctx.fillText("% exposure score", w / 2, 520);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 36px system-ui, sans-serif";
  ctx.fillText(`Brokers & listings found: ${opts.brokers}+`, w / 2, 650);

  ctx.fillStyle = "#fca5a5";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Risk: ${opts.risk}`, w / 2, 770);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("U.S. data broker & people-search exposure (simulated scan)", w / 2, h - 120);
  ctx.fillText("Run your free scan at privacyeraser.ai", w / 2, h - 80);

  const name = opts.filename ?? "privacyeraser-exposure-report.png";
  canvas.toBlob((blob) => {
    if (!blob) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
