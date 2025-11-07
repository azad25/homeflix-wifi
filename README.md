# HomeFlix - Streaming Platform

Transform your media collection into a professional streaming platform! HomeFlix is a full-featured streaming platform that automatically organizes and streams your movies and TV shows with a beautiful, responsive interface. Search movies from directly TMDB and get updated on new movies or tv shows, trailers.

## 🎉 **NEW in Version 2.0: Integrated Torrent Downloads!**

**Download movies directly from TMDB pages with one click!** HomeFlix now includes a complete torrent download system with real-time progress tracking, automatic library integration, and professional UI.

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

---

## 🚀 **Version 2.0 Changelog - Torrent Download System**
## ** Download Media Directly on homeflix **
![Movie Discovery](/preview_21.png)
![Movie Discovery](/preview_22.png)
### 🎬 **NEW: One-Click Movie Downloads**
- **Direct TMDB Integration**: Download button on every movie page
- **Automatic Search**: Finds best torrents from multiple sources
- **Real-time Progress**: Live download progress with speed, ETA, and completion percentage
- **Smart Quality Selection**: Automatically picks best quality based on seeders
- **Seamless Integration**: Downloaded movies automatically appear in your library

### 🔍 **NEW: Advanced Torrent Dashboard**
- **Professional UI**: Netflix-style interface with dark theme
- **Multi-Source Search**: Integrates with Jackett for 600+ torrent sites
- **Quality Filtering**: Filter by 4K, 1080p, 720p, 480p
- **Download Management**: Pause, resume, and delete downloads
- **Progress Tracking**: Real-time statistics with seeders, peers, and transfer rates

### ⚙️ **NEW: Torrent Configuration System**
- **Jackett Integration**: Professional torrent indexer with Cloudflare bypass
- **Flexible Setup**: Docker or native installation options
- **Custom Download Paths**: Save to local drives or external storage
- **Quality Preferences**: Set preferred resolution and minimum seeders
- **Bandwidth Control**: Limit concurrent downloads and transfer rates

### 🎯 **NEW: Smart Download Features**
- **Automatic Library Scanning**: Downloaded content instantly available
- **Duplicate Detection**: Prevents downloading existing movies
- **Resume Support**: Continue interrupted downloads
- **Error Handling**: Robust error recovery and user feedback
- **Legal Compliance**: Built-in reminders for legal content only

### 📱 **NEW: Enhanced User Experience**
- **One-Click Workflow**: Movie page → Download button → Automatic download
- **Visual Progress**: Progress bars and status indicators throughout UI
- **Mobile Responsive**: Full torrent management on mobile devices
- **Notification System**: Success/error messages and download completion alerts
- **Settings Integration**: Torrent configuration in main settings panel

---

## ✨ Key Features

### 🎬 **Smart Media Management**
- **Automatic Scanning**: Detects and organizes movies/TV shows from your drives
- **Intelligent Metadata**: Auto-fetches movie info, posters, and descriptions from TMDB
- **Genre Classification**: Automatically categorizes content by genre
- **Series Organization**: Groups TV episodes by seasons and series
- **🆕 Torrent Downloads**: One-click downloads directly from TMDB movie pages
- **🆕 Real-time Progress**: Live download tracking with speed and ETA
- **🆕 Automatic Integration**: Downloaded content instantly appears in library

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
- **🆕 Torrent Search**: Multi-source torrent search with quality filtering
- **🆕 Download Dashboard**: Professional torrent management interface
- **🆕 Progress Tracking**: Real-time download monitoring and statistics

### 📱 **Pages & Sections**
- **Home**: Featured content and personalized recommendations
- **Movies**: Browse your entire movie collection + TMDB movie database
- **TV Shows**: Organized series with season/episode navigation + TMDB TV shows
- **My List**: Your personal watchlist with both local and TMDB content
- **Search**: Advanced search with real-time TMDB suggestions and filters
- **Now Playing**: Live TV-style channel with previews
- **New & Popular**: Latest additions and trending content from TMDB
- **TMDB Movie Pages**: Detailed movie/TV show pages with trailers, cast, and crew info
- **🆕 Torrent Dashboard**: Complete download management with search, progress, and settings
- **🆕 Download Progress**: Real-time tracking on movie pages and dedicated dashboard
- **🆕 Settings Panel**: Torrent configuration with Jackett integration

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

### One-Command Setup (Version 2.0)
```bash
# Clone and setup everything including torrent system
git clone <repository-url>
cd homeflix
chmod +x setup.sh start.sh setup-jackett.sh
./setup.sh

# Optional: Setup torrent downloads (recommended)
./setup-jackett.sh
```

### Manual Installation

#### Prerequisites
- **Go 1.21+** - [Download here](https://golang.org/dl/)
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **FFmpeg** - For video processing
- **Redis** - For caching (optional but recommended)
- **🆕 Docker** - For Jackett torrent indexer (optional but recommended)
- **🆕 Jackett** - Torrent indexer for download functionality

#### System Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install golang-go nodejs npm ffmpeg redis-server docker.io docker-compose

# macOS (with Homebrew)
brew install go node ffmpeg redis docker docker-compose

# Arch Linux
sudo pacman -S go nodejs npm ffmpeg redis docker docker-compose
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

### 🆕 5. Setup Torrent Downloads (Optional)
```bash
# Quick setup with Docker (recommended)
./setup-jackett.sh

# Then configure in HomeFlix:
# 1. Go to Settings → Torrents
# 2. Enter Jackett URL: http://localhost:9117
# 3. Get API key from Jackett dashboard
# 4. Configure download preferences
# 5. Start downloading movies with one click!
```

**See [Complete Torrent Setup Guide](documentation/COMPLETE_TORRENT_SETUP_GUIDE.md) for detailed instructions.**

## 🎬 **NEW: Torrent Download System**

### One-Click Downloads from Movie Pages
HomeFlix 2.0 introduces seamless torrent downloads directly from TMDB movie pages:

- **Red Download Button**: Appears on every movie page for instant downloads
- **Automatic Search**: Finds best torrents from multiple sources automatically
- **Smart Selection**: Picks highest quality with most seeders
- **Real-time Progress**: Live updates with speed, ETA, and completion percentage
- **Instant Integration**: Downloaded movies appear in your library immediately

### Professional Torrent Dashboard
Access via Settings → Torrents for complete download management:

- **Search Tab**: Browse torrents from 600+ sites with quality filtering
- **Downloads Tab**: Monitor active downloads with pause/resume/delete controls
- **Settings Tab**: Configure Jackett, download paths, and quality preferences

### Jackett Integration
Powered by Jackett for reliable torrent searching:

- **Multi-Source**: Searches 1337x, YTS, EZTV, TorrentGalaxy, and more
- **Cloudflare Bypass**: Professional indexer handles site protection
- **Quality Filtering**: Filter by 4K, 1080p, 720p, 480p
- **Seeder Sorting**: Automatically picks torrents with most seeders

### Download Management Features
- **Progress Tracking**: Real-time speed, ETA, and completion status
- **Queue Management**: Pause, resume, and delete downloads
- **Automatic Cleanup**: Removes completed torrents and manages files
- **Error Recovery**: Robust handling of network issues and failures
- **Mobile Support**: Full torrent management on mobile devices

### Setup Options
1. **Demo Mode**: Works immediately with mock data for testing
2. **Docker Setup**: One-command Jackett installation with `./setup-jackett.sh`
3. **Native Setup**: Manual Jackett installation for advanced users

**See [Complete Setup Guide](documentation/COMPLETE_TORRENT_SETUP_GUIDE.md) for detailed instructions.**

---

## 🔍 TMDB Search & Discovery

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
- **🆕 Torrent Management**: Complete download system with pause/resume/delete
- **🆕 Multi-Source Search**: Jackett integration with 600+ torrent sites
- **🆕 Quality Control**: Automatic quality selection and seeder filtering
- **🆕 Progress Tracking**: Real-time download statistics and ETA
- **🆕 Automatic Integration**: Downloaded content instantly available in library

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
- **🆕 Torrent Privacy**: Optional VPN integration and proxy support
- **🆕 Legal Compliance**: Built-in reminders for legal content only
- **🆕 Local Processing**: All torrent management happens on your device

## 📞 Support
- Check the logs in `homeflix.log` for troubleshooting
- Ensure all dependencies are installed correctly
- Verify your media directory permissions
- Make sure ports 3008 and 8252 are available
- **🆕 Torrent Issues**: See [Torrent Setup Guide](documentation/COMPLETE_TORRENT_SETUP_GUIDE.md) for troubleshooting

## 📚 Documentation
- **[Complete Torrent Setup Guide](documentation/COMPLETE_TORRENT_SETUP_GUIDE.md)** - Detailed torrent system setup
- **[Jackett Integration Guide](documentation/JACKETT_INTEGRATION_GUIDE.md)** - Jackett configuration and indexers
- **[Torrent Implementation Summary](documentation/TORRENT_IMPLEMENTATION_SUMMARY.md)** - Technical details and architecture
- **[Media Paths System](documentation/MEDIA_PATHS_SYSTEM.md)** - File organization and paths

---

**Enjoy your personal Netflix experience with one-click downloads! 🍿🎬**

*Version 2.0 brings professional torrent downloads directly to your HomeFlix experience - discover, download, and watch all in one place!*
