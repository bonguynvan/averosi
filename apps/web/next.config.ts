import path from "node:path";
import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker builds set NEXT_OUTPUT=standalone: only traced files ship (docker/app.Dockerfile).
  // Local `next start` and e2e keep the default output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const, outputFileTracingRoot: path.resolve(import.meta.dirname, "../..") } : {}),
  poweredByHeader: false,
  transpilePackages: ["@app/core", "@app/market-data", "@app/store"],
  // Node-only drivers stay external to the server bundle.
  serverExternalPackages: ["postgres", "ioredis"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
