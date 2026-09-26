import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Never ship a type error to SIH judges — `npm run typecheck` is part of `verify`.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
