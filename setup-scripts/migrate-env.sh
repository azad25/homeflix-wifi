#!/bin/bash

# HomeFlix Environment Migration Script
# Migrates existing .env files to the new Docker setup structure

set -e

echo "🔄 HomeFlix Environment Migration"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Create config directory if it doesn't exist
mkdir -p config

# Migrate backend .env
migrate_backend_env() {
    log "Migrating backend environment configuration..."
    
    if [ -f "backend/.env" ]; then
        log "Found existing backend .env file"
        
        # Read existing values
        MEDIA_PATH=$(grep "^MEDIA_PATH=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "/media/azad/Movies1")
        DATABASE_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "./homeflix.db")
        PORT=$(grep "^PORT=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "8252")
        REDIS_URL=$(grep "^REDIS_URL=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "redis://localhost:6379/0")
        TMDB_API_KEY=$(grep "^TMDB_API_KEY=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        OPENSUB_API_KEY=$(grep "^OPENSUB_API_KEY=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        OPENSUB_USERNAME=$(grep "^OPENSUB_USERNAME=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        OPENSUB_PASSWORD=$(grep "^OPENSUB_PASSWORD=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        YOUTUBE_API_KEY=$(grep "^YOUTUBE_API_KEY=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        GOOGLE_CLIENT_ID=$(grep "^GOOGLE_CLIENT_ID=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        GOOGLE_CLIENT_SECRET=$(grep "^GOOGLE_CLIENT_SECRET=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "")
        HW_ACCEL=$(grep "^HW_ACCEL=" backend/.env | cut -d'=' -f2- | tr -d '"' || echo "none")
        
        # Create new backend.env
        cat > config/backend.env << EOF
# HomeFlix Backend Configuration
# Migrated from existing .env file

# Database Configuration
DATABASE_URL=/app/homeflix.db

# Server Configuration
PORT=8252
GIN_MODE=release

# Media Library Configuration
MEDIA_PATH=/media/movies
THUMBNAIL_PATH=/app/thumbnails

# Performance Configuration
HW_ACCEL=${HW_ACCEL}
CACHE_SIZE=1024
CACHE_ENABLED=true
CHUNK_SIZE=1048576
LOG_LEVEL=info

# Redis Configuration
REDIS_URL=redis://homeflix-redis:6379/0

# API Keys
$([ -n "$TMDB_API_KEY" ] && echo "TMDB_API_KEY=$TMDB_API_KEY" || echo "# TMDB_API_KEY=your_tmdb_api_key_here")
$([ -n "$OPENSUB_API_KEY" ] && echo "OPENSUB_API_KEY=$OPENSUB_API_KEY" || echo "# OPENSUB_API_KEY=your_opensubtitles_api_key")
$([ -n "$OPENSUB_USERNAME" ] && echo "OPENSUB_USERNAME=$OPENSUB_USERNAME" || echo "# OPENSUB_USERNAME=your_username")
$([ -n "$OPENSUB_PASSWORD" ] && echo "OPENSUB_PASSWORD=$OPENSUB_PASSWORD" || echo "# OPENSUB_PASSWORD=your_password")
$([ -n "$YOUTUBE_API_KEY" ] && echo "YOUTUBE_API_KEY=$YOUTUBE_API_KEY" || echo "# YOUTUBE_API_KEY=your_youtube_api_key")

# Google OAuth
$([ -n "$GOOGLE_CLIENT_ID" ] && echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" || echo "# GOOGLE_CLIENT_ID=your_google_client_id")
$([ -n "$GOOGLE_CLIENT_SECRET" ] && echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" || echo "# GOOGLE_CLIENT_SECRET=your_google_client_secret")

# Torrent Configuration
# JACKETT_URL=http://homeflix-jackett:9117
# JACKETT_API_KEY=your_jackett_api_key

# Optional: Additional API Keys
# GEMINI_API_KEY=your_gemini_api_key
# NEWS_API_KEY=your_news_api_key
EOF
        
        log "✅ Backend environment migrated to config/backend.env"
        
        # Create Docker Compose .env
        cat > config/.env << EOF
# HomeFlix Docker Configuration
# Migrated from existing configuration

# Media Paths
MEDIA_PATH=${MEDIA_PATH}
DOWNLOADS_PATH=/downloads/homeflix

# API Keys
$([ -n "$TMDB_API_KEY" ] && echo "TMDB_API_KEY=$TMDB_API_KEY" || echo "# TMDB_API_KEY=")
$([ -n "$OPENSUB_API_KEY" ] && echo "OPENSUB_API_KEY=$OPENSUB_API_KEY" || echo "# OPENSUB_API_KEY=")
$([ -n "$OPENSUB_USERNAME" ] && echo "OPENSUB_USERNAME=$OPENSUB_USERNAME" || echo "# OPENSUB_USERNAME=")
$([ -n "$OPENSUB_PASSWORD" ] && echo "OPENSUB_PASSWORD=$OPENSUB_PASSWORD" || echo "# OPENSUB_PASSWORD=")
$([ -n "$YOUTUBE_API_KEY" ] && echo "YOUTUBE_API_KEY=$YOUTUBE_API_KEY" || echo "# YOUTUBE_API_KEY=")

# System Configuration
HW_ACCEL=${HW_ACCEL}
# JACKETT_URL=
# JACKETT_API_KEY=
EOF
        
        log "✅ Docker Compose environment created at config/.env"
        
    else
        warn "No existing backend .env file found"
        return 1
    fi
}

# Create frontend environment
create_frontend_env() {
    log "Creating frontend environment configuration..."
    
    cat > config/frontend.env << 'EOF'
# HomeFlix Frontend Configuration

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8252

# Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Network Configuration
PORT=3008
HOSTNAME=0.0.0.0
EOF
    
    log "✅ Frontend environment created at config/frontend.env"
}

# Show migration summary
show_summary() {
    echo ""
    echo "🎉 Environment Migration Complete!"
    echo "================================="
    echo ""
    info "Created configuration files:"
    echo "  📁 config/backend.env    - Backend environment variables"
    echo "  📁 config/frontend.env   - Frontend environment variables"  
    echo "  📁 config/.env           - Docker Compose environment"
    echo ""
    info "Original files preserved:"
    echo "  📁 backend/.env          - Original backend configuration"
    echo ""
    info "Next steps:"
    echo "  1. Review the migrated configuration files"
    echo "  2. Run the setup wizard: ./install.sh"
    echo "  3. Or start services directly: docker-compose --profile production up -d"
    echo ""
}

# Main migration process
main() {
    log "Starting environment migration..."
    
    # Run migration steps
    if migrate_backend_env; then
        create_frontend_env
        show_summary
    else
        warn "Migration completed with warnings. Please check the configuration files."
    fi
}

# Run main function
main "$@"