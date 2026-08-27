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
    '192.168.0.109',   // Specific IP address
    '192.168.0.0/16',  // Allow all 192.168.x.x addresses
    '10.0.0.0/8',      // Allow all 10.x.x.x addresses  
    '172.16.0.0/12',   // Allow all 172.16-31.x.x addresses
    'localhost',       // Allow localhost
    '127.0.0.1',       // Allow loopback
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8252',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8252',
        pathname: '/api/posters/**',
      },
      {
        protocol: 'http',
        hostname: '*',
        port: '8252',
        pathname: '/api/thumbnails/**',
      },
      {
        protocol: 'http',
        hostname: '*',
        port: '8252',
        pathname: '/api/posters/**',
      },
      {
        protocol: 'https',
        hostname: 'homeflix.ferdousazad.com',
        pathname: '/api/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:8252/api/:path*`,
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
