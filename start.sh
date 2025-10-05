#!/bin/bash

# HomeFlix Startup Script
echo "🎬 Starting HomeFlix - Netflix Clone"
echo "=================================="

# Check if required dependencies are installed
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking dependencies..."
check_dependency "go"
check_dependency "node"
check_dependency "npm"
check_dependency "ffmpeg"

echo "✅ All dependencies found!"

# Create media directory if it doesn't exist
MEDIA_PATH="/media/azad/Movies"
if [ ! -d "$MEDIA_PATH" ]; then
    echo "📁 Creating media directory: $MEDIA_PATH"
    sudo mkdir -p "$MEDIA_PATH"
    echo "⚠️  Please add your media files to: $MEDIA_PATH"
fi

# Create necessary directories for thumbnails, posters, and previews
echo "📁 Creating necessary directories..."
mkdir -p thumbnails
mkdir -p posters
mkdir -p previews
mkdir -p subtitles
mkdir -p optimized

# Get local IP address for network access
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Start backend
echo "🚀 Starting Go backend..."
cd backend
go mod tidy
go run server.go &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 5

# Start frontend
echo "🎨 Starting Next.js frontend in production mode..."
cd frontend
npm install
npm run build
npm run start &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 HomeFlix is now running!"
echo "=================================="
echo "🌐 Frontend (Local): http://localhost:3008"
echo "🌐 Frontend (Network): http://$LOCAL_IP:3008"
echo "🔧 Backend API (Local): http://localhost:8252"
echo "🔧 Backend API (Network): http://$LOCAL_IP:8252"
echo "📁 Media Path: $MEDIA_PATH"
echo ""
echo "📱 Network Access:"
echo "   - Access from any device on your WiFi network"
echo "   - Use the network URLs above on other devices"
echo "   - Make sure firewall allows ports 3008 and 8252"
echo ""
echo "📖 Instructions:"
echo "1. Add your movies/series to: $MEDIA_PATH"
echo "2. The backend will automatically scan and organize your media"
echo "3. Open http://localhost:3008 in your browser"
echo "4. Enjoy your personal Netflix clone!"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for interrupt
trap "echo ''; echo '🛑 Stopping HomeFlix...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
