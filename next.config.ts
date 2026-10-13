import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output is what the Dockerfile copies for self-hosting. It is
   * deliberately NOT set on Vercel, which builds its own output format and
   * does not want a standalone server bundle.
   */
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  async headers() {
    return [
      {
        // The tracking SDK is loaded cross-origin by customer sites.
        source: "/sdk.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
