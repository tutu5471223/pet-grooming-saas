import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["trycloudflare.com"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
