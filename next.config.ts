import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return {
      /* الصفحة الرئيسية / تتحول تلقائياً إلى التطبيق /app.html
         (beforeFiles = قبل أي ملفات قديمة بالمستودع — حتى ما تعارض الصفحات القديمة) */
      beforeFiles: [
        { source: "/", destination: "/app.html", permanent: false },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
