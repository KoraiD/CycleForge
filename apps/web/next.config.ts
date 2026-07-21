import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@trigger.dev/sdk", "maplibre-gl"],
  serverExternalPackages: ["@clickhouse/client"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Hide the floating Next dev-tools button so screen recordings stay clean.
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
