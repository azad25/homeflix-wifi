#!/usr/bin/env python3
"""
Metadata Generation Tasks
High-priority queue for AI-powered metadata generation using Gemini
"""

import os
import json
import requests
import logging
from celery import Celery
from typing import Dict, Any, Optional
from celery import current_app
from celery.utils.log import get_task_logger

# Configure logging
logger = get_task_logger(__name__)

# AI API configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDe79kNlJ_lGUXO5e-qka73mUpcvrynsBc')
GEMINI_MODEL = os.getenv('DEFAULT_MODEL', 'gemini-2.0-flash-exp')
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.2:3b')
API_URL = os.getenv('API_URL', 'http://localhost:8251')
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

@current_app.task(bind=True, queue='metadata', priority=9, max_retries=3)
def generate_metadata(self, media_id: int, file_path: str, existing_title: str) -> Dict[str, Any]:
    """
    Generate comprehensive metadata for media using Gemini AI
    
    Args:
        media_id: Database ID of the media
        file_path: Path to the media file
        existing_title: Current title from filename parsing
        
    Returns:
        Dict containing generated metadata
    """
    try:
        logger.info(f"🤖 Generating metadata for media ID {media_id}: {existing_title}")
        
        # Extract filename for analysis
        filename = os.path.basename(file_path)
        
        # Create prompt for Gemini
        prompt = f"""Analyze this media file and generate comprehensive metadata in JSON format.

Filename: {filename}
Existing Title: {existing_title}

Generate the following information:
1. Title (clean, proper title without quality markers)
2. Tagline (catchy one-liner, max 100 chars)
3. Description (detailed plot summary, 2-3 sentences, max 500 chars)
4. Year (release year, estimate if unknown)
5. Stars (main actors/actresses, array of names, max 5)
6. Directors (director names, array, max 3)
7. Country (country of origin)
8. Genres (array of genre tags, max 4)
9. Rating (estimated rating 1-10, float)

Return ONLY valid JSON in this exact format:
{{
  "title": "Movie Title",
  "tagline": "Catchy tagline",
  "description": "Detailed description",
  "year": 2024,
  "stars": ["Actor 1", "Actor 2"],
  "directors": ["Director Name"],
  "country": "USA",
  "genres": ["Action", "Drama"],
  "rating": 8.5
}}"""

        # Try Gemini first, fallback to Ollama if it fails
        content = None
        
        if GEMINI_API_KEY and GEMINI_API_KEY != 'your_gemini_api_key_here':
            try:
                logger.info(f"Trying Gemini API for media_id {media_id}")
                response = requests.post(
                    f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                    headers={'Content-Type': 'application/json'},
                    json={
                        "contents": [{
                            "parts": [{"text": prompt}]
                        }]
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    gemini_data = response.json()
                    if gemini_data.get('candidates') and gemini_data['candidates'][0].get('content'):
                        content = gemini_data['candidates'][0]['content']['parts'][0]['text']
                        logger.info(f"Gemini API successful for media_id {media_id}")
                    else:
                        logger.warning(f"No content from Gemini API for media_id {media_id}")
                else:
                    logger.warning(f"Gemini API error {response.status_code} for media_id {media_id}: {response.text}")
            except Exception as e:
                logger.warning(f"Gemini API failed for media_id {media_id}: {str(e)}")
        
        # Fallback to Ollama if Gemini failed or not configured
        if not content:
            try:
                logger.info(f"Using Ollama fallback for media_id {media_id}")
                ollama_response = requests.post(
                    f"{OLLAMA_URL}/api/generate",
                    headers={'Content-Type': 'application/json'},
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False
                    },
                    timeout=60
                )
                
                if ollama_response.status_code == 200:
                    ollama_data = ollama_response.json()
                    content = ollama_data.get('response', '')
                    logger.info(f"Ollama successful for media_id {media_id}")
                else:
                    raise Exception(f"Ollama API error: {ollama_response.status_code} - {ollama_response.text}")
            except Exception as e:
                logger.error(f"Both Gemini and Ollama failed for media_id {media_id}: {str(e)}")
                raise Exception(f"Both AI services failed: {str(e)}")
        
        if not content:
            raise Exception("No response from any AI service")
        
        # Extract JSON from response
        metadata = extract_json_from_response(content)
        
        # Validate and clean metadata
        validated_metadata = validate_metadata(metadata, existing_title)
        
        logger.info(f"✅ Generated metadata for {validated_metadata['title']}")
        logger.info(f"   📝 Tagline: {validated_metadata.get('tagline', 'N/A')}")
        logger.info(f"   📅 Year: {validated_metadata.get('year', 'N/A')} | ⭐ Rating: {validated_metadata.get('rating', 'N/A')}")
        logger.info(f"   🎭 Genres: {validated_metadata.get('genres', [])}")
        
        # Update database via Go API
        update_result = update_media_in_database(media_id, validated_metadata)
        
        return {
            'status': 'success',
            'media_id': media_id,
            'metadata': validated_metadata,
            'database_updated': update_result
        }
        
    except Exception as exc:
        logger.error(f"❌ Failed to generate metadata for media ID {media_id}: {str(exc)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            retry_delay = 2 ** self.request.retries * 60  # 1min, 2min, 4min
            logger.info(f"🔄 Retrying in {retry_delay} seconds (attempt {self.request.retries + 1})")
            raise self.retry(countdown=retry_delay, exc=exc)
        
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(exc)
        }

@current_app.task(queue='metadata', priority=8)
def batch_generate_metadata(media_list: list) -> Dict[str, Any]:
    """
    Generate metadata for multiple media items in batch
    
    Args:
        media_list: List of dicts with media_id, file_path, existing_title
        
    Returns:
        Dict with batch processing results
    """
    logger.info(f"🚀 Starting batch metadata generation for {len(media_list)} items")
    
    results = {
        'total': len(media_list),
        'successful': 0,
        'failed': 0,
        'results': []
    }
    
    for media_info in media_list:
        try:
            # Queue individual metadata generation task
            task = generate_metadata.delay(
                media_info['media_id'],
                media_info['file_path'],
                media_info['existing_title']
            )
            
            results['results'].append({
                'media_id': media_info['media_id'],
                'task_id': task.id,
                'status': 'queued'
            })
            
        except Exception as e:
            logger.error(f"Failed to queue metadata task for media {media_info['media_id']}: {e}")
            results['failed'] += 1
            results['results'].append({
                'media_id': media_info['media_id'],
                'status': 'failed',
                'error': str(e)
            })
    
    logger.info(f"📊 Batch queued: {len(results['results'])} tasks")
    return results

def extract_json_from_response(text: str) -> Dict[str, Any]:
    """Extract JSON from Gemini response, handling markdown code blocks"""
    import re
    
    # Remove markdown code blocks
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()
    
    # Find JSON object
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON found in response")
    
    json_str = json_match.group(0)
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

def validate_metadata(metadata: Dict[str, Any], fallback_title: str) -> Dict[str, Any]:
    """Validate and clean metadata with fallbacks"""
    validated = {
        'title': metadata.get('title', fallback_title).strip()[:200],
        'tagline': metadata.get('tagline', '').strip()[:100],
        'description': metadata.get('description', '').strip()[:500],
        'year': int(metadata.get('year', 2024)) if metadata.get('year') else 2024,
        'rating': float(metadata.get('rating', 0)) if metadata.get('rating') else 0.0,
        'country': metadata.get('country', '').strip()[:50],
        'stars': metadata.get('stars', [])[:5] if isinstance(metadata.get('stars'), list) else [],
        'directors': metadata.get('directors', [])[:3] if isinstance(metadata.get('directors'), list) else [],
        'genres': metadata.get('genres', [])[:4] if isinstance(metadata.get('genres'), list) else []
    }
    
    # Ensure rating is within bounds
    validated['rating'] = max(0.0, min(10.0, validated['rating']))
    
    # Ensure year is reasonable
    validated['year'] = max(1900, min(2030, validated['year']))
    
    return validated

def update_media_in_database(media_id: int, metadata: Dict[str, Any]) -> bool:
    """Update media metadata in Go backend database"""
    try:
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.put(
            f"{api_url}/api/admin/media/{media_id}/metadata",
            headers={'Content-Type': 'application/json'},
            json=metadata,
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"💾 Database updated for media ID {media_id}")
            return True
        else:
            logger.error(f"Database update failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Database update error: {e}")
        return False
