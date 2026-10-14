import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["echarts", "echarts-for-react"],
};

export default nextConfig;
