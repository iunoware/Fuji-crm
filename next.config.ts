import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "famgdksnkabzujdijabk.supabase.co",
      },
    ],
  },
};

export default nextConfig;
