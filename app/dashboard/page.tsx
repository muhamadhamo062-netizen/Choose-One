import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DashboardProtectionAlert } from "@/components/dashboard/DashboardProtectionAlert";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isActiveLifetimeSubscription } from "@/lib/lifetime-scan-quota";

const DashboardClient = dynamic(
  () => import("@/components/dashboard/DashboardClient").then((m) => ({ default: m.DashboardClient })),
  {
    ssr: true,
    loading: () => (
      <div
        className="flex min-h-[40vh] flex-1 items-center justify-center p-8 text-slate-400"
        role="status"
        aria-live="polite"
      >
        Loading your dashboard…
      </div>
    )
  }
);

export const metadata: Metadata = {
  title: "Your Exposure Control Center | PrivacyEraser.ai",
  description: "Monitor broker exposure, removal progress, and activate lifetime data protection."
};

export default async function DashboardPage() {
  let protectionActive = false;

  const session = await getSession();
  if (session.kind === "authed") {
    const loaded = await getUserFromSession(session.userId);
    if (loaded.user) {
      const sub = await prisma.subscription.findFirst({
        where: { userId: loaded.user.id },
        orderBy: { startedAt: "desc" },
        select: { plan: true, status: true, startedAt: true }
      });
      protectionActive = isActiveLifetimeSubscription(sub);
    }
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col bg-slate-950/40">
      <div className="border-b border-slate-800/80 bg-slate-950/60 px-4 pt-4 sm:px-6 lg:px-8">
        <DashboardProtectionAlert active={protectionActive} />
      </div>
      <DashboardClient />
    </main>
  );
}
