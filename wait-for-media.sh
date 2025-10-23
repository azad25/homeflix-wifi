#!/bin/bash

# Wait for media drive to be available
MEDIA_PATH="/media/azad/Movies1"
MAX_WAIT=300  # 5 minutes

echo "Waiting for media drive at $MEDIA_PATH..."

for i in $(seq 1 $MAX_WAIT); do
    if [ -d "$MEDIA_PATH" ] && [ "$(ls -A $MEDIA_PATH 2>/dev/null)" ]; then
        echo "Media drive is ready!"
        exit 0
    fi
    sleep 1
done

echo "Warning: Media drive not found after ${MAX_WAIT} seconds, continuing anyway..."
exit 0