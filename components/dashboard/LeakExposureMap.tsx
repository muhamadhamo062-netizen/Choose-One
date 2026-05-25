"use client";

import { useEffect, useState } from "react";

type LeakExposureMapProps = {
  latitude: number;
  longitude: number;
  leaksWithIp: number;
  city: string | null;
  country: string | null;
};

export function LeakExposureMap({ latitude, longitude, leaksWithIp, city, country }: LeakExposureMapProps) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const [glitch, setGlitch] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setGlitch(false), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`rounded-2xl border border-danger/50 bg-slate-950/70 p-3 ${glitch ? "leak-glitch" : ""}`}>
      <div className="mb-2 text-xs uppercase tracking-wide text-red-300">Geo Exposure</div>
      <div className="relative h-56 overflow-hidden rounded-xl border border-slate-800 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,0.85),rgba(2,6,23,0.95))]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
        <span className="leak-dot-pulse absolute left-1/2 top-1/2" />
        <span className="leak-dot-core absolute left-1/2 top-1/2" />
        <div className="absolute bottom-2 right-2 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] text-slate-300">
          {latitude.toFixed(3)}, {longitude.toFixed(3)}
        </div>
      </div>
      <p className="mt-3 text-sm text-red-200">
        Your precise location was exposed in <span className="font-bold">{leaksWithIp}</span> leaks. This is how easy it is to find
        you.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {city || "Unknown city"}, {country || "Unknown country"}
      </p>
    </div>
  );
}
