#!/usr/bin/env python3
"""
Poster Download Tasks
Medium-priority queue for downloading movie/TV show posters from external APIs
"""

import os
import requests
import logging
from typing import Dict, Any, Optional
from celery import current_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

# TMDB API configuration
TMDB_API_KEY = os.getenv('TMDB_API_KEY', '')
TMDB_BASE_URL = 'https://api.themoviedb.org/3'
TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

@current_app.task(bind=True, queue='posters', priority=6, max_retries=3)
def download_poster(self, media_id: int, title: str, year: int = None, media_type: str = 'movie') -> Dict[str, Any]:
    """
    Download poster for media from TMDB or fallback sources
    
    Args:
        media_id: Database ID of the media
        title: Title of the movie/show
        year: Release year (optional)
        media_type: 'movie' or 'tv'
        
    Returns:
        Dict with poster download result
    """
    try:
        logger.info(f"🖼️ Downloading poster for media ID {media_id}: {title}")
        
        # Create posters directory
        poster_dir = os.getenv('POSTER_DIR', './posters')
        os.makedirs(poster_dir, exist_ok=True)
        
        # Try TMDB first
        poster_url = None
        if TMDB_API_KEY:
            poster_url = search_tmdb_poster(title, year, media_type)
        
        # Fallback to other sources if TMDB fails
        if not poster_url:
            poster_url = search_fallback_poster(title, year)
        
        if not poster_url:
            raise Exception("No poster found from any source")
        
        # Download poster
        poster_filename = f"poster_{media_id}.jpg"
        poster_path = os.path.join(poster_dir, poster_filename)
        
        response = requests.get(poster_url, timeout=30, stream=True)
        response.raise_for_status()
        
        with open(poster_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Verify file was created and has content
        if not os.path.exists(poster_path) or os.path.getsize(poster_path) == 0:
            raise Exception("Downloaded poster file is empty or missing")
        
        file_size = os.path.getsize(poster_path)
        logger.info(f"✅ Poster downloaded: {poster_filename} ({file_size} bytes)")
        
        # Update database
        update_poster_in_database(media_id, poster_path)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'poster_path': poster_path,
            'file_size': file_size,
            'source_url': poster_url
        }
        
    except Exception as exc:
        logger.error(f"❌ Poster download failed for media ID {media_id}: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = 60 * (self.request.retries + 1)
            logger.info(f"🔄 Retrying poster download in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
        }

@current_app.task(queue='posters', priority=5)
def batch_download_posters(media_list: list) -> Dict[str, Any]:
    """
    Download posters for multiple media items in batch
    
    Args:
        media_list: List of dicts with media_id, title, year, media_type
        
    Returns:
        Dict with batch processing results
    """
    logger.info(f"🚀 Starting batch poster download for {len(media_list)} items")
    
    results = {
        'total': len(media_list),
        'successful': 0,
        'failed': 0,
        'results': []
    }
    
    for media_info in media_list:
        try:
            # Queue individual poster download task
            task = download_poster.delay(
                media_info['media_id'],
                media_info['title'],
                media_info.get('year'),
                media_info.get('media_type', 'movie')
            )
            
            results['results'].append({
                'media_id': media_info['media_id'],
                'task_id': task.id,
                'status': 'queued'
            })
            
        except Exception as e:
            logger.error(f"Failed to queue poster task for media {media_info['media_id']}: {e}")
            results['failed'] += 1
            results['results'].append({
                'media_id': media_info['media_id'],
                'status': 'failed',
                'error': str(e)
            })
    
    logger.info(f"📊 Batch queued: {len(results['results'])} poster tasks")
    return results

def search_tmdb_poster(title: str, year: int = None, media_type: str = 'movie') -> Optional[str]:
    """Search for poster on TMDB"""
    try:
        if not TMDB_API_KEY:
            return None
        
        # Search for the media
        search_url = f"{TMDB_BASE_URL}/search/{media_type}"
        params = {
            'api_key': TMDB_API_KEY,
            'query': title
        }
        
        if year:
            if media_type == 'movie':
                params['year'] = year
            else:
                params['first_air_date_year'] = year
        
        response = requests.get(search_url, params=params, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        if data['results']:
            # Get the first result
            result = data['results'][0]
            poster_path = result.get('poster_path')
            
            if poster_path:
                return f"{TMDB_IMAGE_BASE_URL}{poster_path}"
        
        return None
        
    except Exception as e:
        logger.warning(f"TMDB search failed for {title}: {e}")
        return None

def search_fallback_poster(title: str, year: int = None) -> Optional[str]:
    """Search for poster using fallback sources"""
    try:
        # Try OMDb API as fallback
        omdb_api_key = os.getenv('OMDB_API_KEY')
        if omdb_api_key:
            params = {
                'apikey': omdb_api_key,
                't': title,
                'type': 'movie'
            }
            
            if year:
                params['y'] = year
            
            response = requests.get('http://www.omdbapi.com/', params=params, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                poster_url = data.get('Poster')
                
                if poster_url and poster_url != 'N/A':
                    return poster_url
        
        # Additional fallback sources can be added here
        # - Fanart.tv
        # - TVDb
        # - Custom poster services
        
        return None
        
    except Exception as e:
        logger.warning(f"Fallback poster search failed for {title}: {e}")
        return None

def update_poster_in_database(media_id: int, poster_path: str) -> bool:
    """Update media poster path in database"""
    try:
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/poster",
            json={'poster_path': poster_path},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"💾 Database updated with poster for media ID {media_id}")
            return True
        else:
            logger.error(f"Database poster update failed: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Database poster update error: {e}")
        return False
