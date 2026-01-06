#!/bin/bash

# HomeFlix Permissions Fix Script
# Automatically sets correct permissions for all files and directories

set -e

echo "🔧 HomeFlix Permissions Setup"
echo "============================="

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

# Fix script permissions
fix_script_permissions() {
    log "Setting executable permissions for all shell scripts..."
    
    # Find and fix all .sh files
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    # Specific important scripts
    local scripts=(
        "install.sh"
        "start.sh"
        "stop.sh"
        "restart.sh"
        "start-dev.sh"
        "stop-dev.sh"
        "restart-dev.sh"
        "setup.sh"
        "setup-jackett.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            chmod +x "$script"
            log "✅ Made $script executable"
        fi
    done
    
    # Fix setup-scripts directory
    if [ -d "setup-scripts" ]; then
        chmod +x setup-scripts/*.sh 2>/dev/null || true
        log "✅ Fixed setup-scripts permissions"
    fi
    
    # Fix test scripts
    chmod +x test_*.sh 2>/dev/null || true
    
    log "✅ All shell scripts are now executable"
}

# Fix directory permissions
fix_directory_permissions() {
    log "Setting correct directory permissions..."
    
    # Main directories
    local directories=(
        "config"
        "setup-data"
        "jackett-config"
        "downloads"
        "backend/thumbnails"
        "backend/posters"
        "backend/previews"
        "backend/subtitles"
        "backend/optimized"
        "backend/backdrops"
        "backend/logos"
        "backend/alac_audio"
        "thumbnails"
        "posters"
        "previews"
        "subtitles"
        "optimized"
    )
    
    for dir in "${directories[@]}"; do
        if [ -d "$dir" ]; then
            chmod 755 "$dir"
            log "✅ Set permissions for $dir"
        elif mkdir -p "$dir" 2>/dev/null; then
            chmod 755 "$dir"
            log "✅ Created and set permissions for $dir"
        fi
    done
    
    log "✅ Directory permissions configured"
}

# Fix file permissions
fix_file_permissions() {
    log "Setting correct file permissions..."
    
    # Database files
    if [ -f "backend/homeflix.db" ]; then
        chmod 644 backend/homeflix.db
        log "✅ Set database file permissions"
    fi
    
    # Configuration files
    find config -name "*.env" -type f -exec chmod 600 {} \; 2>/dev/null || true
    find config -name "*.json" -type f -exec chmod 644 {} \; 2>/dev/null || true
    
    # Log files
    chmod 644 *.log 2>/dev/null || true
    
    # PID files
    chmod 644 *.pid 2>/dev/null || true
    
    # Make sure Docker files are readable
    chmod 644 docker-compose.yml 2>/dev/null || true
    chmod 644 Dockerfile* 2>/dev/null || true
    chmod 644 */Dockerfile* 2>/dev/null || true
    
    log "✅ File permissions configured"
}

# Fix ownership (if needed and possible)
fix_ownership() {
    log "Checking ownership..."
    
    local current_user=$(whoami)
    local current_group=$(id -gn)
    
    # Only fix ownership if we're not root and files are owned by root
    if [ "$current_user" != "root" ]; then
        # Check if any critical files are owned by root
        local root_owned_files=$(find . -maxdepth 2 -name "*.sh" -o -name "*.db" -o -name "docker-compose.yml" | xargs ls -la 2>/dev/null | grep "^-.*root" | wc -l)
        
        if [ "$root_owned_files" -gt 0 ]; then
            warn "Some files are owned by root. You may need to run:"
            echo "  sudo chown -R $current_user:$current_group ."
            echo "  Or run this script with sudo to fix ownership"
        else
            log "✅ File ownership is correct"
        fi
    fi
}

# Set Docker-specific permissions
fix_docker_permissions() {
    log "Setting Docker-specific permissions..."
    
    # Ensure Docker socket access (if available)
    if [ -S "/var/run/docker.sock" ]; then
        if groups | grep -q docker; then
            log "✅ User is in docker group"
        else
            warn "User is not in docker group. Run: sudo usermod -aG docker $USER"
            warn "Then log out and back in"
        fi
    fi
    
    # Ensure Docker Compose files are readable
    chmod 644 docker-compose*.yml 2>/dev/null || true
    
    # Ensure Dockerfiles are readable
    find . -name "Dockerfile*" -type f -exec chmod 644 {} \; 2>/dev/null || true
    
    log "✅ Docker permissions configured"
}

# Create .gitignore for generated files
create_gitignore() {
    log "Creating/updating .gitignore for generated files..."
    
    cat >> .gitignore << 'EOF'

# HomeFlix Generated Files
*.log
*.pid
config/*.env
config/user.json
config/system.json
setup-data/
jackett-config/
downloads/
backend/homeflix_backup_*.db

# Docker volumes
redis-data/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
EOF
    
    log "✅ .gitignore updated"
}

# Verify permissions
verify_permissions() {
    log "Verifying permissions..."
    
    local issues=0
    
    # Check critical scripts
    local critical_scripts=("install.sh" "setup-scripts/install.sh" "setup-scripts/verify.sh")
    
    for script in "${critical_scripts[@]}"; do
        if [ -f "$script" ]; then
            if [ -x "$script" ]; then
                log "✅ $script is executable"
            else
                warn "❌ $script is not executable"
                issues=$((issues + 1))
            fi
        fi
    done
    
    # Check directory permissions
    local critical_dirs=("config" "backend/thumbnails" "backend/posters")
    
    for dir in "${critical_dirs[@]}"; do
        if [ -d "$dir" ]; then
            if [ -w "$dir" ]; then
                log "✅ $dir is writable"
            else
                warn "❌ $dir is not writable"
                issues=$((issues + 1))
            fi
        fi
    done
    
    if [ $issues -eq 0 ]; then
        log "🎉 All permissions are correctly set!"
        return 0
    else
        warn "⚠️  Found $issues permission issues"
        return 1
    fi
}

# Main function
main() {
    log "Starting comprehensive permissions setup..."
    
    fix_script_permissions
    fix_directory_permissions
    fix_file_permissions
    fix_ownership
    fix_docker_permissions
    create_gitignore
    
    echo ""
    if verify_permissions; then
        echo -e "${GREEN}🎉 Permissions setup completed successfully!${NC}"
        echo ""
        info "All files and directories now have correct permissions."
        info "You can now run the installation: ./install.sh"
    else
        echo -e "${YELLOW}⚠️  Permissions setup completed with warnings.${NC}"
        echo ""
        info "Some issues were found. Please review the warnings above."
        info "You may need to run some commands manually or with sudo."
    fi
    
    echo ""
}

# Run main function
main "$@"