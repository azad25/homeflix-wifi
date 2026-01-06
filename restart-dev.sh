#!/bin/bash

# HomeFlix Dev Restart Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Restarting HomeFlix Development Server..."

# Stop the current dev server
echo "🛑 Stopping current dev server..."
bash "$SCRIPT_DIR/stop-dev.sh"

# Wait for processes to fully terminate
echo "⏳ Waiting for shutdown..."
sleep 3

# Check if ports are free
echo "🔍 Checking if dev ports are available..."
for port in 3009 8253; do
    if lsof -i:$port > /dev/null 2>&1; then
        echo "⚠️ Port $port is still in use, waiting..."
        sleep 2
    fi
done

# Start the dev server
echo "🚀 Starting dev server..."
exec bash "$SCRIPT_DIR/start-dev.sh"
