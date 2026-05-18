const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
