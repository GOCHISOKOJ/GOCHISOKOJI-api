import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 外部画像の許可
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
