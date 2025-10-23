#!/bin/bash

# HomeFlix Delayed Startup Script
# Waits for system to fully boot and external drives to mount

HOMEFLIX_DIR="/home/azad/homeflix-local/homeflix-wifi"
MEDIA_PATH="/media/azad/Movies1"
LOG_FILE="$HOMEFLIX_DIR/startup.log"

cd "$HOMEFLIX_DIR"

echo "$(date): 🕐 HomeFlix delayed startup initiated..." > "$LOG_FILE"

# Wait for desktop environment to fully load
sleep 30

# Wait for external drive to be mounted (max 5 minutes)
echo "$(date): 📁 Waiting for external drive to mount..." >> "$LOG_FILE"
for i in {1..60}; do
    if [ -d "$MEDIA_PATH" ] && [ "$(ls -A $MEDIA_PATH 2>/dev/null)" ]; then
        echo "$(date): ✅ External drive mounted and contains files" >> "$LOG_FILE"
        break
    fi
    echo "$(date): ⏳ Waiting for external drive... ($i/60)" >> "$LOG_FILE"
    sleep 5
done

# Check if drive is still not mounted
if [ ! -d "$MEDIA_PATH" ] || [ ! "$(ls -A $MEDIA_PATH 2>/dev/null)" ]; then
    echo "$(date): ⚠️ External drive not found, but starting anyway..." >> "$LOG_FILE"
    # Show notification to user
    notify-send "HomeFlix Warning" "External drive not found at $MEDIA_PATH" -i dialog-warning
fi

# Wait for network to be fully available
echo "$(date): 🌐 Checking network connectivity..." >> "$LOG_FILE"
for i in {1..12}; do
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        echo "$(date): ✅ Network is available" >> "$LOG_FILE"
        break
    fi
    echo "$(date): ⏳ Waiting for network... ($i/12)" >> "$LOG_FILE"
    sleep 5
done

# Start HomeFlix in a new terminal window
echo "$(date): 🚀 Starting HomeFlix..." >> "$LOG_FILE"
gnome-terminal --title="HomeFlix Server" --geometry=100x30 -- bash -c "
    cd '$HOMEFLIX_DIR'
    echo '🎬 Starting HomeFlix - Netflix Clone'
    echo '=================================='
    ./start.sh
    echo ''
    echo 'Press any key to close this window...'
    read -n 1
"

echo "$(date): ✅ HomeFlix startup script completed" >> "$LOG_FILE"