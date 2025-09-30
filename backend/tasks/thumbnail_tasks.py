#!/usr/bin/env python3
"""
Thumbnail Generation Tasks
High-priority queue for generating video thumbnails and preview clips
"""

import os
import subprocess
import logging
from typing import Dict, Any, List
from celery import current_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

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
        
        # Generate thumbnail filename
        thumbnail_filename = f"thumb_{media_id}.jpg"
        thumbnail_path = os.path.join(output_dir, thumbnail_filename)
        
        # FFmpeg command for thumbnail generation
        cmd = [
            'ffmpeg',
            '-i', file_path,
            '-ss', '00:01:00',  # Seek to 1 minute
            '-vframes', '1',    # Extract 1 frame
            '-vf', 'scale=320:180',  # Resize to 320x180
            '-q:v', '2',        # High quality
            '-y',               # Overwrite existing
            thumbnail_path
        ]
        
        # Execute FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
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
        
        if self.request.retries < self.max_retries:
            retry_delay = 30 * (self.request.retries + 1)
            logger.info(f"🔄 Retrying thumbnail generation in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
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
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # Set output directory
        if not output_dir:
            output_dir = os.getenv('PREVIEW_DIR', './previews')
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate preview clip filename
        preview_filename = f"preview_{media_id}.mp4"
        preview_path = os.path.join(output_dir, preview_filename)
        
        # FFmpeg command for preview clip (10 seconds from 2 minutes in)
        cmd = [
            'ffmpeg',
            '-i', file_path,
            '-ss', '00:02:00',      # Start at 2 minutes
            '-t', '00:00:10',       # Duration 10 seconds
            '-vf', 'scale=640:360', # Resize for web
            '-c:v', 'libx264',      # H.264 codec
            '-preset', 'fast',      # Fast encoding
            '-crf', '28',           # Compression
            '-an',                  # No audio
            '-y',                   # Overwrite existing
            preview_path
        ]
        
        # Execute FFmpeg
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr}")
        
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
        
        if self.request.retries < self.max_retries:
            retry_delay = 60 * (self.request.retries + 1)
            logger.info(f"🔄 Retrying preview generation in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
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
    
    # Generate thumbnails at evenly spaced intervals
    for i in range(count):
        try:
            # Calculate timestamp (skip first 10% and last 10%)
            timestamp = int((duration * 0.1) + (i * (duration * 0.8) / count))
            
            thumbnail_filename = f"thumb_{media_id}_{i+1}.jpg"
            thumbnail_path = os.path.join(output_dir, thumbnail_filename)
            
            cmd = [
                'ffmpeg',
                '-i', file_path,
                '-ss', str(timestamp),
                '-vframes', '1',
                '-vf', 'scale=320:180',
                '-q:v', '2',
                '-y',
                thumbnail_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            
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

def get_video_duration(file_path: str) -> int:
    """Get video duration in seconds using FFprobe"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            duration = float(data['format']['duration'])
            return int(duration)
            
    except Exception as e:
        logger.error(f"Failed to get video duration: {e}")
    
    return None

def update_thumbnail_in_database(media_id: int, thumbnail_path: str) -> bool:
    """Update media thumbnail path in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/thumbnail",
            json={'thumbnail_path': thumbnail_path},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database thumbnail update error: {e}")
        return False

def update_preview_in_database(media_id: int, preview_path: str) -> bool:
    """Update media preview clip path in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/preview",
            json={'preview_path': preview_path},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database preview update error: {e}")
        return False
