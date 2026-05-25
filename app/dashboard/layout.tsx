import type { ReactNode } from "react";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { resolveDashboardScansRemaining } from "@/lib/lifetime-scan-quota";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  let scansRemaining: Awaited<ReturnType<typeof resolveDashboardScansRemaining>> = null;

  const session = await getSession();
  if (session.kind === "authed") {
    const loaded = await getUserFromSession(session.userId);
    if (loaded.user) {
      scansRemaining = await resolveDashboardScansRemaining(loaded.user.id);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {scansRemaining ? (
        <div
          className="border-b border-slate-800/90 bg-slate-900/70 px-4 py-2.5 text-center text-sm text-slate-300"
          role="status"
        >
          Manual deep scans this cycle:{" "}
          <strong className="font-semibold text-white">
            {scansRemaining.remaining} of {scansRemaining.limit}
          </strong>{" "}
          remaining
          <span className="ml-2 text-xs text-slate-500">({scansRemaining.used} used)</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
