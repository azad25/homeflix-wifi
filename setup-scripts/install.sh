#!/bin/bash

# HomeFlix Installation Script
set -e

# Auto-fix permissions first
if [ -f "setup-scripts/auto-permissions.sh" ]; then
    bash setup-scripts/auto-permissions.sh 2>/dev/null || true
else
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
fi

echo "🎬 HomeFlix Installation Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root for security reasons"
   exit 1
fi

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        echo "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    # Check available disk space (minimum 5GB)
    available_space=$(df . | tail -1 | awk '{print $4}')
    required_space=5242880  # 5GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        warn "Low disk space detected. HomeFlix requires at least 5GB of free space."
        echo "Available: $(($available_space / 1024 / 1024))GB"
        echo "Required: 5GB"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log "✅ System requirements check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    # Create data directories
    mkdir -p config
    mkdir -p setup-data
    mkdir -p jackett-config
    mkdir -p downloads
    
    # Create backend asset directories (will be mounted as volumes)
    mkdir -p backend/thumbnails
    mkdir -p backend/posters
    mkdir -p backend/previews
    mkdir -p backend/subtitles
    mkdir -p backend/optimized
    mkdir -p backend/backdrops
    mkdir -p backend/logos
    mkdir -p backend/alac_audio
    
    # Set permissions
    chmod 755 config setup-data jackett-config downloads
    chmod 755 backend/thumbnails backend/posters backend/previews backend/subtitles backend/optimized backend/backdrops backend/logos backend/alac_audio
    
    # Make all shell scripts executable
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    log "✅ Directories created successfully"
}

# Initialize database if it doesn't exist
initialize_database() {
    log "Initializing database and environment..."
    
    # Create backend .env from existing .env if it exists
    if [ -f "backend/.env" ] && [ ! -f "config/backend.env" ]; then
        log "Copying existing backend .env configuration..."
        cp backend/.env config/backend.env
    elif [ ! -f "config/backend.env" ]; then
        log "Creating default backend environment configuration..."
        cat > config/backend.env << 'EOF'
# HomeFlix Backend Configuration
# Default configuration - will be updated by setup wizard

# Database Configuration
DATABASE_URL=/app/homeflix.db

# Server Configuration
PORT=8252
GIN_MODE=release

# Media Library Configuration
MEDIA_PATH=/media/movies
THUMBNAIL_PATH=/app/thumbnails

# Performance Configuration
HW_ACCEL=none
CACHE_SIZE=1024
CACHE_ENABLED=true
CHUNK_SIZE=1048576
LOG_LEVEL=info

# Redis Configuration
REDIS_URL=redis://homeflix-redis:6379/0

# API Keys (will be configured in setup wizard)
# TMDB_API_KEY=your_tmdb_api_key_here
# OPENSUB_API_KEY=your_opensubtitles_api_key
# OPENSUB_USERNAME=your_username
# OPENSUB_PASSWORD=your_password
# YOUTUBE_API_KEY=your_youtube_api_key

# Torrent Configuration
# JACKETT_URL=http://homeflix-jackett:9117
# JACKETT_API_KEY=your_jackett_api_key

# Optional: Additional API Keys
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# GEMINI_API_KEY=your_gemini_api_key
# NEWS_API_KEY=your_news_api_key
EOF
    fi
    
    # Create frontend .env
    if [ ! -f "config/frontend.env" ]; then
        log "Creating frontend environment configuration..."
        cat > config/frontend.env << 'EOF'
# HomeFlix Frontend Configuration
# Default configuration - will be updated by setup wizard

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8252

# Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Network Configuration
PORT=3008
HOSTNAME=0.0.0.0
EOF
    fi
    
    # Create main .env for docker-compose
    if [ ! -f "config/.env" ]; then
        log "Creating Docker Compose environment configuration..."
        cat > config/.env << 'EOF'
# HomeFlix Docker Configuration
# Default configuration - will be updated by setup wizard

# Media Paths
MEDIA_PATH=/media/azad/Movies1
DOWNLOADS_PATH=/downloads/homeflix

# API Keys (configure in setup wizard)
# TMDB_API_KEY=
# OPENSUB_API_KEY=
# OPENSUB_USERNAME=
# OPENSUB_PASSWORD=
# YOUTUBE_API_KEY=

# System Configuration
HW_ACCEL=none
# JACKETT_URL=
# JACKETT_API_KEY=
EOF
    fi
    
    # Initialize database file
    if [ ! -f "backend/homeflix.db" ]; then
        log "Creating new database file..."
        touch backend/homeflix.db
        chmod 644 backend/homeflix.db
    else
        log "Using existing database file"
        
        # Create backup of existing database
        backup_file="backend/homeflix_backup_$(date +%Y%m%d_%H%M%S).db"
        cp backend/homeflix.db "$backup_file"
        log "Database backup created: $backup_file"
    fi
    
    log "✅ Database and environment initialized"
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Build setup image
    log "Building setup container..."
    docker build -f Dockerfile.setup -t homeflix-setup:latest .
    
    # Build production images
    log "Building backend container..."
    docker build -f backend/Dockerfile.production -t homeflix-backend:latest backend/
    
    log "Building frontend container..."
    docker build -f frontend/Dockerfile.production -t homeflix-frontend:latest frontend/
    
    log "✅ Docker images built successfully"
}

# Start setup wizard
start_setup() {
    log "Starting HomeFlix setup wizard..."
    
    # Start setup container
    docker-compose --profile setup up -d homeflix-setup
    
    # Wait for setup to be ready
    log "Waiting for setup wizard to start..."
    sleep 5
    
    # Check if setup is running
    if docker-compose ps homeflix-setup | grep -q "Up"; then
        log "✅ Setup wizard is running!"
        echo ""
        echo "🌐 Open your browser and go to:"
        echo "   ${BLUE}http://localhost:3009${NC}"
        echo ""
        echo "📱 Or from another device on your network:"
        LOCAL_IP=$(hostname -I | awk '{print $1}')
        echo "   ${BLUE}http://${LOCAL_IP}:3009${NC}"
        echo ""
        echo "Follow the setup wizard to complete the installation."
        echo ""
        echo "Once setup is complete, you can access HomeFlix at:"
        echo "   ${BLUE}http://localhost:3008${NC}"
        echo ""
    else
        error "Failed to start setup wizard"
        docker-compose logs homeflix-setup
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    # Add any cleanup tasks here
}

# Main installation process
main() {
    log "Starting HomeFlix installation..."
    
    # Set trap for cleanup on exit
    trap cleanup EXIT
    
    # Run installation steps
    check_requirements
    create_directories
    
    # Fix permissions automatically
    if [ -f "setup-scripts/auto-permissions.sh" ]; then
        bash setup-scripts/auto-permissions.sh
    else
        # Fallback: make all shell scripts executable
        find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    initialize_database
    build_images
    start_setup
    
    log "🎉 HomeFlix installation started successfully!"
    log "Please complete the setup using the web interface."
}

# Run main function
main "$@"