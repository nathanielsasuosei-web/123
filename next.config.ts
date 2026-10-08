import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sandbox/preview hosts (and Vercel previews) talk to the dev server through a
  // proxy, so allow those origins instead of failing the request.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "*.vercel.app", "localhost"],

  // Uploads are streamed through route handlers (or Vercel Blob), so image
  // optimisation is off: no sharp dependency and identical behaviour anywhere.
  images: {
    unoptimized: true,
  },

  // Larger uploads (beats) are streamed, never buffered into memory.
  experimental: {
    proxyTimeout: 120_000,
  },

  // The database drivers and the embedded Postgres (used for local development)
  // must stay outside the server bundle: they load WASM and native-ish assets.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],

  // Keep local data, demo media and build caches out of the serverless bundle.
  outputFileTracingExcludes: {
    "*": ["./.data/**/*", "./demo-assets/**/*", "./.next/cache/**/*"],
  },
};

export default nextConfig;
