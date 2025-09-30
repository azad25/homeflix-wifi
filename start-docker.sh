#!/bin/bash

# HomeFlix Docker Startup Script
echo "🐳 Starting HomeFlix with Docker"
echo "================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker found!"

# Get local IP address for network access
LOCAL_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+' 2>/dev/null || hostname -I | awk '{print $1}')

# Create media directory if it doesn't exist
MEDIA_PATH="/media/azad/Movies"
if [ ! -d "$MEDIA_PATH" ]; then
    echo "📁 Creating media directory: $MEDIA_PATH"
    sudo mkdir -p "$MEDIA_PATH"
    echo "⚠️  Please add your media files to: $MEDIA_PATH"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down

# Build and start services
echo "🔨 Building and starting services..."
docker compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker compose ps | grep -q "Up"; then
    echo ""
    echo "🎉 HomeFlix is now running with Docker!"
    echo "======================================"
    echo "🌐 Frontend (Local): http://localhost:3006"
    echo "🌐 Frontend (Network): http://$LOCAL_IP:3006"
    echo "🔧 Backend API (Local): http://localhost:8251"
    echo "🔧 Backend API (Network): http://$LOCAL_IP:8251"
    echo "📁 Media Path: $MEDIA_PATH"
    echo ""
    echo "📱 Network Access:"
    echo "   - Access from any device on your WiFi network"
    echo "   - Use http://$LOCAL_IP:3006 on other devices"
    echo "   - Docker handles all port forwarding automatically"
    echo ""
    echo "📖 Instructions:"
    echo "1. Add your movies/series to: $MEDIA_PATH"
    echo "2. The backend will automatically scan and organize your media"
    echo "3. Open http://localhost:3006 in your browser"
    echo "4. Enjoy your personal Netflix clone!"
    echo ""
    echo "🔧 Management Commands:"
    echo "   - View logs: docker compose logs -f"
    echo "   - Stop services: docker compose down"
    echo "   - Restart: docker compose restart"
else
    echo "❌ Failed to start services. Check logs with: docker compose logs"
    exit 1
fi
