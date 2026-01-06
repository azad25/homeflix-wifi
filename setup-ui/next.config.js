/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sqlite3']
  },
  env: {
    SETUP_MODE: process.env.SETUP_MODE || 'true'
  }
}

module.exports = nextConfig