import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/signup/SignupForm";

export const metadata: Metadata = {
  title: "Create free account | PrivacyEraser.ai",
  description: "Unlock your full exposure report and dashboard to track broker removals."
};

export default function SignupPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 px-4 pb-16 pt-6 sm:pt-10">
        <div className="section-container max-w-md">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Create your account</h1>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Free scan only: save a password here. If you already paid, you usually do not need this — checkout logs you in.{" "}
              <a href="/login" className="font-medium text-primary underline underline-offset-2">
                Sign in
              </a>{" "}
              or{" "}
              <a href="/signup?setPassword=1" className="font-medium text-primary underline underline-offset-2">
                set a new password
              </a>
              .
            </p>
          </div>
          <div className="mt-6 sm:mt-8">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-800/50" />}>
              <SignupForm />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
