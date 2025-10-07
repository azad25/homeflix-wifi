# Preview Generation with ALAC Audio Fallbacks

## Overview

This document describes the enhanced preview generation system that handles ALAC audio format issues and provides multiple fallback strategies to ensure 1080p preview clips are generated successfully.

## Problem Statement

Many media files contain ALAC (Apple Lossless Audio Codec) audio tracks that can cause FFmpeg to fail during preview generation. The original system would fail completely when encountering these files, leaving many media items without preview clips.

## Solution

The new system implements a comprehensive fallback strategy with 5 different approaches to generate preview clips:

### Fallback Strategy Sequence

1. **Standard 1080p Generation** (Original Method)
   - Attempts to generate 1080p preview with original audio
   - Uses existing thumbnail service methods
   - If successful and validated, returns immediately

2. **Audio Codec Fallback** (ALAC → AAC Conversion)
   - Forces conversion of ALAC audio to AAC
   - Maintains 1080p video quality
   - Uses explicit audio codec parameters:
     - `-c:a aac` (Force AAC audio codec)
     - `-b:a 128k` (Audio bitrate)
     - `-ac 2` (Stereo audio)
     - `-ar 44100` (Sample rate)

3. **Async Method Fallback**
   - Uses asynchronous preview generation
   - May handle resource contention issues
   - Maintains original quality settings

4. **Lower Quality Fallback** (720p with Audio Conversion)
   - Reduces video quality to 720p for faster processing
   - Converts audio to AAC with lower bitrate (96k)
   - Uses `ultrafast` preset for speed
   - Higher CRF (28) for smaller file size

5. **Video-Only Fallback** (No Audio Track)
   - Removes audio completely (`-an` flag)
   - Maintains 1080p video quality
   - Last resort for problematic audio tracks

### File Validation

Each generated preview file is validated to ensure quality:

- **Existence Check**: File must exist on disk
- **Size Check**: Minimum 1KB file size
- **Duration Check**: Minimum 5 seconds duration
- **Format Validation**: Uses FFprobe to verify video format

## API Endpoints

### New Endpoints

1. **Regenerate Missing Previews**
   ```
   POST /api/admin/preview-clips/regenerate-missing
   ```
   - Finds all media with missing preview clips
   - Processes them using the fallback system
   - Returns statistics on success/failure rates

2. **Enhanced Batch Processing**
   ```
   POST /api/admin/preview-clips/batch
   ```
   - Updated to use fallback system
   - Processes multiple media items with error handling

### Enhanced Scanner Methods

- `generatePreviewWithFallbacks()`: Main fallback orchestrator
- `generatePreviewWithAudioFallback()`: ALAC to AAC conversion
- `generateLowerQualityPreview()`: 720p fallback
- `generateVideoOnlyPreview()`: Audio-free fallback
- `validatePreviewFile()`: File validation
- `checkFFmpegCapabilities()`: System capability check

## FFmpeg Commands

### Audio Fallback Command
```bash
ffmpeg -i input.mkv \
  -ss 60 -t 30 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -movflags +faststart -y output.mp4
```

### 720p Fallback Command
```bash
ffmpeg -i input.mkv \
  -ss 60 -t 30 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset ultrafast -crf 28 \
  -c:a aac -b:a 96k -ac 2 -ar 44100 \
  -movflags +faststart -y output.mp4
```

### Video-Only Command
```bash
ffmpeg -i input.mkv \
  -ss 60 -t 30 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset fast -crf 23 \
  -an -movflags +faststart -y output.mp4
```

## Usage

### Automatic Integration

The fallback system is automatically integrated into:

- **Media Scanner**: All new media processing
- **Database Sync**: Regeneration of missing assets
- **Manual Preview Generation**: API endpoints

### Manual Triggering

1. **Regenerate All Missing Previews**:
   ```bash
   curl -X POST http://localhost:8252/api/admin/preview-clips/regenerate-missing
   ```

2. **Scanner Regeneration**:
   ```bash
   curl -X POST http://localhost:8252/api/admin/scan/regenerate-missing-previews
   ```

3. **Batch Processing**:
   ```bash
   curl -X POST http://localhost:8252/api/admin/preview-clips/batch \
     -H "Content-Type: application/json" \
     -d '{"media_ids": [1, 2, 3]}'
   ```

## Testing

Use the provided test script:

```bash
./backend/test_preview_fallbacks.sh
```

This script tests:
- Missing preview regeneration
- Thumbnail service statistics
- Batch processing with fallbacks
- Scanner integration

## Logging

The system provides detailed logging for troubleshooting:

- **🎬** Preview generation attempts
- **✅** Successful operations
- **❌** Failed operations
- **⚠️** Warnings and fallbacks
- **🔧** FFmpeg command details

## Performance Considerations

1. **Sequential Processing**: Fallbacks are tried sequentially to avoid system overload
2. **Batch Limits**: Smaller batch sizes (3-5) for preview generation
3. **Resource Management**: Delays between batches to prevent FFmpeg conflicts
4. **Validation**: Early validation prevents unnecessary processing

## Troubleshooting

### Common Issues

1. **FFmpeg Not Found**
   - Ensure FFmpeg is installed and in PATH
   - Check with: `ffmpeg -version`

2. **Codec Not Supported**
   - Check available codecs: `ffmpeg -codecs | grep -E "(aac|alac|libx264)"`
   - Install required codec packages

3. **Permission Issues**
   - Ensure write permissions to preview directories
   - Check disk space availability

4. **File Validation Failures**
   - Check FFprobe availability: `ffprobe -version`
   - Verify input file integrity

### Debug Mode

Enable detailed logging by checking server logs during preview generation. Each fallback attempt is logged with specific error messages and FFmpeg output.

## Future Enhancements

1. **Adaptive Quality**: Automatically adjust quality based on source resolution
2. **Codec Detection**: Pre-analyze audio codecs before processing
3. **Parallel Processing**: Safe parallel processing for different media files
4. **Progress Tracking**: Real-time progress updates for batch operations
5. **Custom Fallback Rules**: Configurable fallback strategies per media type