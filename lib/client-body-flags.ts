import type { ClientSyncBody } from "@/lib/server-state-types";
import type { ResolvableStateInput } from "@/lib/state-resolver";

export function clientBodyToInput(body: ClientSyncBody): ResolvableStateInput {
  return {
    plan: body.plan,
    hasScan: Boolean(body.scan),
    hasUser: Boolean(body.user),
    paywallInteracted: body.paywallInteracted,
    checkoutStarted: body.checkoutStarted,
    signupPending: body.signupPending,
    protected: body.protected
  };
}
