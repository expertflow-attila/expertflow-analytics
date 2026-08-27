import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel owns the server output adapter. Standalone output remains enabled
  // for Docker/self-hosting, where the minimal server bundle is required.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" }
      ]
    }];
  }
};

export default nextConfig;
