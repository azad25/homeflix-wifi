/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8251',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: '172.20.0.1',
        port: '8251',
        pathname: '/api/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '8251',
        pathname: '/api/**',
      },
    ],
    domains: ['localhost', '172.20.0.1'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8251/api/:path*',
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? 'http://172.20.0.1:8251' 
      : 'http://localhost:8251',
  },
};

module.exports = nextConfig;
