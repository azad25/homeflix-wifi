# HomeFlix Installation Guide

Transform your media collection into a professional streaming platform with this comprehensive installation system!

## 🚀 Quick Start (Recommended)

### One-Command Installation

```bash
# Quick start (automatically handles permissions)
./quick-start.sh
```

Or with full setup wizard:

```bash
./install.sh
```

Or download and run:

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/homeflix/main/install.sh | bash
```

**✨ All permissions are automatically configured!** No manual chmod commands needed.

This will:
1. ✅ **Auto-fix all script permissions**
2. ✅ Check system requirements
3. 📁 Set up directory structure  
4. 🐳 Build Docker containers
5. 🌐 Start the setup wizard at `http://localhost:3009`

## 📋 System Requirements

### Required Dependencies
- **Docker** 20.10+ with Docker Compose
- **curl** for downloads
- **git** for repository management
- **10GB+ free disk space** (recommended)

### Supported Systems
- ✅ Ubuntu 20.04+ / Debian 11+
- ✅ CentOS 8+ / RHEL 8+
- ✅ macOS 11+ (with Docker Desktop)
- ✅ Windows 10+ (with WSL2 + Docker Desktop)

### Hardware Requirements
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 10GB+ free space
- **Network**: Internet connection for setup and metadata

## 🛠 Manual Installation

### 1. Install Dependencies

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install docker.io docker-compose curl git
sudo usermod -aG docker $USER
```

#### CentOS/RHEL
```bash
sudo yum install docker docker-compose curl git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

#### macOS
```bash
# Install Docker Desktop from https://docker.com
brew install curl git
```

**Important**: After installing Docker, log out and back in to apply group changes.

### 2. Clone Repository
```bash
git clone https://github.com/your-username/homeflix.git
cd homeflix
```

### 3. Run Installation
```bash
# All permissions are automatically handled
./install.sh
```

**No need to manually set permissions** - the installation script automatically:
- Makes all shell scripts executable
- Sets correct directory permissions
- Configures file permissions for security
- Creates necessary directories

## 🎯 Setup Wizard

After installation, open your browser to `http://localhost:3009` to complete setup:

### Step 1: Welcome
- Overview of HomeFlix features
- System requirements verification

### Step 2: User Information
- **Name & Email**: For personalization
- **Timezone**: For proper scheduling
- **Language**: Interface language

### Step 3: Media Storage
- **Primary Media Path**: Main movie/TV directory
- **Downloads Path**: For torrent downloads
- **Additional Paths**: Extra media locations

### Step 4: API Configuration (Optional)
- **TMDB API**: Movie metadata and posters
- **OpenSubtitles**: Automatic subtitle downloads  
- **YouTube API**: Enhanced trailer support

### Step 5: System Settings
- **Features**: Enable Redis, torrents, subtitles
- **Performance**: Hardware acceleration, cache size
- **Concurrency**: Scan and processing limits

### Step 6: Installation
- Builds and configures Docker containers
- Initializes database and services
- Verifies installation

### Step 7: Media Scanning
- Scans configured media paths
- Generates thumbnails and metadata
- Real-time progress monitoring

## 🎬 Post-Installation

### Access Your Platform
- **HomeFlix**: http://localhost:3008
- **Settings**: http://localhost:3008/settings
- **Network Access**: http://YOUR_IP:3008

### Useful Commands

#### Service Management
```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Start production services
docker-compose --profile production up -d

# Start with torrents
docker-compose --profile production --profile torrent up -d
```

#### Maintenance
```bash
# Verify installation
./setup-scripts/verify.sh

# Update containers
docker-compose pull
docker-compose --profile production up -d

# Backup database
cp backend/homeflix.db backend/homeflix_backup_$(date +%Y%m%d).db
```

#### Troubleshooting
```bash
# Check container status
docker-compose ps

# View specific service logs
docker-compose logs homeflix-backend
docker-compose logs homeflix-frontend

# Restart specific service
docker-compose restart homeflix-backend

# Check system resources
docker stats
```

## 📁 Directory Structure

```
homeflix/
├── backend/                 # Go API server
│   ├── homeflix.db         # SQLite database
│   ├── thumbnails/         # Generated thumbnails
│   ├── posters/           # Movie posters
│   ├── previews/          # Preview clips
│   ├── subtitles/         # Subtitle files
│   └── optimized/         # Transcoded media
├── frontend/               # Next.js web interface
├── config/                # Configuration files
│   ├── .env              # Environment variables
│   ├── user.json         # User settings
│   └── system.json       # System configuration
├── setup-ui/              # Installation wizard
├── jackett-config/        # Torrent indexer config
├── downloads/             # Torrent downloads
└── docker-compose.yml     # Container orchestration
```

## 🔧 Configuration

### Environment Variables
The setup wizard creates a `.env` file with your configuration:

```bash
# Database
DATABASE_URL=/app/homeflix.db

# Media Paths  
MEDIA_PATH=/your/media/path
DOWNLOADS_PATH=/your/downloads/path

# API Keys
TMDB_API_KEY=your_tmdb_key
OPENSUB_API_KEY=your_opensubtitles_key
YOUTUBE_API_KEY=your_youtube_key

# Performance
HW_ACCEL=none
CACHE_SIZE=1024
MAX_CONCURRENT_SCANS=4

# Services
REDIS_URL=redis://homeflix-redis:6379/0
JACKETT_URL=http://homeflix-jackett:9117
```

### Media Path Requirements
- Use **absolute paths** (starting with `/`)
- Ensure **read permissions** for Docker
- **Network paths** should be mounted locally first
- **Symbolic links** are supported

### API Key Setup

#### TMDB (Recommended)
1. Register at [themoviedb.org](https://www.themoviedb.org)
2. Go to Settings → API
3. Request API key (free)
4. Enter in setup wizard

#### OpenSubtitles (Optional)
1. Register at [opensubtitles.com](https://www.opensubtitles.com)
2. Get API key from developer section
3. Enter credentials in setup wizard

#### YouTube Data API (Optional)
1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create project and enable YouTube Data API v3
3. Create API key
4. Enter in setup wizard

## 🌐 Network Configuration

### Local Access
- Frontend: `http://localhost:3008`
- Backend API: `http://localhost:8252`
- Setup Wizard: `http://localhost:3009`

### Network Access
Find your local IP:
```bash
hostname -I | awk '{print $1}'
```

Access from other devices:
- `http://YOUR_IP:3008`

### Firewall Configuration
Open these ports if needed:
```bash
# Ubuntu/Debian
sudo ufw allow 3008
sudo ufw allow 8252

# CentOS/RHEL  
sudo firewall-cmd --add-port=3008/tcp --permanent
sudo firewall-cmd --add-port=8252/tcp --permanent
sudo firewall-cmd --reload
```

## 🔒 Security Considerations

### Docker Security
- Containers run as non-root users
- No privileged access required
- Network isolation between services

### Data Protection
- Database and media stay on your local system
- No data sent to external services (except API calls)
- All processing happens locally

### Network Security
- Services only bind to necessary ports
- No external access by default
- Use VPN for remote access if needed

## 🚨 Troubleshooting

### Common Issues

#### Docker Permission Denied
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

#### Port Already in Use
```bash
# Check what's using the port
sudo netstat -tlnp | grep :3008
# Or stop the conflicting service
```

#### Low Disk Space
```bash
# Clean Docker system
docker system prune -a

# Check disk usage
df -h
du -sh homeflix/
```

#### Database Issues
```bash
# Check database file
ls -la backend/homeflix.db

# Restore from backup
cp backend/homeflix_backup_*.db backend/homeflix.db
```

### Getting Help

1. **Check logs**: `docker-compose logs -f`
2. **Verify installation**: `./setup-scripts/verify.sh`
3. **Check system resources**: `docker stats`
4. **Review configuration**: Check `config/.env`

### Reset Installation
```bash
# Stop all services
docker-compose down

# Remove containers and volumes
docker-compose down -v
docker system prune -a

# Start fresh installation
./install.sh
```

## 🎉 Success!

Once installation is complete, you'll have:

✅ **Professional streaming platform** with Netflix-style interface  
✅ **Automatic media scanning** and organization  
✅ **TMDB integration** for metadata and posters  
✅ **Subtitle management** with OpenSubtitles  
✅ **Torrent downloads** with one-click integration  
✅ **Multi-device access** across your network  
✅ **Advanced widget system** for customization  

**Enjoy your personal Netflix experience! 🍿🎬**

---

## 📚 Additional Resources

- [Complete Setup Guide](README.md)
- [Torrent Configuration](documentation/COMPLETE_TORRENT_SETUP_GUIDE.md)
- [Subtitle Setup](documentation/OPENSUBTITLES_SETUP_GUIDE.md)
- [Widget System](WIDGET_REDESIGN_SUMMARY.md)
- [Performance Optimization](WIDGET_PERFORMANCE_OPTIMIZATIONS.md)