import { createHash } from "crypto";

type EventSchema = Record<string, unknown>;

type SchemaEntry = {
  type: string;
  version: number;
  schema: EventSchema;
  schemaVersion: string;
  schemaHash: string;
};

const registry = new Map<string, Map<number, SchemaEntry>>();

function key(type: string): string {
  return type.toLowerCase();
}

export function hashSchema(schema: EventSchema): string {
  return createHash("sha256").update(JSON.stringify(schema)).digest("hex");
}

export function registerEventSchema(type: string, version: number, schema: EventSchema): SchemaEntry {
  const t = key(type);
  const versioned = registry.get(t) ?? new Map<number, SchemaEntry>();
  const entry: SchemaEntry = {
    type,
    version,
    schema,
    schemaVersion: `v${version}`,
    schemaHash: hashSchema(schema)
  };
  versioned.set(version, entry);
  registry.set(t, versioned);
  return entry;
}

export function getSchemaForEvent(type: string, version: number): SchemaEntry | null {
  return registry.get(key(type))?.get(version) ?? null;
}

export function isCompatible(fromVersion: number, toVersion: number): boolean {
  if (fromVersion === toVersion) {
    return true;
  }
  // default compatibility model: upgrade is safe forward.
  return fromVersion <= toVersion;
}

export function resolveLatestCompatibleSchema(type: string, fromVersion?: number): SchemaEntry | null {
  const byType = registry.get(key(type));
  if (!byType || byType.size === 0) {
    return null;
  }
  const versions = Array.from(byType.keys()).sort((a, b) => a - b);
  const latest = byType.get(versions[versions.length - 1]!) ?? null;
  if (!latest) {
    return null;
  }
  if (typeof fromVersion === "number" && !isCompatible(fromVersion, latest.version)) {
    return null;
  }
  return latest;
}

export function getCompatibilityMatrix(): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [type, versions] of registry.entries()) {
    const v = Array.from(versions.keys()).sort((a, b) => a - b);
    out[type] = {};
    for (const from of v) {
      for (const to of v) {
        out[type][`${from}->${to}`] = isCompatible(from, to);
      }
    }
  }
  return out;
}

// Base v1 event envelope metadata contract (non-breaking metadata extension only).
registerEventSchema("default", 1, {
  metadataFields: ["eventVersion", "schemaVersion", "schemaHash", "region", "ordering"]
});
