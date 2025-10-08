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
        
        # Set output directory - prefer root folder
        if not output_dir:
            output_dir = os.getenv('THUMBNAIL_DIR', './thumbnails')
        
        # Ensure both root and backend directories exist
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs('./thumbnails', exist_ok=True)
        os.makedirs('./previews', exist_ok=True)
        os.makedirs('./posters', exist_ok=True)
        
        # Use root folder for new thumbnails
        if output_dir.startswith('./backend/'):
            output_dir = './thumbnails'
        
        # Generate thumbnail filename
        thumbnail_filename = f"thumb_{media_id}.jpg"
        thumbnail_path = os.path.join(output_dir, thumbnail_filename)
        
        # Try HD thumbnail generation first
        success = False
        error_msg = ""
        
        # Method 1: Optimized CUDA thumbnail for GTX 1050 Ti (4GB VRAM)
        try:
            duration = get_video_duration(file_path)
            if duration:
                # Use random seek time between 10-70% of video duration
                import random
                seek_percent = random.uniform(0.1, 0.7)
                seek_time = int(duration * seek_percent)
            else:
                seek_time = 30
            
            cmd = [
                'ffmpeg',
                '-hwaccel', 'cuda',
                '-hwaccel_device', '0',
                '-i', file_path,
                '-ss', str(seek_time),
                '-vframes', '1',
                '-vf', 'scale_cuda=1280:720:force_original_aspect_ratio=decrease',  # Reduced resolution for VRAM
                '-q:v', '3',            # Slightly lower quality to reduce memory usage
                '-pix_fmt', 'yuv420p',
                '-y',
                thumbnail_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and os.path.exists(thumbnail_path):
                success = True
            else:
                error_msg = result.stderr
                logger.error(f"CUDA thumbnail generation failed: {error_msg}")
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"CUDA thumbnail generation exception: {error_msg}")
        
        # Method 2: COMMENTED OUT - Software fallback causes system crashes
        # Only use CUDA hardware acceleration to prevent system overload
        # if not success:
        #     logger.warning(f"HD thumbnail failed, trying fallback method: {error_msg}")
        #     try:
        #         cmd = [
        #             'ffmpeg',
        #             '-i', file_path,
        #             '-ss', '30',        # 30 seconds
        #             '-vframes', '1',
        #             '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        #             '-q:v', '3',
        #             '-pix_fmt', 'yuvj420p',
        #             '-y',
        #             thumbnail_path
        #         ]
        #         
        #         result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        #         
        #         if result.returncode == 0 and os.path.exists(thumbnail_path):
        #             success = True
        #         else:
        #             error_msg = result.stderr
        #             
        #     except Exception as e:
        #         error_msg = str(e)
        
        # Method 3: COMMENTED OUT - Skip placeholder creation, only use CUDA
        # Only proceed if CUDA hardware acceleration succeeds
        if not success:
            logger.error(f"CUDA thumbnail generation failed, skipping software fallback: {error_msg}")
            raise Exception(f"CUDA thumbnail generation failed (software fallback disabled): {error_msg}")
        #     success = create_placeholder_thumbnail(media_id, thumbnail_path)
        #     if not success:
        #         raise Exception(f"All thumbnail generation methods failed: {error_msg}")
        
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
        
        # Set output directory - prefer root folder
        if not output_dir:
            output_dir = os.getenv('PREVIEW_DIR', './previews')
        
        # Ensure directories exist
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs('./previews', exist_ok=True)
        
        # Use root folder for new previews
        if output_dir.startswith('./backend/'):
            output_dir = './previews'
        
        # Generate preview clip filename
        preview_filename = f"preview_{media_id}.mp4"
        preview_path = os.path.join(output_dir, preview_filename)
        
        # Try HD preview generation with fallback methods
        success = False
        error_msg = ""
        
        # Method 1: Optimized CUDA preview for GTX 1050 Ti (4GB VRAM)
        try:
            duration = get_video_duration(file_path)
            if duration:
                # Use first half of video, random start time
                import random
                first_half = duration // 2
                start_time = random.randint(30, max(60, first_half - 15))
            else:
                start_time = 60
            
            cmd = [
                'ffmpeg',
                '-hwaccel', 'cuda',
                '-hwaccel_device', '0',
                '-i', file_path,
                '-ss', str(start_time),
                '-t', '10',             # Reduced to 10 seconds to save VRAM
                '-vf', 'scale_cuda=1280:720:force_original_aspect_ratio=decrease',  # Lower resolution for stability
                '-c:v', 'h264_nvenc',
                '-preset', 'p6',        # Faster preset to reduce processing time
                '-crf', '23',           # Balanced quality/size
                '-c:a', 'aac',
                '-b:a', '96k',          # Lower audio bitrate
                '-movflags', '+faststart',
                '-pix_fmt', 'yuv420p',
                '-y',
                preview_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and os.path.exists(preview_path):
                success = True
            else:
                error_msg = result.stderr
                logger.error(f"CUDA preview generation failed: {error_msg}")
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"CUDA preview generation exception: {error_msg}")
        
        # Method 2: COMMENTED OUT - Software fallback causes system crashes
        # Only use CUDA hardware acceleration to prevent system overload
        # if not success:
        #     logger.warning(f"HD preview failed, trying fallback method: {error_msg}")
        #     try:
        #         cmd = [
        #             'ffmpeg',
        #             '-i', file_path,
        #             '-ss', '60',            # 1 minute
        #             '-t', '15',             # 15 seconds
        #             '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        #             '-c:v', 'libx264',
        #             '-preset', 'ultrafast',
        #             '-crf', '25',
        #             '-c:a', 'aac',
        #             '-b:a', '128k',
        #             '-pix_fmt', 'yuv420p',
        #             '-y',
        #             preview_path
        #         ]
        #         
        #         result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        #         
        #         if result.returncode == 0 and os.path.exists(preview_path):
        #             success = True
        #         else:
        #             error_msg = result.stderr
        #             
        #     except Exception as e:
        #         error_msg = str(e)
        
        # Method 3: COMMENTED OUT - Skip placeholder creation, only use CUDA
        # Only proceed if CUDA hardware acceleration succeeds
        if not success:
            logger.error(f"CUDA preview generation failed, skipping software fallback: {error_msg}")
            raise Exception(f"CUDA preview generation failed (software fallback disabled): {error_msg}")
        #     success = create_placeholder_preview(media_id, preview_path)
        #     if not success:
        #         raise Exception(f"All preview generation methods failed: {error_msg}")
        
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
                '-hwaccel', 'cuda',
                '-hwaccel_output_format', 'cuda',
                '-i', file_path,
                '-ss', str(timestamp),
                '-vframes', '1',
                '-vf', 'scale_cuda=320:180',
                '-c:v', 'h264_nvenc',
                '-preset', 'p4',
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
        api_url = os.getenv('API_URL', 'http://localhost:8252')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/thumbnail",
            json={'thumbnail_path': thumbnail_path},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Updated thumbnail path in database for media {media_id}")
            return True
        else:
            logger.warning(f"⚠️ Failed to update thumbnail path: HTTP {response.status_code}")
            return False
        
    except Exception as e:
        logger.error(f"Database thumbnail update error: {e}")
        return False

def update_preview_in_database(media_id: int, preview_path: str) -> bool:
    """Update media preview clip path in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8252')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/preview",
            json={'preview_path': preview_path},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Updated preview path in database for media {media_id}")
            return True
        else:
            logger.warning(f"⚠️ Failed to update preview path: HTTP {response.status_code}")
            return False
        
    except Exception as e:
        logger.error(f"Database preview update error: {e}")
        return False

def create_placeholder_thumbnail(media_id: int, thumbnail_path: str) -> bool:
    """COMMENTED OUT - Create a placeholder thumbnail using ImageMagick or FFmpeg
    Disabled to prevent software encoding fallback that causes system crashes
    """
    # COMMENTED OUT - Software encoding causes system crashes
    # Only use CUDA hardware acceleration
    logger.warning(f"Placeholder thumbnail creation disabled for media {media_id} - CUDA required")
    return False
    
    # try:
    #     # Try ImageMagick first
    #     cmd = [
    #         'convert',
    #         '-size', '1920x1080',
    #         'xc:black',
    #         '-fill', 'white',
    #         '-gravity', 'center',
    #         '-pointsize', '72',
    #         '-annotate', '+0+0', f'Media {media_id}\\nThumbnail\\nUnavailable',
    #         thumbnail_path
    #     ]
    #     
    #     result = subprocess.run(cmd, capture_output=True, timeout=30)
    #     if result.returncode == 0 and os.path.exists(thumbnail_path):
    #         logger.info(f"Created placeholder thumbnail with ImageMagick: {thumbnail_path}")
    #         return True
    #         
    # except Exception:
    #     pass
    # 
    # try:
    #     # Fallback to FFmpeg
    #     cmd = [
    #         'ffmpeg',
    #         '-f', 'lavfi',
    #         '-i', 'color=black:size=1920x1080:duration=0.1:rate=1',
    #         '-vf', f'drawtext=text="Thumbnail\\nUnavailable\\nMedia {media_id}":fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2',
    #         '-frames:v', '1',
    #         '-y',
    #         thumbnail_path
    #     ]
    #     
    #     result = subprocess.run(cmd, capture_output=True, timeout=30)
    #     if result.returncode == 0 and os.path.exists(thumbnail_path):
    #         logger.info(f"Created placeholder thumbnail with FFmpeg: {thumbnail_path}")
    #         return True
    #         
    # except Exception:
    #     pass
    # 
    # return False

def create_placeholder_preview(media_id: int, preview_path: str) -> bool:
    """COMMENTED OUT - Create a placeholder preview clip using FFmpeg
    Disabled to prevent software encoding fallback that causes system crashes
    """
    # COMMENTED OUT - Software encoding causes system crashes
    # Only use CUDA hardware acceleration
    logger.warning(f"Placeholder preview creation disabled for media {media_id} - CUDA required")
    return False
    
    # try:
    #     cmd = [
    #         'ffmpeg',
    #         '-f', 'lavfi',
    #         '-i', 'color=black:size=1280x720:duration=10:rate=25',
    #         '-vf', f'drawtext=text="Preview\\nUnavailable\\nMedia {media_id}":fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2',
    #         '-c:v', 'libx264',
    #         '-preset', 'ultrafast',
    #         '-crf', '30',
    #         '-pix_fmt', 'yuv420p',
    #         '-y',
    #         preview_path
    #     ]
    #     
    #     result = subprocess.run(cmd, capture_output=True, timeout=60)
    #     if result.returncode == 0 and os.path.exists(preview_path):
    #         logger.info(f"Created placeholder preview with FFmpeg: {preview_path}")
    #         return True
    #         
    # except Exception as e:
    #     logger.error(f"Failed to create placeholder preview: {e}")
    # 
    # return False
