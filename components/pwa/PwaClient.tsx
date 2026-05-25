"use client";

import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Client-only: install prompts, iOS A2HS hint, no business logic. */
export function PwaClient() {
  return <InstallPrompt />;
}
