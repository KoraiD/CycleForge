import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@trigger.dev/sdk", "maplibre-gl"],
  serverExternalPackages: ["@clickhouse/client"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
