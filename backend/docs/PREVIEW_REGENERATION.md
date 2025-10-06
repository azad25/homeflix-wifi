# Preview Clip Regeneration Guide

This guide explains how to regenerate preview clips for your media library when they're missing or corrupted.

## Overview

Preview clips are short video segments (usually 10-30 seconds) that play automatically in the hero section and when hovering over media items. They enhance the user experience by providing a quick preview of the content.

## Common Issues

- **Missing preview clips**: Some media entries don't have preview clips generated
- **Corrupted preview files**: Preview files exist in database but are missing from disk
- **Path mismatches**: Database references preview files that don't exist
- **Quality issues**: Old preview clips need regeneration with better settings

## Available Tools

### 1. Check Missing Previews

First, check which media are missing preview clips:

```bash
cd backend
go run scripts/check_missing_previews.go
```

This will show you:
- Total media count
- How many have working preview clips
- How many are missing preview clips
- Detailed list of problematic entries

### 2. Regenerate Missing Preview Clips Only

To generate preview clips ONLY for media that are completely missing them:

```bash
cd backend
go run scripts/regenerate_previews.go -mode missing
```

This is the **recommended approach** as it's faster and won't regenerate existing previews.

### 3. Regenerate All Preview Clips

To regenerate preview clips for ALL media (including those that already have them):

```bash
cd backend
go run scripts/regenerate_previews.go -mode all
```

Use this when you want to update the quality or settings of existing previews.

### 4. Force Regenerate All Assets

To regenerate thumbnails, previews, AND posters for all media:

```bash
cd backend
go run scripts/regenerate_previews.go -mode force
```

This is the most comprehensive option but takes the longest time.

### 5. Using the Sync Tool

You can also use the main sync tool:

```bash
cd backend
# Regenerate all preview clips
go run scripts/sync_media.go regenerate-previews

# Regenerate only missing preview clips
go run scripts/sync_media.go regenerate-missing-previews

# Full asset regeneration
go run scripts/sync_media.go regenerate-assets
```

## API Endpoints

You can also trigger regeneration via API:

```bash
# Regenerate all preview clips
curl -X POST http://localhost:8252/api/admin/scan/regenerate-previews

# Regenerate only missing preview clips
curl -X POST http://localhost:8252/api/admin/scan/regenerate-missing-previews

# Regenerate all assets
curl -X POST http://localhost:8252/api/admin/scan/regenerate-assets
```

## Process Details

### What Happens During Regeneration

1. **File Validation**: Checks if the original video file exists
2. **Preview Generation**: Uses FFmpeg to extract a preview clip
3. **Database Update**: Updates the media record with preview paths
4. **File Verification**: Confirms the preview file was created successfully

### Batch Processing

- Preview clips are processed in small batches (3 at a time) to prevent system overload
- There's a 1-second delay between each preview generation
- There's a 5-second delay between batches
- This ensures stable processing without overwhelming FFmpeg

### File Locations

Preview clips are stored in:
```
backend/previews/preview_[MediaTitle].mp4
```

The database stores both:
- `preview_path`: Path to the preview file
- `preview_clip_path`: Same as preview_path (for compatibility)

## Troubleshooting

### Preview Generation Fails

If preview generation fails for specific files:

1. **Check file permissions**: Ensure the video file is readable
2. **Check FFmpeg**: Ensure FFmpeg is installed and accessible
3. **Check disk space**: Ensure enough space for preview files
4. **Check file format**: Some exotic video formats may not work

### Database Issues

If database updates fail:

1. **Check database permissions**: Ensure write access to the database
2. **Check database locks**: Ensure no other processes are using the database
3. **Run database sync**: `go run scripts/sync_media.go database-sync`

### Performance Issues

If the process is too slow:

1. **Reduce batch size**: Modify the `batchSize` in the scanner code
2. **Use SSD storage**: Store preview files on faster storage
3. **Increase system resources**: More RAM and CPU help with FFmpeg processing

## Monitoring Progress

### Log Output

The regeneration process provides detailed logging:

```
🎬 Starting preview clip regeneration for all media...
🎬 Found 150 media entries for preview clip regeneration
📝 Queued for preview generation: Movie Title 1
📝 Queued for preview generation: Movie Title 2
🎬 Regenerating preview clips for 45 media entries...
🎬 Processing preview batch 1/15 (1-3 of 45)
🎬 Generating preview clip for: Movie Title 1
✅ Preview clip generated and updated for: Movie Title 1
   📁 New preview path: backend/previews/preview_Movie_Title_1.mp4
   📊 Preview file size: 2547832 bytes
```

### Checking Results

After regeneration, run the check script again:

```bash
go run scripts/check_missing_previews.go
```

This will show the updated status and confirm successful generation.

## Best Practices

1. **Start with missing only**: Use `-mode missing` first to handle the most critical cases
2. **Monitor system resources**: Watch CPU and disk usage during generation
3. **Run during off-peak hours**: Preview generation is resource-intensive
4. **Backup database**: Always backup your database before major operations
5. **Test with small batches**: If you have many files, test with a subset first

## Integration with Frontend

Once preview clips are regenerated, they should automatically appear in:

- **Hero section**: Background videos in the main carousel
- **Media cards**: Hover previews on movie/show thumbnails
- **Detail pages**: Preview clips in media information

The frontend will automatically detect and use the new preview clips without requiring a restart.