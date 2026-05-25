import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PwaClient } from "@/components/pwa/PwaClient";
import { UnlockModalProvider } from "@/components/paywall/UnlockModalProvider";
import { StateBootstrap } from "@/components/state/StateBootstrap";
import { Footer } from "@/components/sections/Footer";
import { getSession } from "@/lib/auth-session";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://privacyeraser.ai"),
  title: COPY.meta.title,
  description: COPY.meta.description,
  manifest: "/manifest.json",
  applicationName: "PrivacyEraser.ai",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PrivacyEraser"
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0B0F1A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const initialAuthed = session.kind === "authed";

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col">
        <UnlockModalProvider>
          <StateBootstrap />
          <PwaClient />
          <AppHeader initialAuthed={initialAuthed} />
          {children}
          <Footer />
        </UnlockModalProvider>
      </body>
    </html>
  );
}
