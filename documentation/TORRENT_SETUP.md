# 🎬 HomeFlix Torrent Download Feature

Transform your HomeFlix into a complete media management solution with automated torrent downloads! This feature allows you to search and download movies and TV shows directly from the HomeFlix interface.

![Torrent Feature Preview](preview_torrent.png)

## ✨ Features

### 🔍 **Smart Torrent Search**
- **Multi-Source Search**: Search across 600+ torrent sites via Jackett
- **Quality Filtering**: Filter by 4K, 1080p, 720p, 480p
- **Smart Sorting**: Results sorted by seeders and quality
- **Verified Torrents**: Highlights verified and high-quality releases

### 📥 **Automated Downloads**
- **One-Click Download**: Start downloads directly from TMDB movie pages
- **Progress Tracking**: Real-time download progress with ETA
- **Pause/Resume**: Full control over download queue
- **Auto-Organization**: Downloads organized into Movies/TV Shows folders

### 🎯 **Seamless Integration**
- **TMDB Integration**: Download button on every TMDB movie/TV page
- **Auto-Scanning**: Downloaded files automatically added to your library
- **Metadata Matching**: Automatic metadata fetching for downloaded content
- **Quality Selection**: Prefer specific quality levels

### 🛡️ **Safe & Reliable**
- **Cloudflare Bypass**: Uses Jackett to bypass site restrictions
- **Mirror Support**: Automatically handles site mirrors and downtime
- **Error Handling**: Robust error handling and retry mechanisms
- **Legal Compliance**: Built-in reminders about copyright laws

## 🚀 Quick Setup

### 1. **Run the Setup Script**
```bash
./setup-jackett.sh
```

This script will:
- Install and configure Jackett via Docker
- Create download directories
- Set up the torrent infrastructure

### 2. **Configure Jackett**
1. Open http://localhost:9117
2. Copy the API key from the top-right corner
3. Add indexers (torrent sites):
   - Click "Add indexer"
   - Search for popular sites like "1337x", "RARBG", "The Pirate Bay"
   - Configure each indexer

### 3. **Configure HomeFlix**
1. Go to HomeFlix Settings → Torrents tab
2. Enter Jackett URL: `http://localhost:9117`
3. Enter your API key
4. Set download path: `~/Downloads/homeflix`
5. Configure preferences (quality, seeders, etc.)

## 📋 Manual Setup

### Prerequisites
- **Docker & Docker Compose** - For running Jackett
- **Go 1.21+** - For the backend torrent client
- **Sufficient Storage** - For downloaded media files

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
go mod tidy
```

2. **Update Database**
The torrent tables will be automatically created when you restart the server.

3. **Restart HomeFlix Backend**
```bash
./start.sh
```

### Jackett Setup (Manual)

1. **Create Docker Compose File**
```yaml
version: '3.8'
services:
  jackett:
    image: lscr.io/linuxserver/jackett:latest
    container_name: homeflix-jackett
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Dhaka
    volumes:
      - ./jackett-config:/config
      - ~/Downloads/homeflix:/downloads
    ports:
      - "9117:9117"
    restart: unless-stopped
```

2. **Start Jackett**
```bash
docker-compose up -d
```

3. **Configure Indexers**
- Visit http://localhost:9117
- Add popular indexers like 1337x, RARBG, TPB
- Test each indexer to ensure it's working

## 🎯 How to Use

### From TMDB Movie Pages
1. Browse to any movie or TV show on TMDB (via HomeFlix search)
2. Click the red "Download" button
3. You'll be taken to the Torrents tab with search results
4. Choose your preferred torrent and click "Download"
5. Monitor progress in the Downloads section

### From Settings Page
1. Go to Settings → Torrents
2. Use the search tab to find any content
3. Filter by quality and source
4. Start downloads and monitor progress

### Download Management
- **Pause/Resume**: Control individual downloads
- **Remove**: Delete downloads from queue
- **Progress Tracking**: Real-time speed and ETA
- **Auto-Organization**: Files saved to appropriate folders

## 📁 Directory Structure

```
~/Downloads/homeflix/
├── Movies/           # Downloaded movies
│   ├── Movie1.mkv
│   └── Movie2.mp4
└── TV Shows/         # Downloaded TV series
    ├── Series1/
    │   ├── Season 1/
    │   └── Season 2/
    └── Series2/
```

## ⚙️ Configuration Options

### Torrent Settings
- **Jackett URL**: Usually `http://localhost:9117`
- **API Key**: From Jackett dashboard
- **Download Path**: Where files are saved
- **Min Seeders**: Minimum seeders required
- **Max Downloads**: Concurrent download limit
- **Preferred Quality**: Default quality preference
- **Auto Download**: Enable for watchlist automation

### Quality Preferences
- **4K (2160p)**: Ultra high definition
- **1080p**: Full HD (recommended)
- **720p**: HD (good for smaller files)
- **480p**: Standard definition

## 🔧 Troubleshooting

### Common Issues

**Jackett Not Working**
```bash
# Check Jackett logs
docker logs homeflix-jackett

# Restart Jackett
docker restart homeflix-jackett
```

**No Search Results**
- Ensure indexers are configured in Jackett
- Check if indexers are working (test in Jackett)
- Verify API key is correct
- Try different search terms

**Downloads Not Starting**
- Check download path permissions
- Ensure sufficient disk space
- Verify torrent client is running
- Check firewall settings

**Files Not Appearing in HomeFlix**
- Ensure files are in the correct directory structure
- Trigger a manual scan: Settings → Scanning → Full Scan
- Check file permissions
- Verify file formats are supported

### Performance Optimization

**For Better Download Speeds**
- Use indexers with high-seeded torrents
- Increase max concurrent downloads (if bandwidth allows)
- Use wired internet connection
- Configure port forwarding for better connectivity

**For System Performance**
- Limit concurrent downloads based on system resources
- Use SSD for download directory if possible
- Monitor disk space regularly
- Clean up completed downloads periodically

## 🌐 Popular Indexers

### Public Indexers (Free)
- **1337x** - General purpose, high quality
- **RARBG** - Movies and TV shows
- **The Pirate Bay** - Largest public tracker
- **YTS** - High-quality movie releases
- **EZTV** - TV shows specialist
- **Torrentz2** - Meta-search engine

### Configuration Tips
- Add multiple indexers for better coverage
- Test each indexer after adding
- Update indexers regularly
- Remove non-working indexers

## ⚖️ Legal Notice

**Important**: This feature is designed for downloading content you legally own or that is in the public domain. Please respect copyright laws in your jurisdiction.

**Legal Uses**:
- Linux distributions and open-source software
- Public domain movies and TV shows
- Creative Commons content
- Your own content backups
- Legally purchased content re-downloads

**Disclaimer**: The developers of HomeFlix are not responsible for how users choose to use this feature. Users are solely responsible for ensuring their downloads comply with applicable laws.

## 🔒 Security & Privacy

### Data Protection
- All torrent activity is local to your network
- No data is sent to external servers (except Jackett API calls)
- Download history is stored locally
- No tracking or analytics

### Network Security
- Use VPN for additional privacy if desired
- Configure firewall rules appropriately
- Monitor network traffic
- Keep Jackett and indexers updated

## 🚀 Advanced Features

### Automation (Coming Soon)
- **Watchlist Integration**: Auto-download items added to your list
- **RSS Feeds**: Monitor for new releases
- **Quality Upgrading**: Automatically replace with better quality
- **Series Tracking**: Auto-download new episodes

### Integration Features
- **Plex/Jellyfin**: Compatible with media server setups
- **Sonarr/Radarr**: Can work alongside these tools
- **Custom Scripts**: Hook into download completion events

## 📞 Support

### Getting Help
1. Check this documentation first
2. Review the troubleshooting section
3. Check HomeFlix logs: `tail -f backend/server.log`
4. Check Jackett logs: `docker logs homeflix-jackett`
5. Create an issue on GitHub with detailed information

### Contributing
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

---

**Enjoy your automated media downloads! 🍿**

*Remember: Download responsibly and respect copyright laws.*