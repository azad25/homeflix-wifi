/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features if needed
  },
  // Fix workspace root warning
  outputFileTracingRoot: __dirname,
  
  // Disable linting during build for now
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build for now
  typescript: {
    ignoreBuildErrors: true,
  },
  
  webpack: (config, { isServer }) => {
    // Handle gRPC-Web and protobuf files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Handle .proto files
    config.module.rules.push({
      test: /\.proto$/,
      type: 'asset/source',
    });

    // Fix path resolution for @ alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };

    return config;
  },
  // Proxy API requests to backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8252/api/:path*',
      },
      {
        source: '/grpc/:path*',
        destination: 'http://localhost:8253/:path*',
      },
    ];
  },
  // Handle CORS for gRPC-Web
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, grpc-web' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;