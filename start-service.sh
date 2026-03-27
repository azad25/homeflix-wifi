#!/bin/bash

# HomeFlix Service Start Script
SCRIPT_DIR=/home/azad/homeflix-local/homeflix-wifi
LOG_DIR="$SCRIPT_DIR"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting HomeFlix services..." >> "$SCRIPT_DIR/startup.log"

# Create necessary directories
mkdir -p "$SCRIPT_DIR/thumbnails"
mkdir -p "$SCRIPT_DIR/posters"
mkdir -p "$SCRIPT_DIR/previews"
mkdir -p "$SCRIPT_DIR/subtitles"
mkdir -p "$SCRIPT_DIR/optimized"

# Wait for internet connectivity with timeout (important for WiFi that needs time to connect)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking internet connectivity..." >> "$SCRIPT_DIR/startup.log"
INTERNET_READY=0
# Wait up to 10 minutes (300 attempts × 2 seconds) for WiFi to come online
for i in {1..300}; do
    if ping -c 1 -W 2 8.8.8.8 &>/dev/null; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Internet is ready (attempt $i)" >> "$SCRIPT_DIR/startup.log"
        INTERNET_READY=1
        break
    fi
    # Show progress every 30 seconds
    if [ $((i % 15)) -eq 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for internet... ($(($i*2))s elapsed)" >> "$SCRIPT_DIR/startup.log"
    fi
    sleep 2
done

if [ $INTERNET_READY -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ⚠️ Warning: Internet not available after 10 minutes, continuing anyway..." >> "$SCRIPT_DIR/startup.log"
fi

# Check Redis connectivity with timeout
echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking Redis..." >> "$SCRIPT_DIR/startup.log"
REDIS_READY=0
for i in {1..10}; do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Redis is ready" >> "$SCRIPT_DIR/startup.log"
        REDIS_READY=1
        break
    fi
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for Redis... (attempt $i/10)" >> "$SCRIPT_DIR/startup.log"
    sleep 1
done

if [ $REDIS_READY -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ⚠️ Warning: Redis not available, continuing anyway..." >> "$SCRIPT_DIR/startup.log"
fi

# Start frontend
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting frontend..." >> "$SCRIPT_DIR/startup.log"
cd "$SCRIPT_DIR/frontend"
npm run start > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend.pid"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Frontend started with PID $FRONTEND_PID" >> "$SCRIPT_DIR/startup.log"

# Start backend
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting backend..." >> "$SCRIPT_DIR/startup.log"
cd "$SCRIPT_DIR/backend"
go mod tidy 2>/dev/null
go run server.go > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backend started with PID $BACKEND_PID" >> "$SCRIPT_DIR/startup.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - HomeFlix services started successfully" >> "$SCRIPT_DIR/startup.log"

# Keep the service running by waiting for child processes
wait
