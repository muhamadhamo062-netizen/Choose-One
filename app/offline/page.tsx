import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline | PrivacyEraser.ai",
  robots: { index: false, follow: false }
};

/**
 * Shown by the service worker when navigation fails while offline (production).
 * Does not change scan/paywall/dashboard logic; shell-only fallback.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-white">You are offline</h1>
      <p className="text-balance text-slate-300">
        Please reconnect to continue scanning your identity exposure.
      </p>
    </main>
  );
}
