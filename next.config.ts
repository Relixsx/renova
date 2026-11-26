import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "better-auth"],
  async redirects() {
    return [{ source: "/anagen/3", destination: "/anagen3", permanent: true }];
  },
  async headers() {
    return [{
      source: "/anagen3/previews/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
};

export default nextConfig;
