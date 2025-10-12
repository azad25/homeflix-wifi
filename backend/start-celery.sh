#!/bin/bash

# HomeFlix Celery Task Queue Startup Script
# Starts all Celery workers for distributed media processing

echo "🚀 Starting HomeFlix Celery Task Queue System..."

# Check if Redis is running on port 6379
echo "🔍 Checking Redis connection on port 6379..."
if ! docker run --rm --network host redis:7-alpine redis-cli -p 6379 ping > /dev/null 2>&1; then
    echo "❌ Redis not running on port 6379. Starting Redis container..."
    docker rm -f homeflix_redis 2>/dev/null || true
    docker run -d --name homeflix_redis -p 6379:6379 redis:7-alpine
    sleep 3
    if ! docker run --rm --network host redis:7-alpine redis-cli -p 6379 ping > /dev/null 2>&1; then
        echo "❌ Failed to start Redis container."
        exit 1
    fi
fi

echo "✅ Redis is running on port 6379"

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Set environment variables
export REDIS_URL="redis://localhost:6379/0"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"
export PYTHONPATH="$(pwd)"

# Create necessary directories
mkdir -p thumbnails posters previews subtitles optimized

echo "📁 Created processing directories"

# Start Celery workers in background
echo "🔥 Starting Celery workers..."

# Optimized for i5-4590 (4 cores) - Total: 8 workers max
echo "  🤖 Starting Metadata worker (High Priority)..."
celery -A celery_app worker -Q metadata -n metadata_worker@%h --loglevel=info --concurrency=2 --max-tasks-per-child=50 --detach

echo "  🖼️ Starting Thumbnails worker (High Priority)..."
celery -A celery_app worker -Q thumbnails -n thumbnails_worker@%h --loglevel=info --concurrency=2 --max-tasks-per-child=30 --detach

# Medium Priority Queues
echo "  🎬 Starting Posters worker (Medium Priority)..."
celery -A celery_app worker -Q posters -n posters_worker@%h --loglevel=info --concurrency=1 --max-tasks-per-child=50 --detach

echo "  📹 Starting Video Processing worker (Medium Priority)..."
celery -A celery_app worker -Q video_processing -n video_worker@%h --loglevel=info --concurrency=1 --max-tasks-per-child=20 --detach

# Low Priority Queues
echo "  📝 Starting Subtitles worker (Low Priority)..."
celery -A celery_app worker -Q subtitles -n subtitles_worker@%h --loglevel=info --concurrency=1 --max-tasks-per-child=50 --detach

echo "  🔍 Starting Scanning worker (Low Priority)..."
celery -A celery_app worker -Q scanning -n scanning_worker@%h --loglevel=info --concurrency=1 --max-tasks-per-child=100 --detach

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
echo "🌉 Bridge Service: http://localhost:5000"
echo "📊 Queue Status:"
echo "   • metadata (High Priority): AI metadata generation"
echo "   • thumbnails (High Priority): Thumbnail & preview generation"
echo "   • posters (Medium Priority): Poster downloads"
echo "   • video_processing (Medium Priority): Video analysis & optimization"
echo "   • subtitles (Low Priority): Subtitle extraction & conversion"
echo "   • scanning (Low Priority): Media library scanning & orchestration"
echo ""
echo "🛑 To stop all workers: ./stop-celery.sh"
