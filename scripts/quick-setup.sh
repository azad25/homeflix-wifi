#!/bin/bash

echo "🎬 HomeFlix Torrent System - Quick Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "setup-jackett.sh" ] || [ ! -f "setup-jackett-native.sh" ]; then
    print_error "Please run this script from the HomeFlix root directory"
    exit 1
fi

echo ""
echo "Choose your setup method:"
echo "1) Docker Setup (Recommended - Easy)"
echo "2) Native Setup (No Docker)"
echo "3) Demo Mode Only (No real torrents)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        print_info "Setting up Jackett with Docker..."
        
        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            print_error "Docker is not installed. Please install Docker first:"
            echo "  Ubuntu/Debian: sudo apt install docker.io"
            echo "  Fedora: sudo dnf install docker"
            echo "  Arch: sudo pacman -S docker"
            exit 1
        fi
        
        # Run Docker setup
        chmod +x setup-jackett.sh
        ./setup-jackett.sh
        
        if [ $? -eq 0 ]; then
            print_status "Jackett Docker setup completed!"
            
            # Wait for Jackett to start
            print_info "Waiting for Jackett to start..."
            sleep 10
            
            # Test if Jackett is accessible
            if curl -s http://localhost:9117 > /dev/null; then
                print_status "Jackett is running at http://localhost:9117"
                JACKETT_RUNNING=true
            else
                print_warning "Jackett may still be starting. Please wait a moment."
                JACKETT_RUNNING=false
            fi
        else
            print_error "Jackett setup failed"
            exit 1
        fi
        ;;
        
    2)
        echo ""
        print_info "Setting up Jackett natively..."
        
        # Run native setup
        chmod +x setup-jackett-native.sh
        ./setup-jackett-native.sh
        
        if [ $? -eq 0 ]; then
            print_status "Jackett native setup completed!"
            
            # Wait for Jackett to start
            print_info "Waiting for Jackett to start..."
            sleep 5
            
            # Test if Jackett is accessible
            if curl -s http://localhost:9117 > /dev/null; then
                print_status "Jackett is running at http://localhost:9117"
                JACKETT_RUNNING=true
            else
                print_warning "Jackett may still be starting. Please wait a moment."
                JACKETT_RUNNING=false
            fi
        else
            print_error "Jackett setup failed"
            exit 1
        fi
        ;;
        
    3)
        echo ""
        print_info "Demo mode selected - no Jackett setup needed"
        JACKETT_RUNNING=false
        ;;
        
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_info "Building HomeFlix with torrent support..."

# Build backend
cd backend
if go build -o homeflix-server .; then
    print_status "Backend built successfully"
else
    print_error "Backend build failed"
    exit 1
fi

# Build frontend
cd ../frontend
if npm run build > /dev/null 2>&1; then
    print_status "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

cd ..

echo ""
echo "🎉 Setup Complete!"
echo "=================="

if [ "$JACKETT_RUNNING" = true ]; then
    echo ""
    print_status "Jackett is running at: http://localhost:9117"
    print_info "Next steps:"
    echo "  1. Open http://localhost:9117 in your browser"
    echo "  2. Add indexers (1337x, YTS, EZTV, etc.)"
    echo "  3. Copy your API key from the Jackett dashboard"
    echo "  4. Start HomeFlix and configure the API key in Settings → Torrents"
    echo ""
elif [ "$choice" = "3" ]; then
    print_info "Demo mode ready - you can test the torrent interface with mock data"
    echo ""
else
    print_warning "Jackett setup completed but may still be starting"
    print_info "Check http://localhost:9117 in a few minutes"
    echo ""
fi

echo "🚀 Start HomeFlix:"
echo "  Terminal 1: cd backend && ./homeflix-server"
echo "  Terminal 2: cd frontend && npm run dev"
echo "  Then open: http://localhost:3000"
echo ""

if [ "$choice" != "3" ]; then
    echo "⚙️ Configuration:"
    echo "  1. Go to Settings → Torrents in HomeFlix"
    echo "  2. Set Jackett URL: http://localhost:9117"
    echo "  3. Enter your API key from Jackett"
    echo "  4. Configure download path and preferences"
    echo "  5. Save settings"
    echo ""
fi

echo "🎬 Usage:"
echo "  • Browse any TMDB movie page"
echo "  • Click the red 'Download' button"
echo "  • Watch real-time progress"
echo "  • Movie automatically appears in your library!"
echo ""

print_status "HomeFlix Torrent System is ready to use!"
echo ""
echo "📚 For detailed instructions, see: COMPLETE_TORRENT_SETUP_GUIDE.md"
echo "🎯 For troubleshooting, see: TORRENT_SETUP.md"