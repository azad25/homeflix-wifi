#!/usr/bin/env python3
"""
Subtitle Processing Tasks
Low-priority queue for subtitle extraction, conversion, and synchronization
"""

import os
import subprocess
import logging
from typing import Dict, Any, List
from celery import current_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@current_app.task(bind=True, queue='subtitles', priority=3, max_retries=2)
def extract_embedded_subtitles(self, media_id: int, file_path: str, output_dir: str = None) -> Dict[str, Any]:
    """
    Extract embedded subtitles from video file
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the video file
        output_dir: Directory to save extracted subtitles
        
    Returns:
        Dict with subtitle extraction results
    """
    try:
        logger.info(f"📝 Extracting embedded subtitles for media ID {media_id}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Video file not found: {file_path}")
        
        # Set output directory
        if not output_dir:
            output_dir = os.getenv('SUBTITLE_DIR', './subtitles')
        
        os.makedirs(output_dir, exist_ok=True)
        
        # First, check what subtitle streams are available
        subtitle_streams = get_subtitle_streams(file_path)
        
        if not subtitle_streams:
            return {
                'status': 'no_subtitles',
                'media_id': media_id,
                'message': 'No embedded subtitles found'
            }
        
        extracted_subtitles = []
        
        for stream in subtitle_streams:
            try:
                # Generate subtitle filename
                lang = stream.get('language', 'unknown')
                subtitle_filename = f"subtitle_{media_id}_{lang}_{stream['index']}.srt"
                subtitle_path = os.path.join(output_dir, subtitle_filename)
                
                # FFmpeg command to extract subtitle
                cmd = [
                    'ffmpeg',
                    '-i', file_path,
                    '-map', f"0:s:{stream['stream_index']}",
                    '-c:s', 'srt',  # Convert to SRT format
                    '-y',
                    subtitle_path
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                
                if result.returncode == 0 and os.path.exists(subtitle_path):
                    file_size = os.path.getsize(subtitle_path)
                    
                    extracted_subtitles.append({
                        'language': lang,
                        'path': subtitle_path,
                        'size': file_size,
                        'stream_index': stream['stream_index'],
                        'codec': stream.get('codec', 'unknown'),
                        'status': 'success'
                    })
                    
                    logger.info(f"✅ Extracted subtitle: {lang} ({file_size} bytes)")
                else:
                    extracted_subtitles.append({
                        'language': lang,
                        'stream_index': stream['stream_index'],
                        'status': 'failed',
                        'error': result.stderr
                    })
                    
            except Exception as e:
                extracted_subtitles.append({
                    'language': stream.get('language', 'unknown'),
                    'stream_index': stream['stream_index'],
                    'status': 'failed',
                    'error': str(e)
                })
        
        successful = len([s for s in extracted_subtitles if s['status'] == 'success'])
        
        if successful > 0:
            # Update database with extracted subtitles
            update_subtitles_in_database(media_id, extracted_subtitles)
        
        logger.info(f"📊 Extracted {successful}/{len(subtitle_streams)} subtitles for media ID {media_id}")
        
        return {
            'status': 'completed',
            'media_id': media_id,
            'total_streams': len(subtitle_streams),
            'successful': successful,
            'subtitles': extracted_subtitles
        }
        
    except Exception as exc:
        logger.error(f"❌ Subtitle extraction failed for media ID {media_id}: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = 60 * (self.request.retries + 1)
            logger.info(f"🔄 Retrying subtitle extraction in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
        }

@current_app.task(queue='subtitles', priority=2)
def convert_subtitle_format(media_id: int, subtitle_path: str, target_format: str = 'vtt') -> Dict[str, Any]:
    """
    Convert subtitle file to different format (SRT to VTT, etc.)
    
    Args:
        media_id: Database ID of the media
        subtitle_path: Path to the subtitle file
        target_format: Target format ('vtt', 'srt', 'ass')
        
    Returns:
        Dict with conversion results
    """
    try:
        logger.info(f"🔄 Converting subtitle format for media ID {media_id} to {target_format}")
        
        if not os.path.exists(subtitle_path):
            raise FileNotFoundError(f"Subtitle file not found: {subtitle_path}")
        
        # Generate output filename
        base_name = os.path.splitext(subtitle_path)[0]
        output_path = f"{base_name}.{target_format}"
        
        # FFmpeg command for subtitle conversion
        cmd = [
            'ffmpeg',
            '-i', subtitle_path,
            '-c:s', target_format,
            '-y',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            raise Exception(f"FFmpeg conversion error: {result.stderr}")
        
        if not os.path.exists(output_path):
            raise Exception("Converted subtitle file was not created")
        
        file_size = os.path.getsize(output_path)
        logger.info(f"✅ Subtitle converted to {target_format}: {os.path.basename(output_path)}")
        
        return {
            'status': 'success',
            'media_id': media_id,
            'original_path': subtitle_path,
            'converted_path': output_path,
            'format': target_format,
            'file_size': file_size
        }
        
    except Exception as e:
        logger.error(f"❌ Subtitle conversion failed for media ID {media_id}: {e}")
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(e)
        }

@current_app.task(queue='subtitles', priority=1)
def scan_external_subtitles(media_id: int, video_path: str) -> Dict[str, Any]:
    """
    Scan for external subtitle files in the same directory as video
    
    Args:
        media_id: Database ID of the media
        video_path: Path to the video file
        
    Returns:
        Dict with external subtitle scan results
    """
    try:
        logger.info(f"🔍 Scanning external subtitles for media ID {media_id}")
        
        video_dir = os.path.dirname(video_path)
        video_name = os.path.splitext(os.path.basename(video_path))[0]
        
        # Common subtitle extensions
        subtitle_extensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx']
        
        found_subtitles = []
        
        # Scan directory for subtitle files
        for file in os.listdir(video_dir):
            file_path = os.path.join(video_dir, file)
            
            if os.path.isfile(file_path):
                file_name, file_ext = os.path.splitext(file)
                
                if file_ext.lower() in subtitle_extensions:
                    # Check if subtitle belongs to this video
                    if video_name in file_name:
                        # Extract language from filename
                        language = extract_language_from_filename(file_name)
                        
                        found_subtitles.append({
                            'path': file_path,
                            'filename': file,
                            'language': language,
                            'format': file_ext[1:].lower(),  # Remove dot
                            'size': os.path.getsize(file_path)
                        })
        
        if found_subtitles:
            # Update database with external subtitles
            update_external_subtitles_in_database(media_id, found_subtitles)
            
            logger.info(f"✅ Found {len(found_subtitles)} external subtitles for media ID {media_id}")
            for sub in found_subtitles:
                logger.info(f"   📝 {sub['language']}: {sub['filename']}")
        else:
            logger.info(f"ℹ️ No external subtitles found for media ID {media_id}")
        
        return {
            'status': 'completed',
            'media_id': media_id,
            'subtitle_count': len(found_subtitles),
            'subtitles': found_subtitles
        }
        
    except Exception as e:
        logger.error(f"❌ External subtitle scan failed for media ID {media_id}: {e}")
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(e)
        }

def get_subtitle_streams(file_path: str) -> List[Dict[str, Any]]:
    """Get information about subtitle streams in video file"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 's',  # Only subtitle streams
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return []
        
        import json
        data = json.loads(result.stdout)
        streams = data.get('streams', [])
        
        subtitle_streams = []
        for i, stream in enumerate(streams):
            if stream.get('codec_type') == 'subtitle':
                subtitle_streams.append({
                    'index': i,
                    'stream_index': stream.get('index', i),
                    'codec': stream.get('codec_name', 'unknown'),
                    'language': stream.get('tags', {}).get('language', 'unknown'),
                    'title': stream.get('tags', {}).get('title', ''),
                    'disposition': stream.get('disposition', {})
                })
        
        return subtitle_streams
        
    except Exception as e:
        logger.error(f"Failed to get subtitle streams: {e}")
        return []

def extract_language_from_filename(filename: str) -> str:
    """Extract language code from subtitle filename"""
    import re
    
    # Common language patterns
    lang_patterns = {
        r'\.en\.': 'English',
        r'\.eng\.': 'English',
        r'\.es\.': 'Spanish',
        r'\.spa\.': 'Spanish',
        r'\.fr\.': 'French',
        r'\.fre\.': 'French',
        r'\.de\.': 'German',
        r'\.ger\.': 'German',
        r'\.it\.': 'Italian',
        r'\.ita\.': 'Italian',
        r'\.pt\.': 'Portuguese',
        r'\.por\.': 'Portuguese',
        r'\.ru\.': 'Russian',
        r'\.rus\.': 'Russian',
        r'\.ja\.': 'Japanese',
        r'\.jpn\.': 'Japanese',
        r'\.ko\.': 'Korean',
        r'\.kor\.': 'Korean',
        r'\.zh\.': 'Chinese',
        r'\.chi\.': 'Chinese',
        r'\.ar\.': 'Arabic',
        r'\.ara\.': 'Arabic'
    }
    
    filename_lower = filename.lower()
    
    for pattern, language in lang_patterns.items():
        if re.search(pattern, filename_lower):
            return language
    
    return 'Unknown'

def update_subtitles_in_database(media_id: int, subtitles: List[Dict]) -> bool:
    """Update extracted subtitles in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/subtitles",
            json={'subtitles': subtitles},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database subtitle update error: {e}")
        return False

def update_external_subtitles_in_database(media_id: int, subtitles: List[Dict]) -> bool:
    """Update external subtitles in database"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/external-subtitles",
            json={'external_subtitles': subtitles},
            timeout=10
        )
        
        return response.status_code == 200
        
    except Exception as e:
        logger.error(f"Database external subtitle update error: {e}")
        return False
