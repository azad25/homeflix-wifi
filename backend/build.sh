#!/bin/bash

# Build script for HomeFlix backend
# This script builds the backend with the Rain torrent client (no SQLite conflicts)

echo "🔨 Building HomeFlix backend..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
go clean -cache
rm -f homeflix-backend

# Build with CGO enabled (using mattn/go-sqlite3 + cenkalti/rain)
echo "⚙️ Building with Rain torrent client..."
go build -v -o homeflix-backend

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Binary: homeflix-backend"
    echo "📦 Binary size: $(du -h homeflix-backend | cut -f1)"
    echo "🌧️ Using Rain torrent client (no SQLite conflicts)"
    echo ""
    echo "🚀 To run the server:"
    echo "   ./homeflix-backend"
else
    echo "❌ Build failed!"
    exit 1
fi