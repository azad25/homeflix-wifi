#!/bin/bash

# HomeFlix Service Stop Script
SCRIPT_DIR=/home/azad/homeflix-local/homeflix-wifi

echo "$(date '+%Y-%m-%d %H:%M:%S') - Stopping HomeFlix services..." >> "$SCRIPT_DIR/startup.log"

# Stop frontend
if [ -f "$SCRIPT_DIR/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/.frontend.pid")
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID 2>/dev/null
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Frontend stopped (PID: $FRONTEND_PID)" >> "$SCRIPT_DIR/startup.log"
    fi
    rm -f "$SCRIPT_DIR/.frontend.pid"
fi

# Stop backend
if [ -f "$SCRIPT_DIR/.backend.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/.backend.pid")
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Backend stopped (PID: $BACKEND_PID)" >> "$SCRIPT_DIR/startup.log"
    fi
    rm -f "$SCRIPT_DIR/.backend.pid"
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - HomeFlix services stopped" >> "$SCRIPT_DIR/startup.log"
