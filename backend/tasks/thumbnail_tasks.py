#!/usr/bin/env python3
"""
Thumbnail Generation Tasks
High-priority queue for generating video thumbnails and preview clips
"""

import os
import subprocess
import logging
import random
from typing import Dict, Any, Optional
from celery import current_app
from celery.utils.log import get_task_logger
import requests
from urllib.parse import urljoin

logger = get_task_logger(__name__)

def is_valid_video_file(file_path: str) -> bool:
    """
    Check if video file is valid and not problematic
    
    Args:
        file_path: Path to the video file
        
    Returns:
        True if file is valid for processing, False otherwise
    """
    try:
        # Skip files containing $RECYCLE.BIN in path
        if "$RECYCLE.BIN" in file_path.upper():
            logging.warning(f"Skipping recycle bin file: {file_path}")
            return False
        
        # Skip files starting with $
        filename = os.path.basename(file_path)
        if filename.startswith("$"):
            logging.warning(f"Skipping system file: {file_path}")
            return False
        
        # Check if file exists and is readable
        if not os.path.exists(file_path):
            logging.warning(f"File does not exist: {file_path}")
            return False
        
        # Check file size (skip very large files > 15GB)
        file_size = os.path.getsize(file_path)
        if file_size > 15 * 1024 * 1024 * 1024:  # 15GB
            logging.warning(f"Skipping very large file: {file_path} ({file_size / (1024**3):.1f}GB)")
            return False
        
        return True
        
    except Exception as e:
        logging.error(f"Error validating video file {file_path}: {e}")
        return False

# Logger already defined above

@current_app.task(bind=True, queue='thumbnails', priority=8, max_retries=2)
def generate_thumbnail(self, media_id: int, file_path: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Generate thumbnail image from video file
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        output_dir: Directory to save thumbnail (optional)
        
    Returns:
        Dict with thumbnail generation result
    """
    try:
        logger.info(f"🖼️ Generating thumbnail for media ID {media_id}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # Set output directory
        if not output_dir:
            output_dir = os.getenv('THUMBNAIL_DIR', './thumbnails')
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Get media title for better filename
        media_title = get_media_title_from_api(media_id)
        if media_title:
            # Clean title for filename (remove invalid characters)
            clean_title = sanitize_filename(media_title)
            thumbnail_filename = f"{clean_title}_thumb.jpg"
        else:
            # Fallback to media_id if title not available
            thumbnail_filename = f"thumb_{media_id}.jpg"
        
        thumbnail_path = os.path.join(output_dir, thumbnail_filename)
        
        # Inline validation to avoid NameError issues
        def validate_video_file_inline(file_path: str) -> bool:
            try:
                if "$RECYCLE.BIN" in file_path.upper():
                    logger.warning(f"Skipping recycle bin file: {file_path}")
                    return False
                filename = os.path.basename(file_path)
                if filename.startswith("$"):
                    logger.warning(f"Skipping system file: {file_path}")
                    return False
                if not os.path.exists(file_path):
                    logger.warning(f"File does not exist: {file_path}")
                    return False
                file_size = os.path.getsize(file_path)
                if file_size > 15 * 1024 * 1024 * 1024:
                    logger.warning(f"Skipping very large file: {file_path} ({file_size / (1024**3):.1f}GB)")
                    return False
                return True
            except Exception as e:
                logger.error(f"Error validating video file {file_path}: {e}")
                return False
        
        # Validate file before processing
        if not validate_video_file_inline(file_path):
            logger.warning(f"⚠️ Skipping invalid/problematic file: {file_path}")
            return {
                'status': 'skipped',
                'media_id': media_id,
                'message': 'Invalid or problematic video file'
            }
        
        # Get video duration for random timestamp selection
        duration = get_video_duration(file_path)
        if duration is None or duration < 30:
            # Fallback to fixed timestamp for very short videos
            seek_time = '00:00:10'
            logger.warning(f"Using fallback timestamp for short/unknown duration video: {file_path}")
        else:
            # Generate random timestamp between 10% and 70% of video duration
            min_time = duration * 0.10  # 10% into video
            max_time = duration * 0.70  # 70% into video
            random_time = random.uniform(min_time, max_time)
            
            # Convert to HH:MM:SS format
            hours = int(random_time // 3600)
            minutes = int((random_time % 3600) // 60)
            seconds = int(random_time % 60)
            seek_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            logger.info(f"🎯 Generating thumbnail at random timestamp {seek_time} ({random_time:.1f}s / {duration:.1f}s)")
        
        # FFmpeg command for HD thumbnail generation with random timestamp
        cmd = [
            'ffmpeg',
            '-threads', '0',  # Use all available threads
            '-ss', seek_time,  # Seek to random timestamp (10-70%)
            '-noaccurate_seek',  # Faster seeking
            '-i', file_path,
            '-vframes', '1',    # Extract 1 frame
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
            '-q:v', '2',        # High quality (1-31, lower is better)
            '-update', '1',     # Fix for single image output
            '-y',               # Overwrite existing
            thumbnail_path
        ]
        
        # Execute FFmpeg command with increased timeout
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120  # Increased timeout to 120 seconds
        )
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")
        
        if not os.path.exists(thumbnail_path):
            raise Exception("Thumbnail file was not created")
        
        # Get file size
        file_size = os.path.getsize(thumbnail_path)
        
        logger.info(f"✅ Thumbnail generated: {thumbnail_filename} ({file_size} bytes)")
        
        # Update database via API
        update_thumbnail_in_database(media_id, thumbnail_path)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'thumbnail_path': thumbnail_path,
            'file_size': file_size
        }
        
    except Exception as exc:
        logger.error(f"❌ Thumbnail generation failed for media ID {media_id}: {str(exc)}")
        
        # Don't retry on certain permanent failures
        permanent_failures = [
            'FileNotFoundError',
            'Invalid or problematic video file',
            'No such file or directory',
            'Permission denied'
        ]
        
        should_retry = not any(failure in str(exc) for failure in permanent_failures)
        
        if should_retry and self.request.retries < self.max_retries:
            retry_delay = 60 * (2 ** self.request.retries)  # Exponential backoff: 60s, 120s, 240s
            logger.info(f"🔄 Retrying thumbnail generation in {retry_delay} seconds (attempt {self.request.retries + 1})")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc),
            'permanent_failure': not should_retry
        }

@current_app.task(bind=True, queue='thumbnails', priority=7, max_retries=2)
def generate_preview_clip(self, media_id: int, file_path: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Generate preview clip for Netflix-style hover playback
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        output_dir: Directory to save preview clip
        
    Returns:
        Dict with preview clip generation result
    """
    try:
        logger.info(f"🎬 Generating preview clip for media ID {media_id}")
        
        # Inline validation to avoid NameError issues
        def validate_video_file(file_path: str) -> bool:
            try:
                if "$RECYCLE.BIN" in file_path.upper():
                    logger.warning(f"Skipping recycle bin file: {file_path}")
                    return False
                filename = os.path.basename(file_path)
                if filename.startswith("$"):
                    logger.warning(f"Skipping system file: {file_path}")
                    return False
                if not os.path.exists(file_path):
                    logger.warning(f"File does not exist: {file_path}")
                    return False
                file_size = os.path.getsize(file_path)
                if file_size > 15 * 1024 * 1024 * 1024:
                    logger.warning(f"Skipping very large file: {file_path} ({file_size / (1024**3):.1f}GB)")
                    return False
                return True
            except Exception as e:
                logger.error(f"Error validating video file {file_path}: {e}")
                return False
        
        # Inline validation to avoid NameError issues
        def validate_video_file_inline(file_path: str) -> bool:
            try:
                if "$RECYCLE.BIN" in file_path.upper():
                    logger.warning(f"Skipping recycle bin file: {file_path}")
                    return False
                filename = os.path.basename(file_path)
                if filename.startswith("$"):
                    logger.warning(f"Skipping system file: {file_path}")
                    return False
                if not os.path.exists(file_path):
                    logger.warning(f"File does not exist: {file_path}")
                    return False
                file_size = os.path.getsize(file_path)
                if file_size > 15 * 1024 * 1024 * 1024:
                    logger.warning(f"Skipping very large file: {file_path} ({file_size / (1024**3):.1f}GB)")
                    return False
                return True
            except Exception as e:
                logger.error(f"Error validating video file {file_path}: {e}")
                return False
        
        # Validate file before processing
        if not validate_video_file_inline(file_path):
            logger.warning(f"⚠️ Skipping invalid/problematic file: {file_path}")
            return {
                'status': 'skipped',
                'media_id': media_id,
                'message': 'Invalid or problematic video file'
            }
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # Set output directory
        if not output_dir:
            output_dir = os.getenv('PREVIEW_DIR', './previews')
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Get media title for better filename
        media_title = get_media_title_from_api(media_id)
        if media_title:
            # Clean title for filename (remove invalid characters)
            clean_title = sanitize_filename(media_title)
            preview_filename = f"{clean_title}_preview.mp4"
        else:
            # Fallback to media_id if title not available
            preview_filename = f"preview_{media_id}.mp4"
        
        preview_path = os.path.join(output_dir, preview_filename)
        
        # Get video duration
        duration = get_video_duration(file_path)
        if duration is None:
            raise Exception("Could not determine video duration")
            
        # Adaptive preview duration based on video length
        if duration < 60:
            preview_duration = min(10, duration - 5)  # Short clips get 10s preview
            # For short videos, use random start between 10-70% but ensure minimum 5s buffer
            min_start = max(5, duration * 0.10)
            max_start = min(duration * 0.70, duration - preview_duration - 5)
            start_time = random.uniform(min_start, max_start) if max_start > min_start else min_start
        elif duration < 300:  # Less than 5 minutes
            preview_duration = 15
            # Random start between 10-70% of video duration
            min_start = duration * 0.10
            max_start = duration * 0.70
            start_time = random.uniform(min_start, max_start)
        else:
            preview_duration = 30
            # Random start between 10-70% of video duration
            min_start = duration * 0.10
            max_start = duration * 0.70
            start_time = random.uniform(min_start, max_start)
            
        # Ensure we don't go past the end
        if start_time + preview_duration > duration:
            start_time = max(0, duration - preview_duration - 5)
        
        # Format start time for FFmpeg
        hours = int(start_time // 3600)
        minutes = int((start_time % 3600) // 60)
        seconds = int(start_time % 60)
        start_time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}.000"
        
        logger.info(f"🎥 Generating {preview_duration}s HD preview from random timestamp {start_time_str} ({start_time:.1f}s / {duration:.1f}s)")
        
        # FFmpeg command for HD preview clip with optimizations and random timestamp
        cmd = [
            'ffmpeg',
            '-threads', '0',       # Use all available threads
            '-ss', start_time_str, # Start at random position (10-70%)
            '-noaccurate_seek',    # Faster seeking
            '-i', file_path,
            '-t', str(preview_duration),
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
            '-c:v', 'libx264',
            '-preset', 'faster',   # Balance between speed and quality
            '-crf', '20',          # Higher quality for HD preview (18-23 is good range)
            '-pix_fmt', 'yuv420p', # Compatibility
            '-movflags', '+faststart', # Fast web playback
            '-an',                 # No audio for preview clips
            '-avoid_negative_ts', 'make_zero',
            '-y',
            preview_path
        ]
        
        # Execute FFmpeg with robust error handling
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,  # Increased timeout for preview clips to 180 seconds
                cwd=os.path.dirname(output_dir) if output_dir else None
            )
            
            if result.returncode != 0:
                logger.error(f"FFmpeg failed for {file_path}: {result.stderr}")
                # Try simpler command as fallback with random timestamp
                fallback_start = random.uniform(duration * 0.10, duration * 0.70) if duration > 60 else 10
                fallback_hours = int(fallback_start // 3600)
                fallback_minutes = int((fallback_start % 3600) // 60)
                fallback_seconds = int(fallback_start % 60)
                fallback_time_str = f"{fallback_hours:02d}:{fallback_minutes:02d}:{fallback_seconds:02d}"
                
                logger.info(f"🔄 Fallback: Generating lower quality preview from {fallback_time_str}")
                
                simple_cmd = [
                    'ffmpeg',
                    '-threads', '0',
                    '-ss', fallback_time_str,  # Random fallback timestamp
                    '-noaccurate_seek',
                    '-i', file_path,
                    '-t', '10',
                    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',  # 720p fallback
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-crf', '25',  # Slightly better quality than 28
                    '-an',
                    '-y',
                    preview_path
                ]
                
                result = subprocess.run(
                    simple_cmd,
                    capture_output=True,
                    text=True,
                    timeout=240  # Increased timeout for fallback
                )
                
                if result.returncode != 0:
                    raise Exception(f"Both FFmpeg attempts failed: {result.stderr}")
                    
        except subprocess.TimeoutExpired:
            logger.error(f"FFmpeg timeout for {file_path}")
            raise Exception("FFmpeg process timed out")
        
        if not os.path.exists(preview_path):
            raise Exception("Preview clip was not created")
        
        # Get file size
        file_size = os.path.getsize(preview_path)
        
        logger.info(f"✅ Preview clip generated: {preview_filename} ({file_size} bytes)")
        
        # Update database via API
        update_preview_in_database(media_id, preview_path)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'preview_path': preview_path,
            'file_size': file_size
        }
        
    except Exception as exc:
        logger.error(f"❌ Preview clip generation failed for media ID {media_id}: {str(exc)}")
        
        # Don't retry on certain permanent failures
        permanent_failures = [
            'FileNotFoundError',
            'Invalid or problematic video file',
            'No such file or directory',
            'Permission denied'
        ]
        
        should_retry = not any(failure in str(exc) for failure in permanent_failures)
        
        if should_retry and self.request.retries < self.max_retries:
            retry_delay = 120 * (2 ** self.request.retries)  # Exponential backoff: 120s, 240s, 480s
            logger.info(f"🔄 Retrying preview generation in {retry_delay} seconds (attempt {self.request.retries + 1})")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc),
            'permanent_failure': not should_retry
        }

@current_app.task(queue='thumbnails', priority=6)
def generate_multiple_thumbnails(media_id: int, file_path: str, count: int = 5) -> Dict[str, Any]:
    """
    Generate multiple thumbnails at different timestamps
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        count: Number of thumbnails to generate
        
    Returns:
        Dict with multiple thumbnail results
    """
    logger.info(f"🖼️ Generating {count} thumbnails for media ID {media_id}")
    
    results = []
    output_dir = os.getenv('THUMBNAIL_DIR', './thumbnails')
    os.makedirs(output_dir, exist_ok=True)
    
    # Get video duration first
    duration = get_video_duration(file_path)
    if not duration:
        return {'status': 'failed', 'error': 'Could not determine video duration'}
    
    # Generate thumbnails at random intervals within 10-70% range
    for i in range(count):
        try:
            # Calculate random timestamp within 10-70% range for each thumbnail
            min_time = duration * 0.10
            max_time = duration * 0.70
            timestamp = random.uniform(min_time, max_time)
            
            # Get media title for better filename
            media_title = get_media_title_from_api(media_id)
            if media_title:
                clean_title = sanitize_filename(media_title)
                thumbnail_filename = f"{clean_title}_thumb_{i+1}.jpg"
            else:
                thumbnail_filename = f"thumb_{media_id}_{i+1}.jpg"
            thumbnail_path = os.path.join(output_dir, thumbnail_filename)
            
            cmd = [
                'ffmpeg',
                '-i', file_path,
                '-ss', str(timestamp),
                '-vframes', '1',
                '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
                '-q:v', '2',
                '-y',
                thumbnail_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            
            if result.returncode == 0 and os.path.exists(thumbnail_path):
                file_size = os.path.getsize(thumbnail_path)
                results.append({
                    'index': i + 1,
                    'timestamp': timestamp,
                    'path': thumbnail_path,
                    'size': file_size,
                    'status': 'success'
                })
                logger.info(f"✅ Thumbnail {i+1}/{count} generated at {timestamp}s")
            else:
                results.append({
                    'index': i + 1,
                    'timestamp': timestamp,
                    'status': 'failed',
                    'error': result.stderr.decode() if result.stderr else 'Unknown error'
                })
                
        except Exception as e:
            results.append({
                'index': i + 1,
                'status': 'failed',
                'error': str(e)
            })
    
    successful = len([r for r in results if r['status'] == 'success'])
    logger.info(f"📊 Generated {successful}/{count} thumbnails for media ID {media_id}")
    
    return {
        'status': 'completed',
        'media_id': media_id,
        'total': count,
        'successful': successful,
        'results': results
    }

def get_video_duration(file_path: str) -> float:
    """
    Get video duration in seconds using FFprobe
    
    Args:
        file_path: Path to the video file
        
    Returns:
        Duration in seconds as float, or None if could not determine
    """
    try:
        result = subprocess.run(
            ['ffprobe', 
             '-v', 'error', 
             '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', 
             file_path],
            capture_output=True,
            text=True,
            timeout=30  # Add timeout to prevent hanging
        )
        
        if result.returncode != 0:
            logger.error(f"FFprobe error: {result.stderr}")
            return None
            
        duration_str = result.stdout.strip()
        if not duration_str:
            logger.error("Empty duration string from FFprobe")
            return None
            
        duration = float(duration_str)
        if duration <= 0:
            logger.error(f"Invalid duration: {duration}")
            return None
            
        return duration
        
    except subprocess.TimeoutExpired:
        logger.error("FFprobe timed out while getting video duration")
        return None
    except ValueError as e:
        logger.error(f"Failed to parse duration: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error getting video duration: {e}")
        return None

def update_thumbnail_in_database(media_id: int, thumbnail_path: str) -> bool:
    """Update media thumbnail path in database using admin API"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/thumbnail",
            json={'thumbnail_path': thumbnail_path},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Database updated: thumbnail path for media {media_id}")
            return True
        else:
            logger.error(f"❌ Database update failed: {response.status_code} - {response.text}")
            return False
        
    except Exception as e:
        logger.error(f"❌ Database thumbnail update error: {e}")
        return False


def get_media_title_from_api(media_id: int) -> str:
    """Get media title from API using UUID lookup"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        # First get the media UUID from the admin endpoint
        admin_response = requests.get(
            f"{api_url}/api/admin/media/{media_id}",
            timeout=5
        )
        
        if admin_response.status_code == 200:
            media_data = admin_response.json()
            return media_data.get('title', '')
        
        return ''
        
    except Exception as e:
        logger.error(f"API title fetch error: {e}")
        return ''


def sanitize_filename(filename: str) -> str:
    """Remove invalid characters from filename"""
    import re
    # Remove invalid characters for filenames
    sanitized = re.sub(r'[<>:"/\\|?*]', '', filename)
    # Replace spaces with underscores
    sanitized = sanitized.replace(' ', '_')
    # Limit length to 100 characters
    sanitized = sanitized[:100]
    return sanitized

def update_preview_in_database(media_id: int, preview_path: str) -> bool:
    """Update media preview clip path in database using admin API"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/preview",
            json={'preview_path': preview_path},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Database updated: preview path for media {media_id}")
            return True
        else:
            logger.error(f"❌ Database update failed: {response.status_code} - {response.text}")
            return False
        
    except Exception as e:
        logger.error(f"❌ Database preview update error: {e}")
        return False
