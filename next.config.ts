import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@better-auth/kysely-adapter"],
};

export default nextConfig;
