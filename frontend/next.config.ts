import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-expect-error - turbopack might not be typed in this version of NextConfig
    turbopack: {
      root: "../../",
    },
  },
};

export default nextConfig;
