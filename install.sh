#!/bin/bash

# HomeFlix Complete Installation Script
# This script sets up HomeFlix with Docker and a user-friendly setup wizard

set -e

# Auto-fix permissions first (before anything else)
if [ -f "setup-scripts/auto-permissions.sh" ]; then
    bash setup-scripts/auto-permissions.sh 2>/dev/null || true
else
    # Minimal fallback
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
fi

echo "🎬 HomeFlix - Complete Installation"
echo "=================================="
echo "Transform your media collection into a professional streaming platform!"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
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

success() {
    echo -e "${GREEN}✅${NC} $1"
}

# Show welcome message
show_welcome() {
    echo -e "${PURPLE}"
    cat << "EOF"
    ██╗  ██╗ ██████╗ ███╗   ███╗███████╗███████╗██╗     ██╗██╗  ██╗
    ██║  ██║██╔═══██╗████╗ ████║██╔════╝██╔════╝██║     ██║╚██╗██╔╝
    ███████║██║   ██║██╔████╔██║█████╗  █████╗  ██║     ██║ ╚███╔╝ 
    ██╔══██║██║   ██║██║╚██╔╝██║██╔══╝  ██╔══╝  ██║     ██║ ██╔██╗ 
    ██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗██║     ███████╗██║██╔╝ ██╗
    ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝     ╚══════╝╚═╝╚═╝  ╚═╝
EOF
    echo -e "${NC}"
    echo "                    Professional Streaming Platform"
    echo ""
    echo -e "${CYAN}Features:${NC}"
    echo "  🎬 Netflix-style interface with advanced widget system"
    echo "  📱 Mobile responsive design"
    echo "  🔍 TMDB integration for movie metadata"
    echo "  📝 Professional subtitle management"
    echo "  ⬇️  One-click torrent downloads"
    echo "  🎨 Customizable dashboard widgets"
    echo "  🌐 Multi-device streaming"
    echo ""
}

# Check if running as root
check_user() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons."
        echo "Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        missing_deps+=("docker-compose")
    fi
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        echo ""
        echo "Ubuntu/Debian:"
        echo "  sudo apt update"
        echo "  sudo apt install docker.io docker-compose curl git"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "CentOS/RHEL:"
        echo "  sudo yum install docker docker-compose curl git"
        echo "  sudo systemctl start docker"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "macOS:"
        echo "  Install Docker Desktop from https://docker.com"
        echo "  brew install curl git"
        echo ""
        echo "After installation, log out and back in, then run this script again."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running."
        echo "Please start Docker:"
        echo "  sudo systemctl start docker    # Linux"
        echo "  # Or start Docker Desktop      # macOS/Windows"
        exit 1
    fi
    
    # Check Docker permissions
    if ! docker ps &> /dev/null; then
        error "Cannot access Docker. Please add your user to the docker group:"
        echo "  sudo usermod -aG docker \$USER"
        echo "Then log out and back in, and run this script again."
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df . | tail -1 | awk '{print $4}')
    required_space=10485760  # 10GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        warn "Low disk space detected."
        echo "Available: $(($available_space / 1024 / 1024))GB"
        echo "Recommended: 10GB+"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    success "System requirements check passed"
}

# Get installation directory
get_install_dir() {
    echo ""
    echo -e "${CYAN}Installation Directory${NC}"
    echo "Choose where to install HomeFlix:"
    echo ""
    
    local default_dir="$HOME/homeflix"
    read -p "Installation directory [$default_dir]: " install_dir
    install_dir=${install_dir:-$default_dir}
    
    # Expand tilde
    install_dir="${install_dir/#\~/$HOME}"
    
    echo "Installing to: $install_dir"
    
    if [ -d "$install_dir" ]; then
        warn "Directory already exists: $install_dir"
        echo "Contents:"
        ls -la "$install_dir" 2>/dev/null || echo "  (empty or inaccessible)"
        echo ""
        read -p "Continue and overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation cancelled."
            exit 1
        fi
    fi
    
    # Create directory
    mkdir -p "$install_dir"
    cd "$install_dir"
    
    success "Installation directory: $install_dir"
}

# Download HomeFlix
download_homeflix() {
    log "Downloading HomeFlix..."
    
    # If we're already in a git repo, skip download
    if [ -d ".git" ]; then
        log "Already in HomeFlix directory, updating..."
        git pull origin main || warn "Could not update repository"
    else
        # Clone or download the repository
        if command -v git &> /dev/null; then
            log "Cloning HomeFlix repository..."
            git clone https://github.com/your-username/homeflix.git . || {
                error "Failed to clone repository"
                echo "Falling back to manual setup..."
                return 1
            }
        else
            error "Git not available and no existing installation found"
            return 1
        fi
    fi
    
    success "HomeFlix downloaded successfully"
}

# Setup directory structure
setup_directories() {
    log "Setting up directory structure..."
    
    # Create necessary directories
    mkdir -p config
    mkdir -p setup-data
    mkdir -p jackett-config
    mkdir -p downloads
    
    # Create backend asset directories
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
    
    # Initialize database if it doesn't exist
    if [ ! -f "backend/homeflix.db" ]; then
        log "Creating database file..."
        touch backend/homeflix.db
        chmod 644 backend/homeflix.db
    else
        log "Using existing database"
        # Create backup
        backup_file="backend/homeflix_backup_$(date +%Y%m%d_%H%M%S).db"
        cp backend/homeflix.db "$backup_file"
        log "Database backup created: $backup_file"
    fi
    
    success "Directory structure created"
}

# Make scripts executable
setup_scripts() {
    log "Setting up scripts and permissions..."
    
    # Make all shell scripts executable
    find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    # Make setup scripts executable
    if [ -d "setup-scripts" ]; then
        chmod +x setup-scripts/*.sh 2>/dev/null || true
    fi
    
    # Make main scripts executable
    chmod +x install.sh 2>/dev/null || true
    chmod +x start.sh 2>/dev/null || true
    chmod +x stop.sh 2>/dev/null || true
    chmod +x restart.sh 2>/dev/null || true
    
    # Make development scripts executable
    chmod +x start-dev.sh 2>/dev/null || true
    chmod +x stop-dev.sh 2>/dev/null || true
    chmod +x restart-dev.sh 2>/dev/null || true
    
    # Make test scripts executable
    chmod +x test_*.sh 2>/dev/null || true
    
    success "Scripts and permissions configured"
}

# Start installation
start_installation() {
    log "Starting HomeFlix installation..."
    
    # Run the installation script
    if [ -f "setup-scripts/install.sh" ]; then
        ./setup-scripts/install.sh
    else
        error "Installation script not found"
        return 1
    fi
}

# Show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 HomeFlix Installation Started Successfully!${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "1. Open your web browser"
    echo "2. Go to: ${BLUE}http://localhost:3009${NC}"
    echo "3. Follow the setup wizard to complete installation"
    echo ""
    echo -e "${CYAN}After Setup:${NC}"
    echo "• Access HomeFlix at: ${BLUE}http://localhost:3008${NC}"
    echo "• Settings panel: ${BLUE}http://localhost:3008/settings${NC}"
    echo ""
    
    local local_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "your-ip")
    echo -e "${CYAN}Network Access:${NC}"
    echo "• From other devices: ${BLUE}http://${local_ip}:3008${NC}"
    echo ""
    
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "• View logs: ${YELLOW}docker-compose logs -f${NC}"
    echo "• Stop services: ${YELLOW}docker-compose down${NC}"
    echo "• Start services: ${YELLOW}docker-compose --profile production up -d${NC}"
    echo "• Verify installation: ${YELLOW}./setup-scripts/verify.sh${NC}"
    echo ""
    
    echo -e "${PURPLE}Enjoy your personal Netflix experience! 🍿${NC}"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        echo ""
        error "Installation failed. Check the logs above for details."
        echo ""
        echo "For help:"
        echo "• Check Docker logs: docker-compose logs"
        echo "• Verify system requirements"
        echo "• Try running the installation again"
    fi
}

# Main installation process
main() {
    # Set trap for cleanup on exit
    trap cleanup EXIT
    
    show_welcome
    check_user
    check_requirements
    get_install_dir
    
    # Fix permissions first thing
    if [ -f "setup-scripts/auto-permissions.sh" ]; then
        bash setup-scripts/auto-permissions.sh
    else
        # Fallback permission setup
        find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
        mkdir -p config setup-data jackett-config downloads 2>/dev/null || true
    fi
    
    # If we don't have the files, try to download them
    if [ ! -f "docker-compose.yml" ]; then
        download_homeflix || {
            error "Could not download HomeFlix. Please clone the repository manually:"
            echo "  git clone https://github.com/your-username/homeflix.git"
            echo "  cd homeflix"
            echo "  ./install.sh"
            exit 1
        }
    fi
    
    setup_directories
    
    # Fix all permissions automatically
    if [ -f "setup-scripts/auto-permissions.sh" ]; then
        bash setup-scripts/auto-permissions.sh
    else
        # Fallback permission setup
        setup_scripts
    fi
    
    # Migrate existing environment if available
    if [ -f "setup-scripts/migrate-env.sh" ]; then
        log "Migrating existing environment configuration..."
        ./setup-scripts/migrate-env.sh || warn "Environment migration completed with warnings"
    fi
    
    start_installation
    show_completion
}

# Run main function
main "$@"