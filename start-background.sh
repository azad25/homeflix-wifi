#!/bin/bash

# HomeFlix Background Startup Script
HOMEFLIX_DIR="/home/azad/homeflix-local/homeflix-wifi"
MEDIA_PATH="/media/azad/Movies1"
LOG_FILE="$HOMEFLIX_DIR/cron-startup.log"

cd "$HOMEFLIX_DIR"

echo "$(date): 🚀 HomeFlix cron startup initiated..." > "$LOG_FILE"

# Wait for external drive
for i in {1..60}; do
    if [ -d "$MEDIA_PATH" ] && [ "$(ls -A $MEDIA_PATH 2>/dev/null)" ]; then
        echo "$(date): ✅ External drive ready" >> "$LOG_FILE"
        break
    fi
    sleep 5
done

# Start HomeFlix in background
nohup ./start.sh > homeflix-auto.log 2>&1 &
echo $! > homeflix-auto.pid

echo "$(date): ✅ HomeFlix started in background (PID: $(cat homeflix-auto.pid))" >> "$LOG_FILE"