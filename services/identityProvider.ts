export type IdentityBrokerStatus = {
  name: string;
  status: "EXPOSED" | "NO_SIGNAL";
};

export type IdentityAddressSignal = {
  city: string;
  state: string;
  streetMasked: string;
};

export type IdentityIntel = {
  addresses: IdentityAddressSignal[];
  phones: string[];
  photoUrl: string | null;
  brokers: IdentityBrokerStatus[];
  sources: string[];
};

const BROKER_NAMES = ["Spokeo", "Whitepages", "MyLife"] as const;

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) {
    return "+1 (***) ***-****";
  }
  const tail = digits.slice(-4);
  return `+1 (***) ***-${tail}`;
}

function maskStreet(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "****";
  }
  const parts = trimmed.split(/\s+/);
  const number = parts[0] ?? "";
  const rest = parts.slice(1).join(" ").trim();
  if (/^\d+$/.test(number)) {
    const visible = number.slice(0, 2);
    return `${visible}** ${rest || "Street"}`.trim();
  }
  const last = parts[parts.length - 1] ?? "Street";
  return `** ${last}`.trim();
}

function normalizeState(stateCode: string): string {
  return stateCode.trim().toUpperCase();
}

function collectPhones(text: string): string[] {
  const matches = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? [];
  return [...new Set(matches.map(maskPhone))];
}

function parseAddressFromSnippet(snippet: string, stateCode: string): IdentityAddressSignal[] {
  const state = normalizeState(stateCode);
  if (!state) {
    return [];
  }
  const rx = new RegExp(`([0-9]{1,6}\\s+[A-Za-z0-9.'\\-\\s]+),\\s*([A-Za-z.\\-\\s]+),\\s*${state}\\b`, "gi");
  const results: IdentityAddressSignal[] = [];
  let match: RegExpExecArray | null = rx.exec(snippet);
  while (match) {
    const street = typeof match[1] === "string" ? match[1].trim() : "";
    const city = typeof match[2] === "string" ? match[2].trim() : "";
    if (street && city) {
      results.push({
        city,
        state,
        streetMasked: maskStreet(street)
      });
    }
    match = rx.exec(snippet);
  }
  return results;
}

async function fetchSearchApiIdentity(email: string, stateCode: string, fullName?: string): Promise<IdentityIntel | null> {
  const apiKey = process.env.SEARCHAPI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  const identityPart = fullName?.trim() ? `"${fullName.trim()}" ${email}` : email;
  const query = `${identityPart} ${stateCode} "Whitepages" OR "Spokeo" OR "MyLife" OR "people search"`;
  const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`searchapi_failed_${res.status}`);
  }
  const body = (await res.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string; thumbnail?: string }>;
    images_results?: Array<{ original?: string; image?: string; source?: string }>;
  };

  const organic = Array.isArray(body.organic_results) ? body.organic_results : [];
  const textBlob = organic
    .map((row) => `${row.title ?? ""} ${row.snippet ?? ""} ${row.link ?? ""}`)
    .join(" \n ");

  const phones = collectPhones(textBlob);
  const addresses = organic.flatMap((row) => parseAddressFromSnippet(`${row.snippet ?? ""}`, stateCode));
  const uniqueAddresses = addresses.filter(
    (addr, idx, all) =>
      all.findIndex((x) => x.city === addr.city && x.state === addr.state && x.streetMasked === addr.streetMasked) === idx
  );

  const brokers: IdentityBrokerStatus[] = BROKER_NAMES.map((name) => {
    const low = name.toLowerCase();
    const exposed = textBlob.toLowerCase().includes(low);
    return { name, status: exposed ? "EXPOSED" : "NO_SIGNAL" };
  });

  const imageCandidate =
    body.images_results?.find((img) => typeof img.original === "string" || typeof img.image === "string") ?? null;
  const photoUrl =
    (typeof imageCandidate?.original === "string" && imageCandidate.original) ||
    (typeof imageCandidate?.image === "string" && imageCandidate.image) ||
    null;

  const sources = organic
    .map((row) => row.link)
    .filter((x): x is string => typeof x === "string")
    .slice(0, 5);

  return {
    addresses: uniqueAddresses.slice(0, 3),
    phones: phones.slice(0, 3),
    photoUrl,
    brokers,
    sources
  };
}

export async function fetchIdentityIntel(email: string, stateCode: string): Promise<IdentityIntel | null> {
  return fetchIdentityIntelWithName({ email, stateCode });
}

export async function fetchIdentityIntelWithName(input: {
  email: string;
  stateCode: string;
  fullName?: string;
}): Promise<IdentityIntel | null> {
  const { email, stateCode, fullName } = input;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedState = normalizeState(stateCode);
  if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedState) {
    return null;
  }

  try {
    const fromSearchApi = await fetchSearchApiIdentity(normalizedEmail, normalizedState, fullName);
    if (fromSearchApi) {
      return fromSearchApi;
    }
  } catch {
    // Best-effort enrichment: deep-scan route continues even if identity provider fails.
  }

  return null;
}
