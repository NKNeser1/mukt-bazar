import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["firebase-admin", "jwks-rsa", "jose"],
  /* config options here */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
