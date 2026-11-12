import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      { source: "/", destination: "/app.html", permanent: false }
    ];
  },
};

export default nextConfig;
