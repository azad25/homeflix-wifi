/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Allow cross-origin requests from network devices
  allowedDevOrigins: [
    'http://192.168.0.109:3000',
    'https://192.168.0.109:3000',
    '192.168.0.109:3000',
    '192.168.0.109',
    '192.168.0.0/16',
    '10.0.0.0/8',
    '172.16.0.0/12',
    'localhost',
    '127.0.0.1',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8251',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8251',
        pathname: '/api/posters/**',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '8251',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '8251',
        pathname: '/api/posters/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.0.109',
        port: '8251',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.0.109',
        port: '8251',
        pathname: '/api/posters/**',
      },
      {
        protocol: 'http',
        hostname: '*',
        port: '8251',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: '*',
        port: '8251',
        pathname: '/api/posters/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8251/api/:path*',
      },
    ];
  },
  // Additional headers for CORS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
