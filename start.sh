#!/bin/bash

# HomeFlix Startup Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

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
check_dependency "redis-server"

echo "✅ All dependencies found!"

# Check if already running
if lsof -i :3008 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Frontend already running on port 3008"
    FRONTEND_RUNNING=true
else
    FRONTEND_RUNNING=false
fi

if lsof -i :8252 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Backend already running on port 8252"
    BACKEND_RUNNING=true
else
    BACKEND_RUNNING=false
fi

# Create media directory if it doesn't exist
MEDIA_PATH="/media/azad/Movies1"
if [ ! -d "$MEDIA_PATH" ]; then
    echo "📁 Creating media directory: $MEDIA_PATH"
    sudo mkdir -p "$MEDIA_PATH"
    echo "⚠️  Please add your media files to: $MEDIA_PATH"
fi

# Create necessary directories for thumbnails, posters, and previews
echo "📁 Creating necessary directories..."
mkdir -p "$SCRIPT_DIR/thumbnails"
mkdir -p "$SCRIPT_DIR/posters"
mkdir -p "$SCRIPT_DIR/previews"
mkdir -p "$SCRIPT_DIR/subtitles"
mkdir -p "$SCRIPT_DIR/optimized"

# Get local IP address for network access
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Start frontend in background
if [ "$FRONTEND_RUNNING" = false ]; then
    echo "🎨 Starting Next.js frontend in background..."
    cd "$SCRIPT_DIR/frontend"
    nohup npm run start > "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend.pid"
    cd "$SCRIPT_DIR"
fi

# Start backend in background
if [ "$BACKEND_RUNNING" = false ]; then
    echo "🚀 Starting Go backend in background..."
    cd "$SCRIPT_DIR/backend"
    go mod tidy 2>/dev/null
    nohup go run server.go > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"
    cd "$SCRIPT_DIR"
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 3

# Check if services are running
FRONTEND_OK=false
BACKEND_OK=false

for i in {1..20}; do
    if lsof -i :3008 2>/dev/null | grep -q LISTEN; then
        FRONTEND_OK=true
        break
    fi
    sleep 1
done

for i in {1..20}; do
    if lsof -i :8252 2>/dev/null | grep -q LISTEN; then
        BACKEND_OK=true
        break
    fi
    sleep 1
done

echo ""
echo "=================================="
if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
    echo "🎉 HomeFlix is now running!"
    echo "=================================="
    echo "🌐 Frontend (Local):   http://localhost:3008"
    echo "🌐 Frontend (Network): http://$LOCAL_IP:3008"
    echo "🔧 Backend (Local):    http://localhost:8252"
    echo "🔧 Backend (Network):  http://$LOCAL_IP:8252"
    echo "📁 Media Path:         $MEDIA_PATH"
    echo ""
    echo "📱 Network Access:"
    echo "   Access from any device on your WiFi: http://$LOCAL_IP:3008"
    echo ""
    echo "📝 Logs:"
    echo "   Frontend: $FRONTEND_LOG"
    echo "   Backend:  $BACKEND_LOG"
    echo ""
    echo "🛑 To stop: ./stop.sh"
else
    echo "⚠️  Some services failed to start:"
    if [ "$FRONTEND_OK" = false ]; then
        echo "   ❌ Frontend not running - check $FRONTEND_LOG"
    else
        echo "   ✅ Frontend running on port 3008"
    fi
    if [ "$BACKEND_OK" = false ]; then
        echo "   ❌ Backend not running - check $BACKEND_LOG"
    else
        echo "   ✅ Backend running on port 8252"
    fi
fi
echo "=================================="
