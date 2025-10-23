# HomeFlix - Personal Netflix Clone

Transform your media collection into a professional streaming platform! HomeFlix is a full-featured Netflix clone that automatically organizes and streams your movies and TV shows with a beautiful, responsive interface.

![HomeFlix Preview](/preview.png)
![HomeFlix Interface](/preview-2.png)
![HomeFlix Interface](/preview-3.png)
![HomeFlix Interface](/preview-4.png)
![HomeFlix Interface](/preview-5.png)
![HomeFlix Interface](/preview-6.png)


## ✨ Key Features

### 🎬 **Smart Media Management**
- **Automatic Scanning**: Detects and organizes movies/TV shows from your drives
- **Intelligent Metadata**: Auto-fetches movie info, posters, and descriptions from TMDB
- **Genre Classification**: Automatically categorizes content by genre
- **Series Organization**: Groups TV episodes by seasons and series

### 🎨 **Netflix-Style Interface**
- **Hero Sections**: Dynamic featured content with trailers
- **Smooth Carousels**: Browse content with Netflix-style scrolling
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Dark Theme**: Beautiful dark interface optimized for viewing

### 🎥 **Advanced Streaming**
- **High-Quality Playback**: Supports 4K, 1080p, and adaptive streaming
- **Multiple Formats**: Plays MP4, MKV, AVI, and more
- **ALAC Audio**: High-quality lossless audio support
- **Auto-Transcoding**: Converts incompatible formats on-the-fly
- **Preview Clips**: Hover previews like Netflix

### 🔍 **Discovery & Navigation**
- **Advanced Search**: Find content by title, actor, director, genre
- **Smart Recommendations**: AI-powered content suggestions
- **Continue Watching**: Resume where you left off
- **My List**: Personal watchlist management
- **Recently Added**: See your newest content first

### 📱 **Pages & Sections**
- **Home**: Featured content and personalized recommendations
- **Movies**: Browse your entire movie collection
- **TV Shows**: Organized series with season/episode navigation
- **My List**: Your personal watchlist
- **Search**: Advanced search with filters
- **Now Playing**: Live TV-style channel with previews
- **New & Popular**: Latest additions and trending content

### 🎭 **Media Assets**
- **Auto Thumbnails**: Generated from video content
- **Movie Posters**: Downloaded from TMDB database
- **Preview Videos**: Short clips for quick browsing
- **Subtitle Support**: Multi-language subtitle files

### 📊 **Analytics & Tracking**
- **Watch History**: Track viewing progress and history
- **Playback Resume**: Continue from where you stopped
- **View Statistics**: See your watching patterns
- **Recommendation Engine**: Learns from your preferences

## 🚀 Quick Installation

### One-Command Setup
```bash
# Clone and setup everything
git clone <repository-url>
cd homeflix
chmod +x setup.sh start.sh
./setup.sh
```

### Manual Installation

#### Prerequisites
- **Go 1.21+** - [Download here](https://golang.org/dl/)
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **FFmpeg** - For video processing
- **Redis** - For caching (optional but recommended)

#### System Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install golang-go nodejs npm ffmpeg redis-server

# macOS (with Homebrew)
brew install go node ffmpeg redis

# Arch Linux
sudo pacman -S go nodejs npm ffmpeg redis
```

#### Project Setup
```bash
# 1. Install backend dependencies
cd backend
go mod tidy

# 2. Install frontend dependencies
cd ../frontend
npm install

# 3. Create required directories
mkdir -p thumbnails posters previews subtitles optimized
```

## 🎯 Getting Started

### 1. Add Your Media
Place your movies and TV shows in `/media/azad/Movies1` (or update the path in the configuration)

### 2. Start HomeFlix
```bash
./start.sh
```

### 3. Access Your Platform
- **Web Interface**: http://localhost:3008
- **Network Access**: http://YOUR_IP:3008 (for other devices)
- **API**: http://localhost:8252

### 4. First-Time Setup
1. The system will automatically scan your media directory
2. Thumbnails and posters will be generated in the background
3. Browse to http://localhost:3008 and enjoy!

## 🔧 Configuration

### Media Directory
Update your media path in the startup script or environment variables:
```bash
export MEDIA_PATH="/path/to/your/media"
```

### Network Access
HomeFlix automatically detects your local IP for network access. Other devices on your WiFi can access it using your computer's IP address.

### Performance Optimization
- **Redis**: Enable Redis for faster asset loading
- **SSD Storage**: Store thumbnails/posters on SSD for better performance
- **Hardware Acceleration**: FFmpeg can use GPU acceleration for transcoding

## 📁 Directory Structure
```
homeflix/
├── backend/           # Go API server
├── frontend/          # Next.js web interface
├── thumbnails/        # Auto-generated thumbnails
├── posters/          # Movie/show posters
├── previews/         # Preview video clips
├── subtitles/        # Subtitle files
└── optimized/        # Transcoded media files
```

## 🌐 Network Features
- **WiFi Streaming**: Access from any device on your network
- **Mobile Responsive**: Full mobile and tablet support
- **Chromecast Ready**: Cast to your TV (coming soon)
- **Multi-Device Sync**: Continue watching across devices

## 🛠 Advanced Features
- **Batch Processing**: Bulk thumbnail and poster generation
- **Auto-Cleanup**: Removes orphaned files and invalid entries
- **Health Monitoring**: System status and performance metrics
- **Backup System**: Automatic database backups

## 📱 Supported Formats
- **Video**: MP4, MKV, AVI, MOV, WMV, FLV
- **Audio**: AAC, MP3, FLAC, ALAC, DTS, AC3
- **Subtitles**: SRT, VTT, ASS, SSA

## 🔒 Security & Privacy
- **Local Only**: Your media never leaves your network
- **No External Dependencies**: Works completely offline
- **Privacy First**: No tracking or data collection

## 📞 Support
- Check the logs in `homeflix.log` for troubleshooting
- Ensure all dependencies are installed correctly
- Verify your media directory permissions
- Make sure ports 3008 and 8252 are available

---

**Enjoy your personal Netflix experience! 🍿**
