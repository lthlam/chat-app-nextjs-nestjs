import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins:['192.168.1.4', 'localhost'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
