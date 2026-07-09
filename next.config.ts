import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.cloudworkstations.dev', '*.google.com'],
    },
  },
};

export default nextConfig;
