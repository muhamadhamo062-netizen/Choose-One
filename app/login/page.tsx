import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | PrivacyEraser.ai",
  description: "Sign in to your exposure control center and removal dashboard."
};

export default function LoginPage() {
  return (
    <main className="min-h-0 w-full flex-1 px-4 pb-16 pt-6 sm:pt-10">
      <div className="section-container max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">Sign in with the email and password for your account.</p>
        </div>
        <div className="mt-6 sm:mt-8">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-800/50" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
