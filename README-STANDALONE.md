# HomeFlix - Standalone Setup

This guide helps you run HomeFlix without Docker, directly on your system.

## Quick Start

1. **Setup (one-time)**:
   ```bash
   ./setup.sh
   ```

2. **Run the application**:
   ```bash
   ./start.sh
   ```

3. **Access the app**:
   - Frontend: http://localhost:3008
   - Backend API: http://localhost:8252

## Requirements

- **Go** (1.21 or later)
- **Node.js** (18 or later)
- **npm**
- **FFmpeg** (for video processing)

## Directory Structure

When running standalone, all files are stored locally:

```
homeflix/
├── thumbnails/          # Generated thumbnails
├── posters/            # Generated movie posters
├── previews/           # Generated video previews
├── subtitles/          # Subtitle files
├── optimized/          # Optimized video files
├── homeflix.db         # SQLite database
└── /media/azad/Movies/ # Your media files
```

## Features

- ✅ **No Docker required** - runs directly on your system
- ✅ **Local file storage** - all generated content stays on your machine
- ✅ **Automatic thumbnail generation** - creates thumbnails in `./thumbnails/`
- ✅ **Poster generation** - downloads/generates posters in `./posters/`
- ✅ **Video previews** - creates preview clips in `./previews/`
- ✅ **Network access** - accessible from other devices on your WiFi
- ✅ **Background scanning** - automatically discovers new media files

## Configuration

Edit `.env` file to customize:

- `MEDIA_PATH` - where your movies/series are stored
- `THUMBNAIL_PATH` - where thumbnails are generated
- `POSTER_DIR` - where posters are stored
- `PREVIEW_DIR` - where video previews are stored

## Stopping the Application

Press `Ctrl+C` in the terminal where you ran `./start.sh`

## Troubleshooting

1. **Port already in use**: Change ports in `.env` file
2. **Permission denied**: Run `chmod +x setup.sh start.sh`
3. **Missing dependencies**: Run `./setup.sh` to check requirements
4. **Media not found**: Check `MEDIA_PATH` in `.env` file

## Network Access

The app is accessible from other devices on your network:
- Find your IP: `hostname -I`
- Access from other devices: `http://YOUR_IP:3008`

## Performance

- Thumbnails and posters are generated on-demand
- Files are cached locally for faster subsequent access
- No Docker overhead - direct system performance