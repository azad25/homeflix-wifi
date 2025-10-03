#!/usr/bin/env python3
"""
Media Scanning Tasks
Low-priority queue for coordinating media library scanning and task orchestration
"""

import os
import logging
from typing import Dict, Any, List
from celery import current_app, group, chain
from celery.utils.log import get_task_logger

# Import other task modules
from tasks.metadata_tasks import generate_metadata
from tasks.thumbnail_tasks import generate_thumbnail, generate_preview_clip
from tasks.poster_tasks import download_poster
from tasks.video_tasks import analyze_video_metadata
from tasks.subtitle_tasks import extract_embedded_subtitles, scan_external_subtitles
from tasks.resource_manager import sleep_after_task, resource_manager

logger = get_task_logger(__name__)

@current_app.task(queue='scanning', priority=2)
def process_new_media(media_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orchestrate complete processing of a new media file
    
    Args:
        media_info: Dict with media_id, file_path, title, type, year
        
    Returns:
        Dict with processing orchestration results
    """
    try:
        media_id = media_info['media_id']
        file_path = media_info['file_path']
        title = media_info['title']
        
        logger.info(f"🚀 Starting complete processing for media ID {media_id}: {title}")
        
        # Create task chain for sequential processing
        # Some tasks depend on others, so we use chains and groups
        
        # Phase 1: Basic analysis (parallel)
        phase1_tasks = group(
            analyze_video_metadata.s(media_id, file_path),
            scan_external_subtitles.s(media_id, file_path)
        )
        
        # Phase 2: Media generation (parallel, after phase 1)
        phase2_tasks = group(
            generate_thumbnail.s(media_id, file_path),
            generate_preview_clip.s(media_id, file_path),
            extract_embedded_subtitles.s(media_id, file_path)
        )
        
        # Phase 3: AI processing (parallel, can run with phase 2)
        phase3_tasks = group(
            generate_metadata.s(media_id, file_path, title),
            download_poster.s(
                media_id, 
                title, 
                media_info.get('year'), 
                media_info.get('type', 'movie')
            )
        )
        
        # Execute phases
        logger.info(f"📊 Phase 1: Video analysis and subtitle scan for media ID {media_id}")
        phase1_result = phase1_tasks.apply_async()
        
        logger.info(f"📊 Phase 2: Thumbnail and preview generation for media ID {media_id}")
        phase2_result = phase2_tasks.apply_async()
        
        logger.info(f"📊 Phase 3: AI metadata and poster download for media ID {media_id}")
        phase3_result = phase3_tasks.apply_async()
        
        # Return task group IDs for monitoring
        return {
            'status': 'processing',
            'media_id': media_id,
            'title': title,
            'phase1_group_id': phase1_result.id,
            'phase2_group_id': phase2_result.id,
            'phase3_group_id': phase3_result.id,
            'message': 'Media processing started across multiple queues'
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to orchestrate processing for media ID {media_info.get('media_id')}: {e}")
        return {
            'status': 'failed',
            'media_id': media_info.get('media_id'),
            'error': str(e)
        }

@current_app.task(queue='scanning', priority=1)
@sleep_after_task('batch_process_media_library')
def batch_process_media_library(media_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Process entire media library in batches for maximum efficiency
    
    Args:
        media_list: List of media info dicts
        
    Returns:
        Dict with batch processing results
    """
    try:
        total_media = len(media_list)
        logger.info(f"🏭 Starting batch processing of {total_media} media items")
        
        # Split into batches for better resource management
        batch_size = int(os.getenv('BATCH_SIZE', '10'))
        batches = [media_list[i:i + batch_size] for i in range(0, total_media, batch_size)]
        
        batch_results = []
        
        for batch_num, batch in enumerate(batches, 1):
            logger.info(f"📦 Processing batch {batch_num}/{len(batches)} ({len(batch)} items)")
            
            # Create group of process_new_media tasks for this batch
            batch_tasks = group(
                process_new_media.s(media_info) for media_info in batch
            )
            
            # Execute batch
            batch_result = batch_tasks.apply_async()
            
            batch_results.append({
                'batch_number': batch_num,
                'item_count': len(batch),
                'group_id': batch_result.id,
                'status': 'queued'
            })
        
        logger.info(f"🚀 Queued {len(batches)} batches for processing ({total_media} total items)")
        
        return {
            'status': 'batch_processing_started',
            'total_media': total_media,
            'total_batches': len(batches),
            'batch_size': batch_size,
            'batch_results': batch_results
        }
        
    except Exception as e:
        logger.error(f"❌ Batch processing failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }

@current_app.task(queue='scanning', priority=3)
def reprocess_media_metadata(media_id: int, force_regenerate: bool = False) -> Dict[str, Any]:
    """
    Reprocess metadata for existing media (user-triggered)
    
    Args:
        media_id: Database ID of the media
        force_regenerate: Whether to force regeneration of all assets
        
    Returns:
        Dict with reprocessing results
    """
    try:
        logger.info(f"🔄 Reprocessing media ID {media_id} (force={force_regenerate})")
        
        # Get media info from database
        media_info = get_media_info_from_database(media_id)
        if not media_info:
            raise Exception(f"Media ID {media_id} not found in database")
        
        tasks_to_run = []
        
        # Always regenerate metadata when requested
        tasks_to_run.append(
            generate_metadata.s(media_id, media_info['file_path'], media_info['title'])
        )
        
        if force_regenerate:
            # Regenerate all assets
            tasks_to_run.extend([
                generate_thumbnail.s(media_id, media_info['file_path']),
                generate_preview_clip.s(media_id, media_info['file_path']),
                download_poster.s(
                    media_id, 
                    media_info['title'], 
                    media_info.get('year'), 
                    media_info.get('type', 'movie')
                ),
                analyze_video_metadata.s(media_id, media_info['file_path'])
            ])
        
        # Execute tasks in parallel
        task_group = group(*tasks_to_run)
        result = task_group.apply_async()
        
        logger.info(f"✅ Queued {len(tasks_to_run)} reprocessing tasks for media ID {media_id}")
        
        return {
            'status': 'reprocessing_started',
            'media_id': media_id,
            'task_count': len(tasks_to_run),
            'group_id': result.id,
            'force_regenerate': force_regenerate
        }
        
    except Exception as e:
        logger.error(f"❌ Reprocessing failed for media ID {media_id}: {e}")
        return {
            'status': 'failed',
            'media_id': media_id,
            'error': str(e)
        }

@current_app.task(queue='scanning', priority=4)
def get_processing_status(group_id: str) -> Dict[str, Any]:
    """
    Get status of a processing group
    
    Args:
        group_id: Celery group ID
        
    Returns:
        Dict with processing status
    """
    try:
        from celery.result import GroupResult
        
        group_result = GroupResult.restore(group_id)
        
        if not group_result:
            return {
                'status': 'not_found',
                'group_id': group_id,
                'error': 'Group result not found'
            }
        
        # Get status of all tasks in group
        task_states = []
        completed = 0
        failed = 0
        pending = 0
        
        for result in group_result.results:
            state = result.state
            task_states.append({
                'task_id': result.id,
                'state': state,
                'result': result.result if state == 'SUCCESS' else None,
                'error': str(result.result) if state == 'FAILURE' else None
            })
            
            if state == 'SUCCESS':
                completed += 1
            elif state == 'FAILURE':
                failed += 1
            else:
                pending += 1
        
        overall_status = 'completed' if group_result.ready() else 'processing'
        
        return {
            'status': overall_status,
            'group_id': group_id,
            'total_tasks': len(task_states),
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'progress_percent': (completed / len(task_states)) * 100 if task_states else 0,
            'task_details': task_states
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get processing status for group {group_id}: {e}")
        return {
            'status': 'error',
            'group_id': group_id,
            'error': str(e)
        }

def get_media_info_from_database(media_id: int) -> Dict[str, Any]:
    """Get media information from database via API"""
    try:
        import requests
        api_url = os.getenv('API_URL', 'http://localhost:8251')
        
        response = requests.get(f"{api_url}/api/media/{media_id}", timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Failed to get media info: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Database media info error: {e}")
        return None
