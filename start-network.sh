#!/bin/bash

# HomeFlix Network Startup Script
# This script starts both backend and frontend with network access configuration

set -e

echo "🎬 Starting HomeFlix with Network Access..."

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
fi

echo "📡 Local IP Address: $LOCAL_IP"
echo "🌐 Network Access URLs:"
echo "   Backend API: http://$LOCAL_IP:8251"
echo "   Frontend:    http://$LOCAL_IP:3006"
echo ""

# Set environment variables
export MEDIA_PATH=${MEDIA_PATH:-"/media/azad/Movies"}
export THUMBNAIL_PATH=${THUMBNAIL_PATH:-"./thumbnails"}
export DATABASE_URL=${DATABASE_URL:-"./homeflix.db"}
export PORT=8251

# Create necessary directories
mkdir -p backend/thumbnails
mkdir -p backend/logs

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Shutting down HomeFlix..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg is not installed. Thumbnail generation will not work."
    echo "   Install FFmpeg: sudo apt install ffmpeg (Ubuntu/Debian)"
fi

echo "🔧 Building backend..."
cd backend
go mod tidy
go build -o homeflix-server .
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed"
    exit 1
fi

echo "🚀 Starting backend server..."
./homeflix-server > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check logs/backend.log"
    exit 1
fi

echo "✅ Backend started (PID: $BACKEND_PID)"

cd ../frontend

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Create or update next.config.js for network access
cat > next.config.js << EOF
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
        hostname: '$LOCAL_IP',
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
    domains: ['localhost', '$LOCAL_IP'],
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
      ? 'http://$LOCAL_IP:8251' 
      : 'http://localhost:8251',
  },
};

module.exports = nextConfig;
EOF

echo "🎨 Starting frontend..."
npm run dev -- --hostname 0.0.0.0 --port 3006 > ../backend/logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo "🎉 HomeFlix is now running!"
echo ""
echo "📱 Access from any device on your network:"
echo "   🖥️  Desktop/Laptop: http://$LOCAL_IP:3006"
echo "   📱 Phone/Tablet:    http://$LOCAL_IP:3006"
echo "   🌐 Any Browser:     http://$LOCAL_IP:3006"
echo ""
echo "🔧 Backend API:        http://$LOCAL_IP:8251"
echo "📊 Logs:"
echo "   Backend:  tail -f backend/logs/backend.log"
echo "   Frontend: tail -f backend/logs/frontend.log"
echo ""
echo "⚠️  Make sure your firewall allows connections on ports 3006 and 8251"
echo "💡 To stop: Press Ctrl+C"
echo ""

# Keep script running and show status
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died"
        break
    fi
    sleep 10
done

cleanup
