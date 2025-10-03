/** @type {import('next').NextConfig} */

// Determine the backend URL based on the environment
const isDocker = process.env.DOCKER_ENV === 'true';
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
  (isDocker ? 'http://backend:8251' : 'http://localhost:8251');

console.log(`Using backend URL: ${backendUrl}`);

const nextConfig = {
  output: 'standalone',
  // Move turbopack to the new config format
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Disable the old experimental.turbo
  experimental: {
    serverActions: true,
  },
  // Configure API proxy
  async rewrites() {
    console.log('Next.js rewrites configured with backend URL:', backendUrl);
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Configure CORS headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
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
};

export default nextConfig;
