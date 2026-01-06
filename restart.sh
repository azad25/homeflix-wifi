#!/bin/bash

# HomeFlix Restart Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Restarting HomeFlix Production Server..."

# Stop the current server
echo "🛑 Stopping current server..."
bash "$SCRIPT_DIR/stop.sh"

# Wait for processes to fully terminate
echo "⏳ Waiting for shutdown..."
sleep 3

# Check if ports are free
echo "🔍 Checking if ports are available..."
for port in 3008 8252; do
    if lsof -i:$port > /dev/null 2>&1; then
        echo "⚠️ Port $port is still in use, waiting..."
        sleep 2
    fi
done

# Start the server
echo "🚀 Starting server..."
exec bash "$SCRIPT_DIR/start.sh"
