import { issueSessionFromBillingOrder } from "@/lib/billing/issue-session-from-order";

export const dynamic = "force-dynamic";

type Body = { orderId?: string; transactionId?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const orderId = (typeof body.orderId === "string" ? body.orderId : body.transactionId)?.trim() ?? "";
  return issueSessionFromBillingOrder(orderId);
}
