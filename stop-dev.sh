#!/bin/bash

# HomeFlix Development Server Stop Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛑 Stopping HomeFlix Development Server..."

# Stop frontend dev
if [ -f "$SCRIPT_DIR/.frontend-dev.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/.frontend-dev.pid")
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID 2>/dev/null
        echo "✅ Dev Frontend stopped (PID: $FRONTEND_PID)"
    fi
    rm -f "$SCRIPT_DIR/.frontend-dev.pid"
fi

# Stop backend dev
if [ -f "$SCRIPT_DIR/.backend-dev.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/.backend-dev.pid")
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ Dev Backend stopped (PID: $BACKEND_PID)"
    fi
    rm -f "$SCRIPT_DIR/.backend-dev.pid"
fi

# Kill any remaining processes on dev ports
if lsof -i :3009 2>/dev/null | grep -q LISTEN; then
    fuser -k 3009/tcp 2>/dev/null
    echo "✅ Killed process on port 3009"
fi

if lsof -i :8253 2>/dev/null | grep -q LISTEN; then
    fuser -k 8253/tcp 2>/dev/null
    echo "✅ Killed process on port 8253"
fi

echo "🎬 HomeFlix Development Server stopped!"
