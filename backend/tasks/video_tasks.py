#!/usr/bin/env python3
"""
Video Processing Tasks
Medium-priority queue for video analysis, encoding, and optimization
"""

import os
import subprocess
import json
import logging
from typing import Dict, Any, List
from celery import current_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@current_app.task(bind=True, queue='video_processing', priority=5, max_retries=2)
def analyze_video_metadata(self, media_id: int, file_path: str) -> Dict[str, Any]:
    """
    Analyze video file to extract technical metadata using FFprobe
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        
    Returns:
        Dict with video analysis results
    """
    try:
        logger.info(f"🔍 Analyzing video metadata for media ID {media_id}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # FFprobe command to extract comprehensive metadata
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            '-show_chapters',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise Exception(f"FFprobe error: {result.stderr}")
        
        # Parse FFprobe output
        probe_data = json.loads(result.stdout)
        
        # Extract relevant information
        metadata = extract_video_info(probe_data)
        metadata['media_id'] = media_id
        metadata['file_path'] = file_path
        metadata['file_size'] = os.path.getsize(file_path)
        
        logger.info(f"✅ Video analysis complete for media ID {media_id}")
        logger.info(f"   📹 Resolution: {metadata.get('resolution', 'Unknown')}")
        logger.info(f"   ⏱️ Duration: {metadata.get('duration_formatted', 'Unknown')}")
        logger.info(f"   🎵 Audio: {metadata.get('audio_codec', 'Unknown')}")
        logger.info(f"   📼 Video: {metadata.get('video_codec', 'Unknown')}")
        
        # Update database with technical metadata
        update_video_metadata_in_database(media_id, metadata)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'metadata': metadata
        }
        
    except Exception as exc:
        logger.error(f"❌ Video analysis failed for media ID {media_id}: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = 60 * (self.request.retries + 1)
            logger.info(f"🔄 Retrying video analysis in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
        }

@current_app.task(bind=True, queue='video_processing', priority=4, max_retries=1)
def optimize_video_for_streaming(self, media_id: int, file_path: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Optimize video file for web streaming (create web-optimized version)
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the original video file
        output_dir: Directory to save optimized video
        
    Returns:
        Dict with optimization results
    """
    try:
        logger.info(f"⚡ Optimizing video for streaming: media ID {media_id}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # Set output directory
        if not output_dir:
            output_dir = os.getenv('OPTIMIZED_DIR', './optimized')
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate optimized filename
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        optimized_filename = f"{base_name}_optimized.mp4"
        optimized_path = os.path.join(output_dir, optimized_filename)
        
        # FFmpeg command for web optimization
        cmd = [
            'ffmpeg',
            '-i', file_path,
            '-c:v', 'libx264',          # H.264 codec
            '-preset', 'medium',        # Encoding speed vs compression
            '-crf', '23',               # Quality (lower = better)
            '-maxrate', '2M',           # Max bitrate
            '-bufsize', '4M',           # Buffer size
            '-vf', 'scale=-2:720',      # Scale to 720p, maintain aspect ratio
            '-c:a', 'aac',              # AAC audio codec
            '-b:a', '128k',             # Audio bitrate
            '-movflags', '+faststart',  # Web optimization
            '-y',                       # Overwrite existing
            optimized_path
        ]
        
        # Execute FFmpeg with progress tracking
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout for large files
        )
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg optimization error: {result.stderr}")
        
        if not os.path.exists(optimized_path):
            raise Exception("Optimized video file was not created")
        
        # Get file sizes for comparison
        original_size = os.path.getsize(file_path)
        optimized_size = os.path.getsize(optimized_path)
        compression_ratio = (1 - optimized_size / original_size) * 100
        
        logger.info(f"✅ Video optimization complete for media ID {media_id}")
        logger.info(f"   📦 Original: {format_file_size(original_size)}")
        logger.info(f"   📦 Optimized: {format_file_size(optimized_size)}")
        logger.info(f"   💾 Compression: {compression_ratio:.1f}%")
        
        # Update database with optimized video path
        update_optimized_video_in_database(media_id, optimized_path)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'optimized_path': optimized_path,
            'original_size': original_size,
            'optimized_size': optimized_size,
            'compression_ratio': compression_ratio
        }
        
    except Exception as exc:
        logger.error(f"❌ Video optimization failed for media ID {media_id}: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = 300  # 5 minutes
            logger.info(f"🔄 Retrying video optimization in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
        }

@current_app.task(queue='video_processing', priority=3)
def extract_video_chapters(media_id: int, file_path: str) -> Dict[str, Any]:
    """
    Extract chapter information from video file
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        
    Returns:
        Dict with chapter extraction results
    """
    try:
        logger.info(f"📚 Extracting chapters for media ID {media_id}")
        
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_chapters',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return {'status': 'no_chapters', 'media_id': media_id}
        
        data = json.loads(result.stdout)
        chapters = data.get('chapters', [])
        
        if not chapters:
            return {'status': 'no_chapters', 'media_id': media_id}
        
        # Process chapters
        processed_chapters = []
        for i, chapter in enumerate(chapters):
            processed_chapters.append({
                'index': i + 1,
                'title': chapter.get('tags', {}).get('title', f'Chapter {i + 1}'),
                'start_time': float(chapter.get('start_time', 0)),
                'end_time': float(chapter.get('end_time', 0)),
                'duration': float(chapter.get('end_time', 0)) - float(chapter.get('start_time', 0))
            })
        
        logger.info(f"✅ Found {len(processed_chapters)} chapters for media ID {media_id}")
        
        # Update database with chapters
        update_chapters_in_database(media_id, processed_chapters)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'chapters': processed_chapters,
            'chapter_count': len(processed_chapters)
        }
        
    except Exception as e:
        logger.error(f"Chapter extraction failed for media ID {media_id}: {e}")
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(e)
        }

def extract_video_info(probe_data: Dict) -> Dict[str, Any]:
    """Extract useful information from FFprobe data"""
    info = {}
    
    # Format information
    format_info = probe_data.get('format', {})
    info['duration'] = float(format_info.get('duration', 0))
    info['duration_formatted'] = format_duration(info['duration'])
    info['bitrate'] = int(format_info.get('bit_rate', 0))
    info['format_name'] = format_info.get('format_name', '')
    
    # Stream information
    streams = probe_data.get('streams', [])
    
    # Video stream info
    video_stream = next((s for s in streams if s.get('codec_type') == 'video'), None)
    if video_stream:
        info['video_codec'] = video_stream.get('codec_name', '')
        info['width'] = video_stream.get('width', 0)
        info['height'] = video_stream.get('height', 0)
        info['resolution'] = f"{info['width']}x{info['height']}" if info['width'] and info['height'] else ''
        info['fps'] = eval_fps(video_stream.get('r_frame_rate', '0/1'))
        info['video_bitrate'] = int(video_stream.get('bit_rate', 0))
    
    # Audio stream info
    audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
    if audio_streams:
        audio_stream = audio_streams[0]  # Primary audio stream
        info['audio_codec'] = audio_stream.get('codec_name', '')
        info['audio_channels'] = audio_stream.get('channels', 0)
        info['audio_sample_rate'] = audio_stream.get('sample_rate', 0)
        info['audio_bitrate'] = int(audio_stream.get('bit_rate', 0))
        info['audio_language'] = audio_stream.get('tags', {}).get('language', 'unknown')
    
    # Subtitle streams
    subtitle_streams = [s for s in streams if s.get('codec_type') == 'subtitle']
    info['subtitle_count'] = len(subtitle_streams)
    info['subtitle_languages'] = [
        s.get('tags', {}).get('language', 'unknown') 
        for s in subtitle_streams
    ]
    
    return info

def eval_fps(fps_string: str) -> float:
    """Evaluate FPS from FFprobe fraction string"""
    try:
        if '/' in fps_string:
            num, den = fps_string.split('/')
            return float(num) / float(den) if float(den) != 0 else 0
        return float(fps_string)
    except:
        return 0.0

def format_duration(seconds: float) -> str:
    """Format duration in seconds to HH:MM:SS"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"

def update_video_metadata_in_database(media_id: int, metadata: Dict[str, Any]) -> bool:
    """Update video technical metadata in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/video-metadata",
            json=metadata,
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database video metadata update error: {e}")
        return False

def update_optimized_video_in_database(media_id: int, optimized_path: str) -> bool:
    """Update optimized video path in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/optimized",
            json={'optimized_path': optimized_path},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database optimized video update error: {e}")
        return False

def update_chapters_in_database(media_id: int, chapters: List[Dict]) -> bool:
    """Update video chapters in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/chapters",
            json={'chapters': chapters},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database chapters update error: {e}")
        return False
