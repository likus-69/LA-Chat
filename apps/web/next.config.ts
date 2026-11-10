import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The web container is built standalone in production; for dev it just runs
  // `next dev`. We set output: 'standalone' so the Dockerfile can copy the
  // standalone server.
  output: 'standalone',
  // Proxy /api/v1 to the API service so the browser only sees one origin.
  // In production Caddy does this instead.
  async rewrites() {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
    return [
      { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
    ];
  },
};

export default config;
