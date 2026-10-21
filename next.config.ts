import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan akses dev server dari IP LAN Lokal & Tailscale
  allowedDevOrigins: [
    "192.168.20.231",
    "192.168.20.231:3000",
    "100.121.134.74",
    "100.121.134.74:3000",
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
  ],
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
