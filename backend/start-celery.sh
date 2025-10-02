#!/bin/bash

# HomeFlix Celery Task Queue Startup Script
# Starts all Celery workers for distributed media processing

echo "🚀 Starting HomeFlix Celery Task Queue System..."

# Check if running inside Docker Compose
if [ -n "$COMPOSE_PROJECT_NAME" ]; then
    # Running inside Docker Compose - use service name
    export REDIS_URL="redis://redis:6379/0"
    export CELERY_BROKER_URL="redis://redis:6379/0"
    export CELERY_RESULT_BACKEND="redis://redis:6379/0"
    echo "🔍 Using Docker Compose Redis service at redis:6379"
else
    # Running locally - check if Docker Compose is running
    if docker compose ps redis 2>/dev/null | grep -q "Up"; then
        echo "🔍 Using Docker Compose Redis service at localhost:6380"
        export REDIS_URL="redis://localhost:6380/0"
        export CELERY_BROKER_URL="redis://localhost:6380/0"
        export CELERY_RESULT_BACKEND="redis://localhost:6380/0"
    else
        echo "❌ Redis is not running. Please start the services with 'docker compose up -d'"
        exit 1
    fi
fi

# Set other environment variables
export CELERY_BRIDGE_PORT="5001"
export PYTHONPATH="$(pwd)"

# Create necessary directories
mkdir -p thumbnails posters previews subtitles optimized

echo "📁 Created processing directories"

# Start Celery workers in background
echo "🔥 Starting Celery workers..."

# High Priority Queues
echo "  🤖 Starting Metadata worker (High Priority)..."
celery -A celery_app worker -Q metadata -n metadata_worker@%h --loglevel=info --concurrency=4 --detach

echo "  🖼️ Starting Thumbnails worker (High Priority)..."
celery -A celery_app worker -Q thumbnails -n thumbnails_worker@%h --loglevel=info --concurrency=6 --detach

# Medium Priority Queues
echo "  🎬 Starting Posters worker (Medium Priority)..."
celery -A celery_app worker -Q posters -n posters_worker@%h --loglevel=info --concurrency=3 --detach

echo "  📹 Starting Video Processing worker (Medium Priority)..."
celery -A celery_app worker -Q video_processing -n video_worker@%h --loglevel=info --concurrency=2 --detach

# Low Priority Queues
echo "  📝 Starting Subtitles worker (Low Priority)..."
celery -A celery_app worker -Q subtitles -n subtitles_worker@%h --loglevel=info --concurrency=2 --detach

echo "  🔍 Starting Scanning worker (Low Priority)..."
celery -A celery_app worker -Q scanning -n scanning_worker@%h --loglevel=info --concurrency=1 --detach

# Start Celery Bridge Service
echo "  🌉 Starting Celery Bridge Service..."
python celery_bridge.py &
BRIDGE_PID=$!
echo $BRIDGE_PID > celery_bridge.pid

# Start Flower monitoring (optional)
echo "  🌸 Starting Flower monitoring dashboard..."
celery -A celery_app flower --port=5555 --detach

sleep 3

# Check worker status
echo ""
echo "📊 Celery Worker Status:"
celery -A celery_app status

echo ""
echo "✅ HomeFlix Celery Task Queue System Started!"
echo ""
echo "🌐 Monitoring Dashboard: http://localhost:5555"
echo "🌉 Bridge Service: http://localhost:5001"
echo "📊 Queue Status:"
echo "   • metadata (High Priority): AI metadata generation"
echo "   • thumbnails (High Priority): Thumbnail & preview generation"
echo "   • posters (Medium Priority): Poster downloads"
echo "   • video_processing (Medium Priority): Video analysis & optimization"
echo "   • subtitles (Low Priority): Subtitle extraction & conversion"
echo "   • scanning (Low Priority): Media library scanning & orchestration"
echo ""
echo "🛑 To stop all workers: ./stop-celery.sh"
