#!/bin/bash

# HomeFlix Service Startup Script
# This script is designed to run as a systemd service

HOMEFLIX_DIR="/home/azad/homeflix-local/homeflix-wifi"
PID_FILE="$HOMEFLIX_DIR/homeflix.pid"
LOG_FILE="$HOMEFLIX_DIR/homeflix.log"

cd "$HOMEFLIX_DIR"

# Redirect output to log file
exec > "$LOG_FILE" 2>&1

echo "$(date): 🎬 Starting HomeFlix Service"
echo "=================================================="

# Check if required dependencies are installed
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "$(date): ❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "$(date): 📋 Checking dependencies..."
check_dependency "go"
check_dependency "node"
check_dependency "npm"
check_dependency "ffmpeg"
check_dependency "redis-server"

echo "$(date): ✅ All dependencies found!"

# Create media directory if it doesn't exist
MEDIA_PATH="/media/azad/Movies1"

# Create necessary directories for thumbnails, posters, and previews
echo "$(date): 📁 Creating necessary directories..."
mkdir -p thumbnails posters previews subtitles optimized

# Get local IP address for network access
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Start backend
echo "$(date): 🚀 Starting Go backend..."
cd backend
go mod tidy
nohup go run server.go > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..

# Wait for backend to start
sleep 10

# Start frontend
echo "$(date): 🎨 Starting Next.js frontend in production mode..."
cd frontend
nohup npm run start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..

# Create main PID file with both process IDs
echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"

echo "$(date): 🎉 HomeFlix service is now running!"
echo "=================================="
echo "$(date): 🌐 Frontend (Local): http://localhost:3008"
echo "$(date): 🌐 Frontend (Network): http://$LOCAL_IP:3008"
echo "$(date): 🔧 Backend API (Local): http://localhost:8252"
echo "$(date): 🔧 Backend API (Network): http://$LOCAL_IP:8252"
echo "$(date): 📁 Media Path: $MEDIA_PATH"
echo "$(date): 📝 Logs: $LOG_FILE"

# Keep the script running to maintain the service
trap "echo '$(date): 🛑 Stopping HomeFlix...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# Wait for processes to finish
wait