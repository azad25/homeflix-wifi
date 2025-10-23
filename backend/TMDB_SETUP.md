# TMDB Poster Integration Setup

This guide explains how to set up TMDB (The Movie Database) integration for automatic poster downloading in your Homeflix backend.

## Prerequisites

1. **TMDB Account**: Sign up for a free account at [themoviedb.org](https://www.themoviedb.org/)
2. **API Key**: Get your free API key from your TMDB account settings

## Setup Steps

### 1. Get Your TMDB API Key

1. Go to [themoviedb.org](https://www.themoviedb.org/) and create an account
2. Navigate to your account settings
3. Go to the "API" section
4. Create a new API key (v3 Auth)
5. Copy your API key (it looks like: `abc123def456...`)

### 2. Configure Environment Variable

Add your TMDB API key to your environment variables:

#### Option A: Using .env file (Recommended)
Create or edit the `.env` file in your backend directory:

```bash
# TMDB Configuration
TMDB_API_KEY=your_actual_api_key_here
```

#### Option B: System Environment Variable
```bash
export TMDB_API_KEY=your_actual_api_key_here
```

#### Option C: Docker Environment
If using Docker, add to your docker-compose.yml:

```yaml
environment:
  - TMDB_API_KEY=your_actual_api_key_here
```

### 3. Restart Your Server

After setting the API key, restart your Homeflix backend server to load the new configuration.

## How It Works

### Automatic Poster Downloads

1. **On Startup**: The scanner checks all media for missing posters and downloads them from TMDB
2. **On Demand**: When a poster is requested but not found, it's automatically downloaded from TMDB
3. **Fallback**: If no poster is found, the system falls back to using thumbnails as posters

### API Endpoints

- `GET /api/posters/:id` - Serves posters with automatic TMDB download
- `POST /api/posters/:id` - Manually trigger poster download for specific media

### Storage Locations

Posters are saved to:
- Primary: `./posters/` (root folder)
- Fallback: `./backend/posters/` (backend folder)

### File Naming Convention

Posters are saved with the format: `poster_{clean_title}.jpg`

Example: `poster_inception_2010.jpg`

## Rate Limiting

TMDB enforces rate limits (40 requests per 10 seconds). The system includes:
- Automatic delays between requests
- Batch processing with pauses
- Retry logic for failed downloads

## Troubleshooting

### Common Issues

1. **"TMDB API key not configured"**
   - Ensure `TMDB_API_KEY` environment variable is set
   - Restart the server after setting the key

2. **"Movie not found in TMDB"**
   - The title cleaning algorithm may need adjustment
   - Check logs for the search terms being used
   - Some movies may not be in TMDB database

3. **Download failures**
   - Check internet connectivity
   - Verify API key is valid
   - Check TMDB service status

### Debug Logging

The system provides detailed logging:
- `🎨 TMDB: Searching for poster for 'Title'` - Search initiated
- `✅ TMDB: Found movie - ID: 123, Title: 'Title'` - Movie found
- `📥 TMDB: Downloading poster from: URL` - Download started
- `✅ TMDB: Poster saved to: path` - Download completed

## API Usage Examples

### Manual Poster Download
```bash
curl -X POST http://localhost:8080/api/posters/123
```

### Get Poster (with auto-download)
```bash
curl http://localhost:8080/api/posters/123
```

## Configuration Options

The TMDB integration supports various poster sizes:
- `w92` - Small thumbnail
- `w154` - Medium thumbnail  
- `w185` - Large thumbnail
- `w342` - Small poster
- `w500` - Medium poster (default)
- `w780` - Large poster
- `original` - Full resolution

The system uses `w500` by default for a good balance of quality and file size.

## Security Notes

- Keep your API key secure and never commit it to version control
- Use environment variables or secure secret management
- TMDB API keys are free but have usage limits
- Monitor your API usage in the TMDB dashboard

## Support

For TMDB API issues:
- [TMDB API Documentation](https://developers.themoviedb.org/3)
- [TMDB Support Forums](https://www.themoviedb.org/talk)

For Homeflix integration issues:
- Check server logs for detailed error messages
- Ensure all dependencies are properly installed
- Verify file permissions for poster directories