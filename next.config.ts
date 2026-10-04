import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NOTE: `output: "standalone"` is intentionally NOT enabled. The Prisma 7
  // `prisma-client` generator emits plain TypeScript into src/generated/prisma,
  // which standalone tracing can fail to pick up. The Dockerfile ships the
  // full node_modules instead, which is reliable.
};

export default nextConfig;