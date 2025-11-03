/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8252',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: '172.20.0.1',
        port: '8252',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '8252',
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
    domains: ['localhost', '172.20.0.1', 'image.tmdb.org'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8252/api/:path*',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? 'http://172.20.0.1:8252' 
      : 'http://localhost:8252',
  },
};

module.exports = nextConfig;
