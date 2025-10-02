#!/bin/bash

# HomeFlix Production Startup Script
# Platform-independent script for production deployment

set -e

echo "🚀 Starting HomeFlix Production Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your production configuration before continuing"
    echo "   Especially update MEDIA_PATH and API keys"
    exit 1
fi

# Source environment variables
source .env

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
    echo "❌ docker-compose or 'docker compose' is not available"
    exit 1
fi

# Use docker compose or docker-compose based on availability
DOCKER_COMPOSE_CMD="docker compose"
if ! docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi

# Set production environment
export BUILD_TARGET=production

echo "🏭 Building and starting production services..."
echo "   - Optimized backend build"
echo "   - Redis message broker"
echo "   - All Celery workers"
echo "   - Flower monitoring dashboard"
echo "   - Production frontend"

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
$DOCKER_COMPOSE_CMD down --remove-orphans

# Build and start services in production mode
echo "🔨 Building production images..."
$DOCKER_COMPOSE_CMD build --no-cache

echo "🚀 Starting Redis..."
$DOCKER_COMPOSE_CMD up -d redis

echo "⏳ Waiting for Redis to be ready..."
timeout=60
while [ $timeout -gt 0 ]; do
    if $DOCKER_COMPOSE_CMD exec redis redis-cli ping > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout-2))
done

if [ $timeout -le 0 ]; then
    echo "❌ Redis failed to start within 60 seconds"
    exit 1
fi

echo "🚀 Starting Backend..."
$DOCKER_COMPOSE_CMD up -d backend

echo "⏳ Waiting for Backend to be ready..."
timeout=120
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:8251/health > /dev/null 2>&1; then
        break
    fi
    sleep 3
    timeout=$((timeout-3))
done

if [ $timeout -le 0 ]; then
    echo "❌ Backend failed to start within 120 seconds"
    $DOCKER_COMPOSE_CMD logs backend
    exit 1
fi

echo "🚀 Starting Celery Workers..."
$DOCKER_COMPOSE_CMD up -d celery-metadata celery-thumbnails celery-posters celery-video celery-subtitles celery-scanning celery-flower

echo "⏳ Waiting for Celery workers to be ready..."
sleep 15

echo "🚀 Starting Frontend..."
$DOCKER_COMPOSE_CMD up -d frontend

echo ""
echo "✅ HomeFlix Production Environment Started!"
echo ""
echo "🌐 Services Available:"
echo "   • Frontend:          http://localhost:3006"
echo "   • Backend API:       http://localhost:8251"
echo "   • Flower Dashboard:  http://localhost:5555"
echo "   • Redis:             localhost:6380"
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE_CMD ps
echo ""
echo "🔍 Health Checks:"
echo "   Backend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8251/health || echo "Failed")"
echo "   Frontend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006 || echo "Failed")"
echo "   Flower: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:5555 || echo "Failed")"
echo ""
echo "📝 To view logs:"
echo "   $DOCKER_COMPOSE_CMD logs -f [service-name]"
echo ""
echo "🛑 To stop all services:"
echo "   $DOCKER_COMPOSE_CMD down"
echo ""
echo "📈 Monitor performance at: http://localhost:5555"
