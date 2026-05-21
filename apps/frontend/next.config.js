const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    if (useMock) {
      // When mocking is enabled the front-end serves its own /api/* routes,
      // so we skip the proxy to the backend.
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
