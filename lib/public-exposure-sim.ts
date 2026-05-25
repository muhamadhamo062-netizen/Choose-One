export type PublicBrokerName = "Whitepages" | "Spokeo" | "MyLife" | "Radaris" | "Intelius";

export type PublicExposureResult = {
  ok: true;
  query: { fullName: string; stateCode: string };
  brokers: Array<{ name: PublicBrokerName; status: "EXPOSED" | "NO_SIGNAL"; confidence: number }>;
  identity: {
    addresses: Array<{ city: string; state: string; streetMasked: string }>;
    phones: string[];
  };
  confidenceScore: number; // 0..1
};

const BROKERS: PublicBrokerName[] = ["Whitepages", "Spokeo", "MyLife", "Radaris", "Intelius"];

export function typicalBrokersForState(stateCode: string): PublicBrokerName[] {
  // Lightweight “typical exposure” mapping. Purpose is UX fallback when no hard match is found.
  const st = normState(stateCode);
  if (st === "CA" || st === "NY") return ["Whitepages", "Spokeo", "Intelius", "Radaris"];
  if (st === "TX" || st === "FL") return ["Whitepages", "Spokeo", "MyLife"];
  return ["Whitepages", "Spokeo"];
}

function normName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function normState(s: string): string {
  return s.trim().toUpperCase();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function fnv1a32(input: string): number {
  // Deterministic, fast, no Node deps. Not cryptographic.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    // h *= 16777619 (via shifts)
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

function makeSeedBytes(input: string, count = 64): Uint8Array {
  const out = new Uint8Array(count);
  // Expand by hashing input + counter; stable across browser/server.
  for (let i = 0; i < count; i += 1) {
    const h = fnv1a32(`${input}|${i}`);
    out[i] = h & 0xff;
  }
  return out;
}

function pick<T>(arr: T[], n: number, seed: Uint8Array, offset: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = seed[(offset + i) % seed.length]! % arr.length;
    out.push(arr[idx]!);
  }
  return out;
}

function maskStreet(street: string): string {
  const parts = street.trim().split(/\s+/);
  const num = parts[0] ?? "";
  const rest = parts.slice(1).join(" ").trim();
  const visible = /^\d+$/.test(num) ? num.slice(0, 2) : "**";
  return `${visible}** ${rest || "Street"}`.trim();
}

function maskPhone(digits10: string): string {
  const d = digits10.replace(/\D/g, "").slice(-10);
  if (d.length !== 10) return "+1 (***) ***-****";
  return `+1 (***) ***-${d.slice(-4)}`;
}

export function simulatePublicExposure(input: { fullName: string; stateCode: string }): PublicExposureResult {
  const fullName = normName(input.fullName);
  const stateCode = normState(input.stateCode);
  const seed = makeSeedBytes(`${fullName}|${stateCode}|public_records_sim_v1`, 64);

  const citiesByState: Record<string, string[]> = {
    CA: ["Los Angeles", "San Diego", "San Jose", "Sacramento"],
    NY: ["New York", "Buffalo", "Rochester", "Albany"],
    TX: ["Dallas", "Houston", "Austin", "San Antonio"],
    FL: ["Miami", "Orlando", "Tampa", "Jacksonville"],
    IL: ["Chicago", "Aurora", "Naperville", "Rockford"]
  };
  const fallbackCities = ["Springfield", "Riverside", "Fairview", "Franklin"];
  const cities = citiesByState[stateCode] ?? fallbackCities;

  const streets = ["Maple Ave", "Oak St", "Pine Rd", "Cedar Ln", "Washington Blvd", "Lakeview Dr"];
  const city = cities[seed[0]! % cities.length]!;
  const street = `${100 + (seed[1]! % 800)} ${streets[seed[2]! % streets.length]}`;

  // Simulate exposure intensity (deterministic)
  const intensity = seed[3]! / 255; // 0..1
  const exposedCount = intensity > 0.75 ? 4 : intensity > 0.55 ? 3 : intensity > 0.32 ? 2 : 1;
  const exposedBrokers = new Set(pick(BROKERS, exposedCount, seed, 10));

  const brokers = BROKERS.map((name, idx) => {
    const base = (seed[(40 + idx) % seed.length]! / 255) * 0.35 + intensity * 0.65;
    const confidence = clamp01(base);
    return { name, status: exposedBrokers.has(name) ? ("EXPOSED" as const) : ("NO_SIGNAL" as const), confidence };
  });

  const phones = [
    maskPhone(`555${String(1000000 + (seed[5]! * 1000 + seed[6]!) % 9000000).padStart(7, "0")}`),
    maskPhone(`555${String(1000000 + (seed[7]! * 1000 + seed[8]!) % 9000000).padStart(7, "0")}`)
  ].slice(0, exposedCount >= 3 ? 2 : 1);

  const addresses = [
    { city, state: stateCode || "NA", streetMasked: maskStreet(street) },
    ...(exposedCount >= 4
      ? [{ city: cities[seed[9]! % cities.length]!, state: stateCode || "NA", streetMasked: maskStreet(`${200 + (seed[11]! % 700)} ${streets[seed[12]! % streets.length]}`) }]
      : [])
  ];

  const confidenceScore = clamp01(0.35 + intensity * 0.6);

  return {
    ok: true,
    query: { fullName, stateCode },
    brokers,
    identity: { addresses, phones },
    confidenceScore
  };
}

