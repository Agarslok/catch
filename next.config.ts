import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

function readDevSessionId(): string {
  if (process.env.NODE_ENV !== "development") return "";
  try {
    return fs
      .readFileSync(path.join(process.cwd(), ".catch-dev-session"), "utf8")
      .trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["echarts", "echarts-for-react"],
  env: {
    NEXT_PUBLIC_CATCH_DEV_SESSION: readDevSessionId(),
  },
};

export default nextConfig;
