#!/bin/bash

# HomeFlix Celery Task Queue Stop Script
# Gracefully stops all Celery workers

echo "🛑 Stopping HomeFlix Celery Task Queue System..."

# Stop all Celery workers
echo "  Stopping all Celery workers..."
pkill -f "celery.*worker"

# Stop Flower monitoring
echo "  Stopping Flower monitoring..."
pkill -f "celery.*flower"

# Stop Celery Beat (if running)
echo "  Stopping Celery Beat scheduler..."
pkill -f "celery.*beat"

# Stop Celery Bridge Service
echo "  Stopping Celery Bridge Service..."
if [ -f "celery_bridge.pid" ]; then
    BRIDGE_PID=$(cat celery_bridge.pid)
    kill $BRIDGE_PID 2>/dev/null
    rm celery_bridge.pid
fi
pkill -f "celery_bridge.py"

# Wait for processes to terminate
sleep 3

# Check if any Celery processes are still running
CELERY_PROCESSES=$(pgrep -f "celery" | wc -l)

if [ $CELERY_PROCESSES -eq 0 ]; then
    echo "✅ All Celery processes stopped successfully"
else
    echo "⚠️  Some Celery processes may still be running ($CELERY_PROCESSES found)"
    echo "  Use 'pkill -9 -f celery' to force kill if needed"
fi

echo "🏁 HomeFlix Celery Task Queue System stopped"
