#!/bin/bash

# HomeFlix Jackett Setup Script
# Sets up Jackett torrent indexer for HomeFlix download functionality

set -e

# Auto-fix permissions
find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true

echo "🎬 HomeFlix Jackett Setup"
echo "========================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Docker is available
check_docker() {
    log "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log "✅ Docker is available"
}

# Create necessary directories
create_directories() {
    log "Creating Jackett directories..."
    
    # Create Jackett config directory
    mkdir -p jackett-config
    chmod 755 jackett-config
    
    # Create downloads directory
    local downloads_dir="$HOME/Downloads/homeflix"
    mkdir -p "$downloads_dir"
    mkdir -p "$downloads_dir/Movies"
    mkdir -p "$downloads_dir/TV Shows"
    chmod 755 "$downloads_dir"
    chmod 755 "$downloads_dir/Movies"
    chmod 755 "$downloads_dir/TV Shows"
    
    # Create local downloads directory for Docker
    mkdir -p downloads
    chmod 755 downloads
    
    log "✅ Directories created"
    log "📁 Downloads will be saved to: $downloads_dir"
}

# Create Jackett Docker Compose configuration
create_jackett_config() {
    log "Creating Jackett configuration..."
    
    local downloads_dir="$HOME/Downloads/homeflix"
    local user_id=$(id -u)
    local group_id=$(id -g)
    local timezone=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "UTC")
    
    cat > docker-compose.jackett.yml << EOF
version: '3.8'

services:
  jackett:
    image: lscr.io/linuxserver/jackett:latest
    container_name: homeflix-jackett
    environment:
      - PUID=${user_id}
      - PGID=${group_id}
      - TZ=${timezone}
      - AUTO_UPDATE=true
    volumes:
      - ./jackett-config:/config
      - ${downloads_dir}:/downloads
      - ./downloads:/app/downloads
    ports:
      - "9117:9117"
    restart: unless-stopped
    networks:
      - homeflix-network

networks:
  homeflix-network:
    external: true
    name: homeflix-wifi_homeflix-network
EOF
    
    log "✅ Jackett configuration created"
}

# Start Jackett
start_jackett() {
    log "Starting Jackett container..."
    
    # Create network if it doesn't exist
    docker network create homeflix-wifi_homeflix-network 2>/dev/null || true
    
    # Start Jackett
    docker-compose -f docker-compose.jackett.yml up -d
    
    # Wait for Jackett to start
    log "Waiting for Jackett to start..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:9117 > /dev/null 2>&1; then
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    if [ $retries -eq 0 ]; then
        error "Jackett failed to start within 60 seconds"
        echo "Check logs with: docker logs homeflix-jackett"
        exit 1
    fi
    
    log "✅ Jackett is running"
}

# Configure popular indexers
setup_indexers() {
    log "Setting up popular indexers..."
    
    info "Jackett is now running at: http://localhost:9117"
    info "You need to manually add indexers for the best experience."
    echo ""
    echo "📋 Recommended indexers to add:"
    echo "   • 1337x - General purpose, high quality"
    echo "   • YTS - High-quality movie releases"
    echo "   • EZTV - TV shows specialist"
    echo "   • The Pirate Bay - Largest public tracker"
    echo "   • RARBG - Movies and TV shows"
    echo ""
    echo "🔧 To add indexers:"
    echo "   1. Open http://localhost:9117"
    echo "   2. Click 'Add indexer'"
    echo "   3. Search for the indexers above"
    echo "   4. Configure each one (most are automatic)"
    echo "   5. Test each indexer to ensure it works"
    echo ""
}

# Get Jackett API key
get_api_key() {
    log "Getting Jackett API key..."
    
    # Wait a bit more for Jackett to fully initialize
    sleep 5
    
    # Try to get API key from Jackett config
    local config_file="jackett-config/ServerConfig.json"
    if [ -f "$config_file" ]; then
        local api_key=$(grep -o '"APIKey":"[^"]*' "$config_file" 2>/dev/null | cut -d'"' -f4)
        if [ -n "$api_key" ]; then
            echo ""
            echo "🔑 Your Jackett API Key: $api_key"
            echo ""
            echo "📋 Copy this key and use it in HomeFlix Settings → Torrents"
            echo "   Jackett URL: http://localhost:9117"
            echo "   API Key: $api_key"
            echo ""
        else
            warn "Could not automatically retrieve API key"
            echo "Please get it manually from http://localhost:9117 (top-right corner)"
        fi
    else
        warn "Jackett config file not found yet"
        echo "Please get the API key manually from http://localhost:9117 (top-right corner)"
    fi
}

# Update HomeFlix configuration
update_homeflix_config() {
    log "Updating HomeFlix configuration..."
    
    # Update docker-compose.yml to include Jackett profile
    if [ -f "docker-compose.yml" ]; then
        if ! grep -q "torrent" docker-compose.yml; then
            log "Adding torrent profile to docker-compose.yml"
            # The docker-compose.yml should already have the jackett service
            # Just inform the user
            info "Jackett service is available in docker-compose.yml"
        fi
    fi
    
    # Update environment configuration
    if [ -f "config/.env" ]; then
        log "Updating environment configuration..."
        
        # Add Jackett configuration if not present
        if ! grep -q "JACKETT_URL" config/.env; then
            echo "" >> config/.env
            echo "# Jackett Configuration" >> config/.env
            echo "JACKETT_URL=http://localhost:9117" >> config/.env
            echo "# JACKETT_API_KEY=your_api_key_here" >> config/.env
        fi
    fi
    
    log "✅ HomeFlix configuration updated"
}

# Show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 Jackett Setup Complete!${NC}"
    echo "=========================="
    echo ""
    echo -e "${BLUE}🌐 Jackett Dashboard:${NC} http://localhost:9117"
    echo -e "${BLUE}📁 Downloads Directory:${NC} $HOME/Downloads/homeflix"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Open http://localhost:9117"
    echo "2. Copy the API key (top-right corner)"
    echo "3. Add indexers (1337x, YTS, EZTV, etc.)"
    echo "4. Go to HomeFlix Settings → Torrents"
    echo "5. Enter Jackett URL and API key"
    echo "6. Start downloading movies!"
    echo ""
    echo -e "${YELLOW}🔧 Useful Commands:${NC}"
    echo "• View Jackett logs: ${GREEN}docker logs homeflix-jackett${NC}"
    echo "• Restart Jackett: ${GREEN}docker restart homeflix-jackett${NC}"
    echo "• Stop Jackett: ${GREEN}docker-compose -f docker-compose.jackett.yml down${NC}"
    echo "• Start Jackett: ${GREEN}docker-compose -f docker-compose.jackett.yml up -d${NC}"
    echo ""
    echo -e "${RED}⚖️  Legal Notice:${NC} Only download content you legally own or that is in the public domain."
    echo ""
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        echo ""
        error "Jackett setup failed. Check the logs above for details."
        echo ""
        echo "For help:"
        echo "• Check Docker logs: docker logs homeflix-jackett"
        echo "• Verify Docker is running: docker info"
        echo "• Try running the setup again"
    fi
}

# Main setup process
main() {
    log "Starting Jackett setup for HomeFlix..."
    
    # Set trap for cleanup on exit
    trap cleanup EXIT
    
    # Run setup steps
    check_docker
    create_directories
    create_jackett_config
    start_jackett
    setup_indexers
    get_api_key
    update_homeflix_config
    show_completion
    
    log "🎬 Jackett setup completed successfully!"
}

# Run main function
main "$@"