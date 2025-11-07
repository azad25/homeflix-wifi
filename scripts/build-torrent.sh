#!/bin/bash

echo "🔨 Building HomeFlix with Torrent Support"
echo "========================================="

# Build backend with CGO disabled to avoid SQLite conflicts
echo "📦 Building backend..."
cd backend

# Set build tags to exclude conflicting SQLite implementations
export CGO_ENABLED=1
export CGO_CFLAGS="-g -O2"

# Build with specific tags to avoid conflicts
go build -tags "sqlite_omit_load_extension" -o homeflix-server .

if [ $? -eq 0 ]; then
    echo "✅ Backend built successfully!"
    echo "📁 Binary: backend/homeflix-server"
else
    echo "❌ Backend build failed!"
    echo ""
    echo "🔧 Trying alternative build without torrent support..."
    
    # Remove torrent dependencies temporarily
    go mod edit -droprequire github.com/anacrolix/torrent
    go mod tidy
    
    # Build without torrent
    go build -o homeflix-server .
    
    if [ $? -eq 0 ]; then
        echo "✅ Backend built successfully (without torrent support)!"
        echo "⚠️  To enable torrent support, please resolve SQLite conflicts"
        
        # Restore torrent dependency
        go mod edit -require github.com/anacrolix/torrent@v1.54.0
        go mod tidy
    else
        echo "❌ Build failed completely!"
        exit 1
    fi
fi

cd ..

# Build frontend
echo ""
echo "🎨 Building frontend..."
cd frontend

if command -v npm &> /dev/null; then
    npm run build
    if [ $? -eq 0 ]; then
        echo "✅ Frontend built successfully!"
    else
        echo "❌ Frontend build failed!"
        exit 1
    fi
else
    echo "⚠️  npm not found, skipping frontend build"
fi

cd ..

echo ""
echo "🎉 Build completed!"
echo ""
echo "🚀 To start HomeFlix:"
echo "   ./start.sh"
echo ""
echo "🔧 To setup torrents:"
echo "   ./setup-jackett.sh"