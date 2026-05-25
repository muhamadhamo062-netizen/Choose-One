import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prisma: resolve from node_modules, do not pre-bundle the engine in RSC / API routes.
    serverComponentsExternalPackages: ["@prisma/client", "prisma"]
  }
};

// PWA: production only. Default runtime cache in @ducanh2912/next-pwa is NetworkFirst for /api/* (GET, 10s),
// matching the spec for /api/scan, /api/user, /api/state. Static assets, pages, and RSC use cache-friendly strategies.
const withPWAWrapped = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  cacheOnFrontendNav: true,
  cacheStartUrl: true,
  fallbacks: {
    document: "/offline"
  },
  workboxOptions: {
    navigateFallback: "/offline",
    // Never cache API responses: stale 401/NetworkFirst breaks session after login (PWA).
    runtimeCaching: [
      {
        // All /api/* must bypass SW cache (session, auth, scan) — any HTTP method.
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly"
      }
    ]
  }
});

export default withPWAWrapped(nextConfig);
