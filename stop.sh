#!/bin/bash

# HomeFlix Stop Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🛑 Stopping HomeFlix..."

# Kill processes on port 3008 (frontend)
echo "Stopping frontend on port 3008..."
fuser -k 3008/tcp 2>/dev/null || true

# Kill processes on port 8252 (backend)
echo "Stopping backend on port 8252..."
fuser -k 8252/tcp 2>/dev/null || true

# Kill any remaining homeflix processes
pkill -f "homeflix-backend" 2>/dev/null || true
pkill -f "go run server.go" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

# Verify ports are free
sleep 1
if lsof -i :3008 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Port 3008 still in use, force killing..."
    lsof -i :3008 -t 2>/dev/null | xargs -r kill -9
fi

if lsof -i :8252 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Port 8252 still in use, force killing..."
    lsof -i :8252 -t 2>/dev/null | xargs -r kill -9
fi

echo "✅ HomeFlix stopped!"

# Clean up log files and PID files
echo "🧹 Cleaning up log and PID files..."
rm -f "$SCRIPT_DIR"/*.log
rm -f "$SCRIPT_DIR"/.*.pid

echo "✅ Cleanup complete!"
