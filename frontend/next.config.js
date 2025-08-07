const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    return config;
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:5173", "frontend:5173"],
      trustedOrigins: ["localhost", "frontend"],
      trustHostHeader: true
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE" },
          { key: "Access-Control-Allow-Headers", value: "X-Requested-With, Content-Type" }
        ]
      }
    ]
  },
  output: "standalone",
}

module.exports = nextConfig;
