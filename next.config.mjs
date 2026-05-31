import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    // Prisma: resolve from node_modules, do not pre-bundle the engine in RSC / API routes.
    serverComponentsExternalPackages: ["@prisma/client", "prisma"]
  }
};

// PWA: production only. Do NOT set navigateFallback to /offline — on Vercel + App Router, slow or
// failed RSC navigations were served as "You are offline" while the user was actually online.
const withPWAWrapped = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  cacheOnFrontendNav: false,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly"
      },
      {
        urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "pe-static-images",
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }
        }
      }
    ]
  }
});

export default withPWAWrapped(nextConfig);
