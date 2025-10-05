#!/bin/bash

# HomeFlix Setup Script
echo "🎬 Setting up HomeFlix - Netflix Clone"
echo "====================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check and install dependencies
echo "📋 Checking system dependencies..."

# Check Go
if ! command_exists go; then
    echo "❌ Go is not installed."
    echo "📥 Please install Go from: https://golang.org/dl/"
    echo "   Or use your package manager:"
    echo "   - Ubuntu/Debian: sudo apt install golang-go"
    echo "   - macOS: brew install go"
    echo "   - Arch: sudo pacman -S go"
    exit 1
else
    echo "✅ Go found: $(go version)"
fi

# Check Node.js
if ! command_exists node; then
    echo "❌ Node.js is not installed."
    echo "📥 Please install Node.js from: https://nodejs.org/"
    echo "   Or use your package manager:"
    echo "   - Ubuntu/Debian: sudo apt install nodejs npm"
    echo "   - macOS: brew install node"
    echo "   - Arch: sudo pacman -S nodejs npm"
    exit 1
else
    echo "✅ Node.js found: $(node --version)"
fi

# Check npm
if ! command_exists npm; then
    echo "❌ npm is not installed."
    echo "📥 Please install npm (usually comes with Node.js)"
    exit 1
else
    echo "✅ npm found: $(npm --version)"
fi

# Check FFmpeg
if ! command_exists ffmpeg; then
    echo "❌ FFmpeg is not installed."
    echo "📥 Please install FFmpeg:"
    echo "   - Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   - macOS: brew install ffmpeg"
    echo "   - Arch: sudo pacman -S ffmpeg"
    exit 1
else
    echo "✅ FFmpeg found: $(ffmpeg -version | head -n1)"
fi

echo ""
echo "🔧 Setting up project..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p thumbnails
mkdir -p posters
mkdir -p previews
mkdir -p subtitles
mkdir -p optimized

# Create media directory
MEDIA_PATH="/media/azad/Movies"
if [ ! -d "$MEDIA_PATH" ]; then
    echo "📁 Creating media directory: $MEDIA_PATH"
    sudo mkdir -p "$MEDIA_PATH"
    sudo chown $USER:$USER "$MEDIA_PATH"
    echo "⚠️  Please add your media files to: $MEDIA_PATH"
fi

# Install backend dependencies
echo "📦 Installing Go dependencies..."
cd backend
go mod tidy
cd ..

# Install frontend dependencies
echo "📦 Installing Node.js dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo "================================"
echo ""
echo "📖 Next steps:"
echo "1. Add your movies/series to: $MEDIA_PATH"
echo "2. Run: ./start.sh"
echo "3. Open http://localhost:3006 in your browser"
echo ""
echo "💡 Tips:"
echo "- Thumbnails will be generated in: ./thumbnails"
echo "- Posters will be generated in: ./posters"
echo "- Previews will be generated in: ./previews"
echo "- Database will be created as: ./homeflix.db"
echo ""
echo "🚀 Ready to start HomeFlix!"