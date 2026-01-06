#!/bin/bash

# HomeFlix Quick Setup Script
# One-command setup with automatic permissions and environment handling

set -e

echo "🎬 HomeFlix Quick Setup"
echo "======================"

# Auto-fix permissions immediately
find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true

# Create essential directories
mkdir -p config setup-data jackett-config downloads 2>/dev/null || true
mkdir -p backend/thumbnails backend/posters backend/previews backend/subtitles backend/optimized backend/backdrops backend/logos backend/alac_audio 2>/dev/null || true

# Set directory permissions
chmod 755 config setup-data jackett-config downloads 2>/dev/null || true
chmod 755 backend/thumbnails backend/posters backend/previews backend/subtitles backend/optimized backend/backdrops backend/logos backend/alac_audio 2>/dev/null || true

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found. Please install Docker first:"
        echo "   Ubuntu/Debian: sudo apt install docker.io docker-compose"
        echo "   macOS: Install Docker Desktop"
        echo "   Then run: sudo usermod -aG docker \$USER"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Docker daemon not running. Please start Docker first."
        exit 1
    fi
    
    log "✅ Docker is available"
}

# Migrate existing environment
migrate_environment() {
    if [ -f "backend/.env" ]; then
        log "Migrating existing environment configuration..."
        if [ -f "setup-scripts/migrate-env.sh" ]; then
            bash setup-scripts/migrate-env.sh
        else
            # Simple migration
            cp backend/.env config/backend.env 2>/dev/null || true
        fi
    fi
}

# Quick setup options
show_options() {
    echo ""
    echo "Choose setup method:"
    echo "1. 🚀 Quick Start (use existing config, start immediately)"
    echo "2. 🎯 Setup Wizard (full configuration wizard)"
    echo "3. 🔧 Development Mode (for developers)"
    echo ""
    read -p "Enter choice (1-3) [1]: " choice
    choice=${choice:-1}
    
    case $choice in
        1) quick_start ;;
        2) setup_wizard ;;
        3) dev_mode ;;
        *) echo "Invalid choice, using Quick Start"; quick_start ;;
    esac
}

# Quick start with existing configuration
quick_start() {
    log "🚀 Starting HomeFlix with existing configuration..."
    
    migrate_environment
    
    # Start production services
    log "Building and starting containers..."
    docker-compose build --parallel
    docker-compose --profile production up -d
    
    # Wait for services
    log "Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo ""
        echo -e "${GREEN}🎉 HomeFlix is now running!${NC}"
        echo ""
        echo "🌐 Access your platform:"
        echo "   Local:   http://localhost:3008"
        
        local_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "your-ip")
        echo "   Network: http://${local_ip}:3008"
        echo ""
        echo "⚙️  Settings: http://localhost:3008/settings"
        echo ""
    else
        warn "Some services may not have started correctly."
        echo "Check logs with: docker-compose logs"
    fi
}

# Full setup wizard
setup_wizard() {
    log "🎯 Starting setup wizard..."
    
    if [ -f "install.sh" ]; then
        ./install.sh
    else
        echo "❌ install.sh not found. Please ensure you have the complete HomeFlix package."
        exit 1
    fi
}

# Development mode
dev_mode() {
    log "🔧 Starting development mode..."
    
    # Ensure all scripts are executable
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    # Start development environment
    docker-compose -f docker-compose.dev.yml up --build -d
    
    log "✅ Development environment started!"
    echo "🌐 Open http://localhost:3009 in your browser"
}

# Setup Jackett for torrent search
setup_jackett() {
    if [ -f "setup-jackett.sh" ]; then
        log "🔍 Setting up Jackett for torrent search..."
        chmod +x setup-jackett.sh
        if ./setup-jackett.sh; then
            log "✅ Jackett setup completed successfully"
        else
            warn "⚠️ Jackett setup encountered some issues, but continuing..."
        fi
    else
        warn "⚠️ Jackett setup script not found. Skipping Jackett setup."
    fi
}

# Main function
main() {
    log "Initializing HomeFlix setup..."
    
    # Run auto-permissions
    if [ -f "setup-scripts/auto-permissions.sh" ]; then
        bash setup-scripts/auto-permissions.sh
    fi
    
    check_docker
    
    # Run Jackett setup before showing options
    setup_jackett
    
    show_options
}

# Run main function
main "$@"