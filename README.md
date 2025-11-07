# HomeFlix - Streaming Platform

Transform your media collection into a professional streaming platform! HomeFlix is a full-featured streaming platform that automatically organizes and streams your movies and TV shows with a beautiful, responsive interface. Search movies from directly TMDB and get updated on new movies or tv shows, trailers

![HomeFlix Interface](/preview_0.png)
![HomeFlix Interface](/preview-2.png)
![HomeFlix Interface](/preview-4.png)
![HomeFlix Interface](/preview-5.png)
![TMDB Search Feature](/preview_10.png)
![TMDB Movie Details](/preview_11.png)
![Recently watched](/preview_15.png)
![TMDB TV Shows](/preview_12.png)
![Advanced Search](/preview_13.png)
![Movie Discovery](/preview_14.png)


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
- **TMDB Integration**: Search millions of movies and TV shows from The Movie Database
- **Real-time Search**: Instant search suggestions with movie posters and details
- **Advanced Search**: Find content by title, actor, director, genre
- **Smart Recommendations**: AI-powered content suggestions based on TMDB data
- **Continue Watching**: Resume where you left off
- **My List**: Personal watchlist management with TMDB content
- **Recently Added**: See your newest content first
- **Trending Content**: Discover what's popular on TMDB

### 📱 **Pages & Sections**
- **Home**: Featured content and personalized recommendations
- **Movies**: Browse your entire movie collection + TMDB movie database
- **TV Shows**: Organized series with season/episode navigation + TMDB TV shows
- **My List**: Your personal watchlist with both local and TMDB content
- **Search**: Advanced search with real-time TMDB suggestions and filters
- **Now Playing**: Live TV-style channel with previews
- **New & Popular**: Latest additions and trending content from TMDB
- **TMDB Movie Pages**: Detailed movie/TV show pages with trailers, cast, and crew info

### 🎭 **Media Assets & TMDB Integration**
- **Auto Thumbnails**: Generated from video content
- **Movie Posters**: Downloaded from TMDB database for both local and online content
- **TMDB Trailers**: High-quality YouTube trailers embedded with auto-play
- **Cast & Crew Info**: Complete filmography data from TMDB
- **Preview Videos**: Short clips for quick browsing
- **Subtitle Support**: Multi-language subtitle files
- **Backdrop Images**: High-resolution backdrop images from TMDB
- **Movie Metadata**: Comprehensive movie details including ratings, runtime, budget, and more

### 🎬 **TMDB Movie Database Integration**
- **Global Movie Search**: Access to millions of movies and TV shows from TMDB
- **Real-time Search Suggestions**: Instant search with movie posters and details
- **Detailed Movie Pages**: Complete movie information including:
  - High-quality trailers with auto-play functionality
  - Full cast and crew information with photos
  - Movie ratings, runtime, budget, and box office data
  - Production companies and countries
  - Spoken languages and release dates
  - Movie genres and tags
- **TV Show Support**: Complete TV series information with seasons and episodes
- **Trending Content**: Discover what's popular and trending
- **My List Integration**: Add TMDB movies to your personal watchlist
- **Netflix-style Interface**: Beautiful movie detail pages with video backgrounds

### 📊 **Analytics & Tracking**
- **Watch History**: Track viewing progress and history
- **Playback Resume**: Continue from where you stopped
- **View Statistics**: See your watching patterns
- **Recommendation Engine**: Learns from your preferences and TMDB data

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
3. TMDB integration provides instant access to millions of movies and TV shows
4. Use the search bar to discover new content from The Movie Database
5. Browse to http://localhost:3008 and enjoy!

## � TMnDB Search & Discovery

### Smart Search Bar
HomeFlix features an intelligent search system that provides:
- **Real-time Suggestions**: As you type, get instant movie and TV show suggestions
- **Rich Previews**: See movie posters, ratings, and descriptions in search results
- **Media Type Indicators**: Clear icons distinguish between movies and TV shows
- **Direct Navigation**: Click any suggestion to go directly to the detailed movie page

### Movie & TV Show Pages
Each TMDB movie or TV show has a dedicated page featuring:
- **Auto-playing Trailers**: High-quality YouTube trailers with sound controls
- **Complete Cast Information**: Photos and character details for all actors
- **Crew Details**: Directors, writers, and production team information
- **Technical Details**: Runtime, budget, box office, release dates
- **My List Integration**: Add movies to your personal watchlist
- **Related Content**: Discover similar movies and trending content

### Search Tips
- Search for any movie or TV show title
- Results include both popular and obscure content
- Use the "See all results" option for comprehensive search results
- Browse trending and popular content sections for discovery

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
- **Mobile Responsive**: Full mobile and tablet support with TMDB search
- **Chromecast Ready**: Cast to your TV (coming soon)
- **Multi-Device Sync**: Continue watching across devices
- **Cross-Platform Search**: TMDB search works seamlessly on all devices
- **Offline Capability**: Local media works without internet, TMDB requir

## 🛠 Advanced Features
- **Batch Processing**: Bulk thumbnail and poster generation
- **Auto-Cleanup**: Removes orphaned files and invalid entries
- **Health Monitoring**: System status and performance metrics
- **Backup System**: Automatic database backups
- **TMDB API Integration**: Seamless integration with The Movie Database
- **Hybrid Content**: Mix local media with online TMDB content discovery
- **Smart Caching**: Efficient caching of TMDB data for better performance

## 📱 Supported Formats
- **Video**: MP4, MKV, AVI, MOV, WMV, FLV
- **Audio**: AAC, MP3, FLAC, ALAC, DTS, AC3
- **Subtitles**: SRT, VTT, ASS, SSA

## 🔒 Security & Privacy
- **Local Media Protection**: Your personal media never leaves your network
- **TMDB Integration**: Uses official TMDB API for movie data (requires internet)
- **Hybrid Approach**: Local media works offline, TMDB features require connection
- **Privacy First**: No personal data tracking or collection
- **Secure API Usage**: TMDB integration follows best security practices

## 📞 Support
- Check the logs in `homeflix.log` for troubleshooting
- Ensure all dependencies are installed correctly
- Verify your media directory permissions
- Make sure ports 3008 and 8252 are available

---

**Enjoy your personal Netflix experience! 🍿**
