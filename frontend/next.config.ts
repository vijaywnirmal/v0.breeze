import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy API calls during development to the FastAPI backend
    // so the frontend can call `${API_URL}/api/...` against port 3000
    // and Next.js will forward to the backend on 8000.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
