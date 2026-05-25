import { fetchWithOneRetry } from "@/lib/fetch-with-retry";
import { maskAddressLine, maskDarkWebPreview, maskPhoneForDisplay } from "@/lib/deep-scan-masking";

export type IntelxDarkWebHit = {
  title: string;
  bucket: string;
  date: string | null;
  preview: string;
};

export type IntelxIdentitySignals = {
  phones: string[];
  addresses: Array<{ city: string; state: string; streetMasked: string }>;
  darkWebHits: IntelxDarkWebHit[];
  sources: string[];
};

type IntelxRecord = {
  systemid?: string;
  storageid?: string;
  bucket?: string;
  name?: string;
  date?: string;
  mediah?: string;
};

function intelxApiKey(): string | null {
  const v = process.env.INTELX_API_KEY?.trim();
  return v || null;
}

function intelxBaseUrl(): string {
  return (process.env.INTELX_BASE_URL ?? "https://2.intelx.io").replace(/\/$/, "");
}

export function intelxCredentialsConfigured(): boolean {
  return Boolean(intelxApiKey());
}

function intelxHeaders(): Record<string, string> {
  const key = intelxApiKey();
  if (!key) {
    throw new Error("intelx_missing_credentials");
  }
  return { "x-key": key, Accept: "application/json", "Content-Type": "application/json" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectPhones(text: string): string[] {
  const matches = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? [];
  return [...new Set(matches.map((m) => m.trim()).filter(Boolean))];
}

function pushAddress(
  out: Array<{ city: string; state: string; street: string }>,
  street: string,
  city: string,
  state: string
): void {
  if (!street || !city || !state) {
    return;
  }
  if (out.some((a) => a.street === street && a.city === city && a.state === state)) {
    return;
  }
  out.push({ street, city, state });
}

function parseAddresses(text: string, stateHint: string): Array<{ city: string; state: string; street: string }> {
  const out: Array<{ city: string; state: string; street: string }> = [];
  const state = stateHint.trim().toUpperCase();

  if (state) {
    const rx = new RegExp(
      `([0-9]{1,6}\\s+[A-Za-z0-9.'\\-\\s]+),\\s*([A-Za-z.\\-\\s]+),\\s*${state}\\b`,
      "gi"
    );
    let match: RegExpExecArray | null = rx.exec(text);
    while (match) {
      pushAddress(
        out,
        typeof match[1] === "string" ? match[1].trim() : "",
        typeof match[2] === "string" ? match[2].trim() : "",
        state
      );
      match = rx.exec(text);
    }
  }

  const generic = /([0-9]{1,6}\s+[A-Za-z0-9.'\-\s]+),\s*([A-Za-z.\-\s]+),\s*([A-Z]{2})\b/gi;
  let g: RegExpExecArray | null = generic.exec(text);
  while (g) {
    pushAddress(
      out,
      typeof g[1] === "string" ? g[1].trim() : "",
      typeof g[2] === "string" ? g[2].trim() : "",
      typeof g[3] === "string" ? g[3].trim().toUpperCase() : ""
    );
    g = generic.exec(text);
  }

  return out;
}

async function startIntelxSearch(email: string): Promise<string> {
  const base = intelxBaseUrl();
  const res = await fetchWithOneRetry(`${base}/intelligent/search`, {
    method: "POST",
    headers: intelxHeaders(),
    body: JSON.stringify({
      term: email.trim().toLowerCase(),
      buckets: [],
      lookuplevel: 0,
      maxresults: Number(process.env.INTELX_MAX_RESULTS ?? 40),
      timeout: 12,
      datefrom: "",
      dateto: "",
      sort: 2,
      media: 0,
      terminate: []
    }),
    cache: "no-store",
    timeoutMs: 12_000
  });

  if (!res.ok) {
    throw new Error(`intelx_search_failed_${res.status}`);
  }

  const body = (await res.json()) as { id?: string; status?: number };
  if (!body.id || typeof body.id !== "string") {
    throw new Error("intelx_search_invalid_response");
  }
  if (body.status === 1) {
    throw new Error("intelx_invalid_term");
  }
  return body.id;
}

async function pollIntelxResults(searchId: string): Promise<IntelxRecord[]> {
  const base = intelxBaseUrl();
  const limit = Math.min(40, Number(process.env.INTELX_RESULT_LIMIT ?? 20));
  const maxAttempts = Math.min(8, Math.max(3, Number(process.env.INTELX_POLL_ATTEMPTS ?? 5)));
  const pollMs = Math.min(500, Math.max(200, Number(process.env.INTELX_POLL_INTERVAL_MS ?? 280)));
  const records: IntelxRecord[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(pollMs);
    }
    const url = `${base}/intelligent/search/result?id=${encodeURIComponent(searchId)}&limit=${limit}`;
    const res = await fetchWithOneRetry(url, {
      method: "GET",
      headers: intelxHeaders(),
      cache: "no-store",
      timeoutMs: 10_000
    });
    if (!res.ok) {
      throw new Error(`intelx_result_failed_${res.status}`);
    }

    const body = (await res.json()) as { status?: number; records?: IntelxRecord[] };
    const batch = Array.isArray(body.records) ? body.records : [];
    for (const row of batch) {
      const id = row.systemid ?? row.storageid;
      if (id && !seen.has(id)) {
        seen.add(id);
        records.push(row);
      }
    }
    if (body.status === 1) {
      break;
    }
    if (body.status === 2) {
      throw new Error("intelx_search_not_found");
    }
    if (records.length >= 8 && body.status === 0) {
      break;
    }
  }

  return records;
}

async function fetchIntelxPreview(storageId: string, bucket: string): Promise<string> {
  const base = intelxBaseUrl();
  const url = `${base}/file/preview?storageid=${encodeURIComponent(storageId)}&bucket=${encodeURIComponent(bucket)}`;
  const res = await fetchWithOneRetry(url, {
    method: "GET",
    headers: { "x-key": intelxApiKey() ?? "" },
    cache: "no-store",
    timeoutMs: 12_000
  });
  if (!res.ok) {
    return "";
  }
  const text = await res.text();
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function terminateIntelxSearch(searchId: string): Promise<void> {
  const base = intelxBaseUrl();
  try {
    await fetchWithOneRetry(`${base}/intelligent/search/terminate?id=${encodeURIComponent(searchId)}`, {
      method: "GET",
      headers: { "x-key": intelxApiKey() ?? "" },
      cache: "no-store",
      timeoutMs: 8_000
    });
  } catch {
    // best-effort cleanup
  }
}

function recordTitle(record: IntelxRecord): string {
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (name) {
    return name;
  }
  const media = typeof record.mediah === "string" ? record.mediah.trim() : "";
  const bucket = typeof record.bucket === "string" ? record.bucket.trim() : "intelx";
  return media ? `${media} · ${bucket}` : bucket;
}

export async function fetchIntelxIdentitySignals(
  email: string,
  stateCode: string,
  maskForClient: boolean
): Promise<IntelxIdentitySignals> {
  if (!intelxCredentialsConfigured()) {
    throw new Error("intelx_missing_credentials");
  }

  const searchId = await startIntelxSearch(email);
  try {
    const records = await pollIntelxResults(searchId);
    const phonesRaw: string[] = [];
    const addressesRaw: Array<{ city: string; state: string; street: string }> = [];
    const darkWebHits: IntelxDarkWebHit[] = [];
    const sources: string[] = [];

    const previewCandidates = records
      .filter((r) => typeof r.storageid === "string" && r.storageid && typeof r.bucket === "string" && r.bucket)
      .slice(0, 3);

    for (const record of records) {
      const bucket = typeof record.bucket === "string" ? record.bucket : "";
      const title = recordTitle(record);
      const date = typeof record.date === "string" ? record.date : null;
      if (bucket.startsWith("darknet") || bucket.includes("paste")) {
        darkWebHits.push({
          title,
          bucket,
          date,
          preview: maskForClient ? maskDarkWebPreview(title) : title
        });
      }
      if (record.systemid) {
        sources.push(`https://intelx.io/?did=${record.systemid}`);
      }
    }

    const previewTexts = await Promise.all(
      previewCandidates.map(async (record) => {
        const storageId = record.storageid as string;
        const bucket = record.bucket as string;
        const preview = await fetchIntelxPreview(storageId, bucket);
        return { record, bucket, preview };
      })
    );

    for (const { record, bucket, preview } of previewTexts) {
      if (!preview) {
        continue;
      }
      phonesRaw.push(...collectPhones(preview));
      addressesRaw.push(...parseAddresses(preview, stateCode));
      if (bucket.startsWith("darknet") && darkWebHits.length < 8) {
        darkWebHits.push({
          title: recordTitle(record),
          bucket,
          date: typeof record.date === "string" ? record.date : null,
          preview: maskForClient ? maskDarkWebPreview(preview) : preview.slice(0, 280)
        });
      }
    }

    const uniquePhones = [...new Set(phonesRaw)].slice(0, 5);
    const uniqueAddresses = addressesRaw
      .filter(
        (addr, idx, all) =>
          all.findIndex((x) => x.street === addr.street && x.city === addr.city && x.state === addr.state) === idx
      )
      .slice(0, 4);

    return {
      phones: maskForClient ? uniquePhones.map(maskPhoneForDisplay) : uniquePhones,
      addresses: uniqueAddresses.map((a) => ({
        city: a.city,
        state: a.state,
        streetMasked: maskForClient ? maskAddressLine(a.street, a.city, a.state) : `${a.street}, ${a.city}, ${a.state}`
      })),
      darkWebHits: darkWebHits.slice(0, 8),
      sources: [...new Set(sources)].slice(0, 6)
    };
  } finally {
    await terminateIntelxSearch(searchId);
  }
}
