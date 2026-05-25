import { emitServerEvent } from "@/lib/events/event-emitter";

export type VerificationDecision = "verified_deleted" | "partial_deleted" | "not_confirmed";

export type VerificationAuditEntry = {
  requestId: string;
  sourcesChecked: number;
  finalScore: number;
  decision: VerificationDecision;
  sourceResults: Array<{
    source: string;
    found: boolean | "unknown";
    confidence: number;
  }>;
  durationMs: number;
};

export async function writeVerificationAuditLog(entry: VerificationAuditEntry): Promise<void> {
  void emitServerEvent({
    event: "deletion_verification_attempt",
    userId: null,
    payload: {
      requestId: entry.requestId,
      sourcesChecked: entry.sourcesChecked,
      finalScore: entry.finalScore,
      decision: entry.decision,
      sourceResults: entry.sourceResults,
      durationMs: entry.durationMs,
      timestamp: new Date().toISOString()
    }
  });
}
