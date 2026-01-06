#!/bin/bash

# HomeFlix Development Server Script
# Runs on different ports (Backend: 8253, Frontend: 3009) for development

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR"
FRONTEND_DEV_LOG="$LOG_DIR/frontend-dev.log"
BACKEND_DEV_LOG="$LOG_DIR/backend-dev.log"

# Dev ports
BACKEND_DEV_PORT=8253
FRONTEND_DEV_PORT=3009

echo "🔧 Starting HomeFlix Development Server"
echo "========================================"

# Check if required dependencies are installed
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking dependencies..."
check_dependency "go"
check_dependency "node"
check_dependency "npm"

echo "✅ All dependencies found!"

# Clean up old dev log files and create fresh ones
echo "🧹 Cleaning up old dev log files..."
rm -f "$SCRIPT_DIR"/*-dev.log
rm -f "$SCRIPT_DIR"/.frontend-dev.pid
rm -f "$SCRIPT_DIR"/.backend-dev.pid

# Create fresh dev log files
touch "$FRONTEND_DEV_LOG"
touch "$BACKEND_DEV_LOG"

echo "📝 Created fresh dev log files"

# Check if already running
if lsof -i :$FRONTEND_DEV_PORT 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Dev Frontend already running on port $FRONTEND_DEV_PORT"
    FRONTEND_RUNNING=true
else
    FRONTEND_RUNNING=false
fi

if lsof -i :$BACKEND_DEV_PORT 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Dev Backend already running on port $BACKEND_DEV_PORT"
    BACKEND_RUNNING=true
else
    BACKEND_RUNNING=false
fi

# Get local IP address for network access
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

# Start frontend dev server in background
if [ "$FRONTEND_RUNNING" = false ]; then
    echo "🎨 Starting Next.js dev frontend on port $FRONTEND_DEV_PORT..."
    cd "$SCRIPT_DIR/frontend"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        npm install
    fi
    
    PORT=$FRONTEND_DEV_PORT nohup npm run dev > "$FRONTEND_DEV_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend-dev.pid"
    cd "$SCRIPT_DIR"
    echo "📝 Frontend dev server started with PID: $FRONTEND_PID"
fi

# Start backend dev server in background
if [ "$BACKEND_RUNNING" = false ]; then
    echo "🚀 Starting Go dev backend on port $BACKEND_DEV_PORT..."
    cd "$SCRIPT_DIR/backend"
    
    # Ensure go modules are up to date
    go mod tidy 2>/dev/null
    
    PORT=$BACKEND_DEV_PORT nohup go run server.go > "$BACKEND_DEV_LOG" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$SCRIPT_DIR/.backend-dev.pid"
    cd "$SCRIPT_DIR"
    echo "📝 Backend dev server started with PID: $BACKEND_PID"
fi

# Wait for services to start
echo "⏳ Waiting for dev services to start..."
sleep 5

# Check if services are running
FRONTEND_OK=false
BACKEND_OK=false

echo "🔍 Checking if services started successfully..."

for i in {1..30}; do
    if lsof -i :$FRONTEND_DEV_PORT 2>/dev/null | grep -q LISTEN; then
        FRONTEND_OK=true
        echo "✅ Frontend dev server is responding on port $FRONTEND_DEV_PORT"
        break
    fi
    echo "⏳ Waiting for frontend dev server... ($i/30)"
    sleep 1
done

for i in {1..30}; do
    if lsof -i :$BACKEND_DEV_PORT 2>/dev/null | grep -q LISTEN; then
        BACKEND_OK=true
        echo "✅ Backend dev server is responding on port $BACKEND_DEV_PORT"
        break
    fi
    echo "⏳ Waiting for backend dev server... ($i/30)"
    sleep 1
done

echo ""
echo "========================================"
if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
    echo "🎉 HomeFlix Dev Server is now running!"
    echo "========================================"
    echo "🌐 Dev Frontend (Local):   http://localhost:$FRONTEND_DEV_PORT"
    echo "🌐 Dev Frontend (Network): http://$LOCAL_IP:$FRONTEND_DEV_PORT"
    echo "🔧 Dev Backend (Local):    http://localhost:$BACKEND_DEV_PORT"
    echo "🔧 Dev Backend (Network):  http://$LOCAL_IP:$BACKEND_DEV_PORT"
    echo ""
    echo "📱 Network Access:"
    echo "   Access from any device on your WiFi: http://$LOCAL_IP:$FRONTEND_DEV_PORT"
    echo ""
    echo "📝 Dev Logs:"
    echo "   Frontend: $FRONTEND_DEV_LOG"
    echo "   Backend:  $BACKEND_DEV_LOG"
    echo ""
    echo "🛑 To stop: ./stop-dev.sh"
    echo ""
    echo "🔧 Development Mode Features:"
    echo "   - Hot reload enabled"
    echo "   - Debug logging enabled"
    echo "   - Auto-restart on file changes"
else
    echo "⚠️  Some dev services failed to start:"
    if [ "$FRONTEND_OK" = false ]; then
        echo "   ❌ Dev Frontend not running - check $FRONTEND_DEV_LOG"
        echo "   📝 Last few lines of frontend log:"
        tail -n 5 "$FRONTEND_DEV_LOG" 2>/dev/null || echo "   (No log file found)"
    else
        echo "   ✅ Dev Frontend running on port $FRONTEND_DEV_PORT"
    fi
    if [ "$BACKEND_OK" = false ]; then
        echo "   ❌ Dev Backend not running - check $BACKEND_DEV_LOG"
        echo "   📝 Last few lines of backend log:"
        tail -n 5 "$BACKEND_DEV_LOG" 2>/dev/null || echo "   (No log file found)"
    else
        echo "   ✅ Dev Backend running on port $BACKEND_DEV_PORT"
    fi
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check if ports $FRONTEND_DEV_PORT and $BACKEND_DEV_PORT are available"
    echo "   - Ensure all dependencies are installed"
    echo "   - Check log files for detailed error messages"
fi
echo "========================================"
