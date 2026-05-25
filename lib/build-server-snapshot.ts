import { createHash } from "node:crypto";
import { clientBodyToInput } from "@/lib/client-body-flags";
import { mergeStateInputs, stateFromFlags } from "@/lib/state-resolver";
import type { ClientSyncBody, ServerStateSnapshot } from "@/lib/server-state-types";

export function buildSnapshotFromSync(
  existing: ServerStateSnapshot | null,
  body: ClientSyncBody
): ServerStateSnapshot {
  const client = clientBodyToInput(body);
  const merged = mergeStateInputs(existing, client);
  const state = stateFromFlags(merged);
  const email = body.user?.email?.toLowerCase() ?? existing?.email ?? null;
  const userId = email
    ? `u_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`
    : (existing?.userId ?? null);

  return {
    v: 1,
    userId,
    email,
    state,
    plan: merged.plan,
    paywallInteracted: merged.paywallInteracted,
    checkoutStarted: merged.checkoutStarted,
    signupPending: merged.signupPending,
    protected: merged.protected,
    hasScan: merged.hasScan,
    lastUpdated: new Date().toISOString()
  };
}
