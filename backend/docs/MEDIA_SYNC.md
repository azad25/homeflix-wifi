# Media Library Sync Documentation

This document describes the comprehensive media library synchronization system that ensures your database stays in sync with your media storage.

## Overview

The media sync system provides multiple strategies to keep your media database synchronized with your file storage:

1. **Title and Filename Matching** - Finds existing media by both title and filename
2. **Path Correction** - Handles moved or renamed files
3. **Metadata Regeneration** - Updates titles and metadata when files change
4. **Asset Regeneration** - Recreates thumbnails, previews, and posters
5. **Orphan Detection** - Finds files not in the database

## Available Operations

### 1. Comprehensive Sync (`/admin/scan/sync`)
**Recommended for most use cases**

This performs a complete synchronization:
- Validates all database entries against storage
- Fixes path issues and title mismatches
- Discovers orphaned files
- Regenerates assets for all media
- Updates metadata from TMDB

```bash
# CLI
go run scripts/sync_media.go sync

# API
POST /api/admin/scan/sync
```

### 2. Database Sync (`/admin/scan/database-sync`)
**For database validation only**

This validates existing database entries:
- Checks if files still exist
- Updates file paths if moved
- Fixes title-filename mismatches
- Updates metadata but doesn't regenerate assets

```bash
# CLI
go run scripts/sync_media.go database-sync

# API
POST /api/admin/scan/database-sync
```

### 3. Asset Regeneration (`/admin/scan/regenerate-assets`)
**For updating thumbnails and previews**

This regenerates all visual assets:
- Creates new thumbnails
- Generates new preview clips
- Downloads new posters
- Updates TMDB metadata

```bash
# CLI
go run scripts/sync_media.go regenerate-assets

# API
POST /api/admin/scan/regenerate-assets
```

## How It Works

### Media Detection Strategies

The system uses multiple strategies to find existing media:

1. **Exact Path Match** - Fastest, checks current file path
2. **Filename Match** - Handles moved files by searching for filename
3. **Title Match** - Finds media by expected title from filename
4. **Fuzzy Title Match** - Uses similarity matching for renamed files

### Title-Filename Mismatch Detection

The system detects when stored titles don't match what the filename suggests:

- Compares stored title with expected title from filename
- Uses similarity scoring (70% threshold)
- Identifies titles that look like uncleaned filenames
- Automatically regenerates proper titles

### Asset Regeneration Logic

Assets are regenerated when:
- Title-filename mismatch is detected
- Files have been moved or renamed
- Assets are missing or corrupted
- Force regeneration is requested

## Configuration

### Scanner Settings

You can configure the scanner behavior:

```json
{
  "max_workers": 8,
  "batch_size": 20
}
```

```bash
# API
PUT /api/admin/scan/config
{
  "max_workers": 8,
  "batch_size": 20
}
```

### Performance Tuning

- **max_workers**: Number of parallel processing threads (1-16)
- **batch_size**: Files processed in each batch (1-100)
- Asset generation uses queue health checking to prevent overload

## Use Cases

### After Moving Media Files
```bash
go run scripts/sync_media.go database-sync
```
This will find moved files and update their paths in the database.

### After Renaming Files
```bash
go run scripts/sync_media.go sync
```
This will detect title mismatches and regenerate assets with correct names.

### Updating All Thumbnails
```bash
go run scripts/sync_media.go regenerate-assets
```
This will create fresh thumbnails, previews, and posters for all media.

### Complete Database Cleanup
```bash
go run scripts/sync_media.go sync
```
This performs a comprehensive cleanup and sync operation.

## Monitoring

### Check Sync Status
```bash
# Get current statistics
curl GET /api/admin/scan/stats

# CLI
go run scripts/sync_media.go stats
```

### Log Output

The sync process provides detailed logging:
- 🔍 File discovery and matching
- 🏷️ Title updates and fixes
- 📁 Path corrections
- 🎨 Asset generation progress
- ✅ Success confirmations
- ⚠️ Warnings and issues

## Best Practices

1. **Regular Sync**: Run comprehensive sync weekly
2. **After Changes**: Run database-sync after moving/renaming files
3. **Asset Updates**: Run asset regeneration when updating thumbnails
4. **Monitor Logs**: Check logs for warnings about missing files
5. **Backup First**: Always backup your database before major sync operations

## Troubleshooting

### Common Issues

**Files Not Found**
- Check media path configuration
- Verify file permissions
- Look for moved or renamed files

**Title Mismatches**
- Review filename patterns
- Check TMDB service configuration
- Verify title cleaning logic

**Asset Generation Failures**
- Check thumbnail service health
- Verify FFmpeg installation
- Monitor system resources

**Performance Issues**
- Reduce max_workers for slower systems
- Decrease batch_size for memory constraints
- Monitor queue health during processing

### Recovery

If sync operations fail:
1. Check the logs for specific error messages
2. Verify all services are running (TMDB, thumbnail service, etc.)
3. Try running individual operations (database-sync, then regenerate-assets)
4. Use incremental-scan for new files only

## API Reference

### Endpoints

- `POST /api/admin/scan/sync` - Comprehensive sync
- `POST /api/admin/scan/database-sync` - Database validation
- `POST /api/admin/scan/regenerate-assets` - Asset regeneration
- `GET /api/admin/scan/stats` - Current statistics
- `PUT /api/admin/scan/config` - Update configuration

### Response Format

```json
{
  "message": "Operation started",
  "description": "Detailed description of what will happen",
  "status": "running"
}
```

All operations run asynchronously and return immediately. Monitor logs for progress and completion status.