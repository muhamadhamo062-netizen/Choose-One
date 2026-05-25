import type { Metadata } from "next";
import { ReferralClient } from "@/components/referral/ReferralClient";

export const metadata: Metadata = {
  title: "Refer a friend & earn monitoring credit | PrivacyEraser.ai",
  description:
    "Share your referral code. Friends get a free U.S. data exposure scan; you earn credit toward extra monitoring (placeholder reward)."
};

export default function ReferralPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 px-4 pb-20 pt-8 sm:pt-10">
        <div className="section-container">
          <ReferralClient />
        </div>
      </main>
    </>
  );
}
