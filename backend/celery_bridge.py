#!/usr/bin/env python3
"""
Celery Bridge Service
HTTP API bridge between Go backend and Celery task queue system
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify
from celery import Celery
from celery.result import AsyncResult, GroupResult

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import task modules
from tasks.scanning_tasks import process_new_media, batch_process_media_library, get_processing_status
from tasks.metadata_tasks import generate_metadata, batch_generate_metadata
from tasks.thumbnail_tasks import generate_thumbnail, generate_preview_clip
from tasks.poster_tasks import download_poster, batch_download_posters
from tasks.video_tasks import analyze_video_metadata, optimize_video_for_streaming
from tasks.subtitle_tasks import extract_embedded_subtitles, scan_external_subtitles

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Redis configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6380/0')

# Initialize Celery app
celery_app = Celery('homeflix_tasks')
celery_app.conf.update(
    broker_url=REDIS_URL,
    result_backend=REDIS_URL,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'celery_bridge',
        'redis_url': REDIS_URL
    })

@app.route('/queue/media/process', methods=['POST'])
def queue_media_processing():
    """Queue comprehensive media processing"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Queue the processing task
        task = process_new_media.delay(data)
        
        logger.info(f"Queued media processing task: {task.id}")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'media_id': data.get('media_id'),
            'title': data.get('title')
        })
        
    except Exception as e:
        logger.error(f"Failed to queue media processing: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queue/metadata/generate', methods=['POST'])
def queue_metadata_generation():
    """Queue metadata generation task"""
    try:
        data = request.get_json()
        
        media_id = data.get('media_id')
        file_path = data.get('file_path')
        title = data.get('title')
        
        if not all([media_id, file_path, title]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        task = generate_metadata.delay(media_id, file_path, title)
        
        logger.info(f"Queued metadata generation task: {task.id}")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'media_id': media_id
        })
        
    except Exception as e:
        logger.error(f"Failed to queue metadata generation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queue/thumbnails/generate', methods=['POST'])
def queue_thumbnail_generation():
    """Queue thumbnail generation task"""
    try:
        data = request.get_json()
        
        media_id = data.get('media_id')
        file_path = data.get('file_path')
        
        if not all([media_id, file_path]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        task = generate_thumbnail.delay(media_id, file_path)
        
        logger.info(f"Queued thumbnail generation task: {task.id}")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'media_id': media_id
        })
        
    except Exception as e:
        logger.error(f"Failed to queue thumbnail generation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queue/previews/generate', methods=['POST'])
def queue_preview_generation():
    """Queue preview clip generation task"""
    try:
        data = request.get_json()
        
        media_id = data.get('media_id')
        file_path = data.get('file_path')
        
        if not all([media_id, file_path]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        task = generate_preview_clip.delay(media_id, file_path)
        
        logger.info(f"Queued preview generation task: {task.id}")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'media_id': media_id
        })
        
    except Exception as e:
        logger.error(f"Failed to queue preview generation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queue/posters/download', methods=['POST'])
def queue_poster_download():
    """Queue poster download task"""
    try:
        data = request.get_json()
        
        media_id = data.get('media_id')
        title = data.get('title')
        year = data.get('year')
        media_type = data.get('media_type', 'movie')
        
        if not all([media_id, title]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        task = download_poster.delay(media_id, title, year, media_type)
        
        logger.info(f"Queued poster download task: {task.id}")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'media_id': media_id
        })
        
    except Exception as e:
        logger.error(f"Failed to queue poster download: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queue/batch/process', methods=['POST'])
def queue_batch_processing():
    """Queue batch media processing"""
    try:
        data = request.get_json()
        media_list = data.get('media_list', [])
        
        if not media_list:
            return jsonify({'error': 'No media list provided'}), 400
        
        task = batch_process_media_library.delay(media_list)
        
        logger.info(f"Queued batch processing task: {task.id} ({len(media_list)} items)")
        
        return jsonify({
            'status': 'queued',
            'task_id': task.id,
            'item_count': len(media_list)
        })
        
    except Exception as e:
        logger.error(f"Failed to queue batch processing: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """Get status of a specific task"""
    try:
        result = AsyncResult(task_id, app=celery_app)
        
        response = {
            'task_id': task_id,
            'status': result.status,
            'ready': result.ready(),
            'successful': result.successful() if result.ready() else None,
            'failed': result.failed() if result.ready() else None,
        }
        
        if result.ready():
            if result.successful():
                response['result'] = result.result
            elif result.failed():
                response['error'] = str(result.result)
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/status/group/<group_id>', methods=['GET'])
def get_group_status(group_id):
    """Get status of a task group"""
    try:
        task = get_processing_status.delay(group_id)
        result = task.get(timeout=10)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Failed to get group status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queues/status', methods=['GET'])
def get_queue_status():
    """Get status of all queues"""
    try:
        inspect = celery_app.control.inspect()
        
        # Get active tasks
        active = inspect.active()
        
        # Get scheduled tasks
        scheduled = inspect.scheduled()
        
        # Get queue lengths (this requires Redis inspection)
        import redis
        redis_client = redis.from_url(REDIS_URL)
        
        queues = ['metadata', 'thumbnails', 'posters', 'video_processing', 'subtitles', 'scanning']
        queue_lengths = {}
        
        for queue in queues:
            try:
                length = redis_client.llen(queue)
                queue_lengths[queue] = length
            except Exception as e:
                logger.warning(f"Failed to get length for queue {queue}: {e}")
                queue_lengths[queue] = -1
        
        return jsonify({
            'queue_lengths': queue_lengths,
            'active_tasks': active,
            'scheduled_tasks': scheduled
        })
        
    except Exception as e:
        logger.error(f"Failed to get queue status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/queues/purge', methods=['POST'])
def purge_queues():
    """Purge specific queues"""
    try:
        data = request.get_json()
        queues_to_purge = data.get('queues', [])
        
        if not queues_to_purge:
            return jsonify({'error': 'No queues specified'}), 400
        
        import redis
        redis_client = redis.from_url(REDIS_URL)
        
        purged = {}
        for queue in queues_to_purge:
            try:
                count = redis_client.delete(queue)
                purged[queue] = count
                logger.info(f"Purged queue {queue}: {count} items")
            except Exception as e:
                logger.error(f"Failed to purge queue {queue}: {e}")
                purged[queue] = f"Error: {str(e)}"
        
        return jsonify({
            'status': 'completed',
            'purged': purged
        })
        
    except Exception as e:
        logger.error(f"Failed to purge queues: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('CELERY_BRIDGE_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting Celery Bridge Service on port {port}")
    logger.info(f"Redis URL: {REDIS_URL}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
