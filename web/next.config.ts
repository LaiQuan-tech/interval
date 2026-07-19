import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage 商品圖片
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
