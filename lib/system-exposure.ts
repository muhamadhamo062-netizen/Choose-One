export type SystemExposureSnapshot = {
  internalIps: string[];
  battery: null | {
    level: number; // 0..1
    charging: boolean;
    chargingTime: number | null;
    dischargingTime: number | null;
  };
  deviceModel: string | null;
  city: string | null;
};

function uniqNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of items) {
    const s = raw.trim();
    if (!s) continue;
    seen.add(s);
  }
  return [...seen];
}

function isPrivateIp(ip: string): boolean {
  // IPv4 RFC1918 + loopback + link-local (common in WebRTC candidates)
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
    /^169\.254\.\d{1,3}\.\d{1,3}$/.test(ip)
  );
}

export async function detectInternalIps(opts?: { timeoutMs?: number }): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const timeoutMs = Math.max(250, opts?.timeoutMs ?? 1200);

  const RTCPeer =
    (window as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }).RTCPeerConnection ??
    (window as unknown as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection ??
    (window as unknown as { mozRTCPeerConnection?: typeof RTCPeerConnection }).mozRTCPeerConnection;

  if (!RTCPeer) return [];

  const ips: string[] = [];
  const ipRe = /(\d{1,3}(?:\.\d{1,3}){3})/g;

  return await new Promise<string[]>((resolve) => {
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      try {
        pc.onicecandidate = null;
        pc.onicegatheringstatechange = null;
        pc.close();
      } catch {
        // ignore
      }
      resolve(uniqNonEmpty(ips).filter(isPrivateIp));
    };

    const pc = new RTCPeer({ iceServers: [] });
    try {
      pc.createDataChannel("x");
    } catch {
      // ignore (some browsers restrict)
    }

    pc.onicecandidate = (evt) => {
      const c = evt.candidate?.candidate;
      if (!c) return;
      const matches = c.match(ipRe) ?? [];
      for (const m of matches) ips.push(m);
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") finalize();
    };

    void pc
      .createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false })
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        // ignore
      });

    window.setTimeout(finalize, timeoutMs);
  });
}

export async function detectBattery(): Promise<SystemExposureSnapshot["battery"]> {
  if (typeof window === "undefined") return null;
  const nav = navigator as unknown as { getBattery?: () => Promise<BatteryManager> };
  if (typeof nav.getBattery !== "function") return null;
  try {
    const b = await nav.getBattery();
    return {
      level: typeof b.level === "number" ? b.level : 0,
      charging: Boolean(b.charging),
      chargingTime: Number.isFinite(b.chargingTime) ? b.chargingTime : null,
      dischargingTime: Number.isFinite(b.dischargingTime) ? b.dischargingTime : null
    };
  } catch {
    return null;
  }
}

export async function detectDeviceModel(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const uaData = (navigator as unknown as { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<any>; model?: string } })
    .userAgentData;

  try {
    if (uaData?.getHighEntropyValues) {
      const hi = await uaData.getHighEntropyValues(["model", "platform", "platformVersion"]);
      const model = typeof hi?.model === "string" ? hi.model.trim() : "";
      const platform = typeof hi?.platform === "string" ? hi.platform.trim() : "";
      const pv = typeof hi?.platformVersion === "string" ? hi.platformVersion.trim() : "";
      const combined = [model, platform && pv ? `${platform} ${pv}` : platform].filter(Boolean).join(" • ").trim();
      return combined || null;
    }
  } catch {
    // ignore
  }

  const ua = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
  if (!ua) return null;
  // Deliberately "good enough" fallback; avoids fragile full UA parsing.
  return ua.slice(0, 140);
}

export async function detectCityViaFreeLookup(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("https://ipwho.is/", { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as any;
    const city = typeof body?.city === "string" ? body.city.trim() : "";
    return city || null;
  } catch {
    return null;
  }
}

export async function collectSystemExposureSnapshot(): Promise<SystemExposureSnapshot> {
  const [internalIps, battery, deviceModel, city] = await Promise.all([
    detectInternalIps().catch(() => []),
    detectBattery().catch(() => null),
    detectDeviceModel().catch(() => null),
    detectCityViaFreeLookup().catch(() => null)
  ]);

  return { internalIps, battery, deviceModel, city };
}

