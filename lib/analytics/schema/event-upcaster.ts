import { hashSchema, resolveLatestCompatibleSchema } from "@/lib/analytics/schema/event-schema-registry";

type EventLike = {
  type: string;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
};

const stats = {
  upcasted: 0,
  unresolvedLegacy: 0
};

export function getUpcastStats() {
  return { ...stats };
}

export function upcastEvent<T extends EventLike>(event: T, targetVersion?: number): T & {
  metadata: Record<string, unknown>;
} {
  const metadata = { ...(event.metadata ?? {}) };
  const fromVersion = Number(metadata.eventVersion ?? 1);
  const latest = resolveLatestCompatibleSchema(event.type, fromVersion) ?? resolveLatestCompatibleSchema("default", fromVersion);
  const desiredVersion = targetVersion ?? latest?.version ?? fromVersion;
  if (!latest) {
    stats.unresolvedLegacy += 1;
    return {
      ...event,
      metadata: {
        ...metadata,
        legacy_unresolved: true
      }
    };
  }
  if (fromVersion >= desiredVersion) {
    return {
      ...event,
      metadata: {
        ...metadata,
        eventVersion: fromVersion,
        schemaVersion: metadata.schemaVersion ?? latest.schemaVersion,
        schemaHash: typeof metadata.schemaHash === "string" ? metadata.schemaHash : hashSchema(latest.schema)
      }
    };
  }
  stats.upcasted += 1;
  return {
    ...event,
    metadata: {
      ...metadata,
      eventVersion: desiredVersion,
      schemaVersion: latest.schemaVersion,
      schemaHash: hashSchema(latest.schema),
      upcastedFromVersion: fromVersion
    }
  };
}
