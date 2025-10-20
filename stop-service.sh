#!/bin/bash

# HomeFlix Service Stop Script

HOMEFLIX_DIR="/home/azad/homeflix-local/homeflix-wifi"
PID_FILE="$HOMEFLIX_DIR/homeflix.pid"
LOG_FILE="$HOMEFLIX_DIR/homeflix.log"

cd "$HOMEFLIX_DIR"

echo "$(date): 🛑 Stopping HomeFlix Service..." >> "$LOG_FILE"

# Read PIDs from file
if [ -f "$PID_FILE" ]; then
    PIDS=$(cat "$PID_FILE")
    for PID in $PIDS; do
        if kill -0 "$PID" 2>/dev/null; then
            echo "$(date): Stopping process $PID" >> "$LOG_FILE"
            kill "$PID"
            # Wait a bit for graceful shutdown
            sleep 2
            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                kill -9 "$PID"
            fi
        fi
    done
    rm -f "$PID_FILE"
fi

# Also kill any remaining processes
pkill -f "go run server.go"
pkill -f "npm run start"

# Clean up individual PID files
rm -f backend.pid frontend.pid

echo "$(date): ✅ HomeFlix service stopped" >> "$LOG_FILE"