#!/bin/bash

# HomeFlix Development Startup Script
# Platform-independent script for development with hot reloading

set -e

echo "🚀 Starting HomeFlix Development Environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing"
    echo "   Especially update MEDIA_PATH to point to your movies directory"
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

# Set development environment
export BUILD_TARGET=development

echo "🔧 Building and starting development services..."
echo "   - Backend with hot reloading"
echo "   - Redis message broker"
echo "   - All Celery workers"
echo "   - Flower monitoring dashboard"
echo "   - Frontend with hot reloading"

# Start services
$DOCKER_COMPOSE_CMD up --build -d redis

echo "⏳ Waiting for Redis to be ready..."
sleep 5

$DOCKER_COMPOSE_CMD up --build -d backend

echo "⏳ Waiting for Backend to be ready..."
sleep 10

$DOCKER_COMPOSE_CMD up --build -d celery-metadata celery-thumbnails celery-posters celery-video celery-subtitles celery-scanning celery-flower

echo "⏳ Waiting for Celery workers to be ready..."
sleep 10

$DOCKER_COMPOSE_CMD up --build -d frontend

echo ""
echo "✅ HomeFlix Development Environment Started!"
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
echo "📝 To view logs:"
echo "   $DOCKER_COMPOSE_CMD logs -f [service-name]"
echo ""
echo "🛑 To stop all services:"
echo "   $DOCKER_COMPOSE_CMD down"
echo ""
echo "🔄 Hot reloading is enabled for both frontend and backend"
echo "   Changes to source code will automatically restart the services"
