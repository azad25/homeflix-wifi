#!/bin/bash

# HomeFlix One-Command Quick Start
# Automatically fixes permissions and starts HomeFlix

# Fix permissions immediately
find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true

# Create directories
mkdir -p config setup-data jackett-config downloads backend/{thumbnails,posters,previews,subtitles,optimized,backdrops,logos,alac_audio} 2>/dev/null || true

# Set permissions
chmod 755 config setup-data jackett-config downloads backend/{thumbnails,posters,previews,subtitles,optimized,backdrops,logos,alac_audio} 2>/dev/null || true

echo "🎬 HomeFlix Quick Start"
echo "======================"

# Check Docker
if ! command -v docker &> /dev/null || ! docker info &> /dev/null; then
    echo "❌ Docker is required. Please install Docker first."
    exit 1
fi

# Migrate existing config if available
if [ -f "backend/.env" ] && [ ! -f "config/backend.env" ]; then
    echo "📋 Migrating existing configuration..."
    cp backend/.env config/backend.env 2>/dev/null || true
fi

# Start services
echo "🚀 Starting HomeFlix..."
docker-compose build --parallel --quiet
docker-compose --profile production up -d

echo "⏳ Waiting for services..."
sleep 8

# Check status
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "🎉 HomeFlix is running!"
    echo "🌐 Open: http://localhost:3008"
    echo ""
else
    echo "⚠️  Check status: docker-compose ps"
    echo "📋 View logs: docker-compose logs"
fi