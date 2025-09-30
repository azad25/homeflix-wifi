# HomeFlix - Netflix Clone

A full-featured Netflix clone built with Go backend and Next.js frontend, designed to stream your personal media collection from external drives.

## Features

- 🎬 **Media Library Management**: Automatically scan and organize movies/series from external drives
- 🎨 **Netflix-like UI**: Beautiful interface using ScrollXUI components with parallax effects
- 🎥 **Video Streaming**: High-quality video streaming with HLS/DASH support
- 🏷️ **Smart Categorization**: Automatic genre detection and categorization
- 🔍 **Advanced Search**: Search by title, genre, actor, director, and more
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- 🎭 **Thumbnails & Trailers**: Auto-generated thumbnails and trailer previews
- 📝 **Subtitles Support**: Multi-language subtitle support
- 👤 **User Profiles**: Multiple user profiles with watchlists and viewing history

## Tech Stack

### Backend (Go)
- **Gin** - HTTP web framework
- **GORM** - ORM for database operations
- **SQLite** - Lightweight database
- **FFmpeg** - Video processing and thumbnail generation
- **Gorilla WebSocket** - Real-time communication

### Frontend (Next.js)
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **ScrollXUI** - Modern component library
- **Framer Motion** - Smooth animations
- **Video.js** - HTML5 video player

## Project Structure

```
homeflix/
├── backend/                 # Go backend
│   ├── cmd/                # Application entry points
│   ├── internal/           # Private application code
│   ├── pkg/                # Public library code
│   ├── api/                # API definitions
│   └── migrations/         # Database migrations
├── frontend/               # Next.js frontend
│   ├── src/                # Source code
│   ├── components/         # React components
│   ├── pages/              # Next.js pages
│   └── public/             # Static assets
└── docker-compose.yml      # Development environment
```

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- FFmpeg
- External drive with media files

### Backend Setup
```bash
cd backend
go mod init homeflix-backend
go run cmd/server/main.go
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Configuration

1. **Media Path**: Configure your external drive path in `backend/config/config.yaml`
2. **Database**: SQLite database will be created automatically
3. **FFmpeg**: Ensure FFmpeg is installed for video processing

## API Endpoints

- `GET /api/movies` - List all movies
- `GET /api/series` - List all TV series
- `GET /api/search` - Search media content
- `GET /api/stream/:id` - Stream video content
- `GET /api/thumbnails/:id` - Get video thumbnails

## License

MIT License - see LICENSE file for details.
