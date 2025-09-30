#!/usr/bin/env python3
"""
HomeFlix Celery Task Queue System
Distributed processing for media tasks with multiple specialized queues
"""

import os
import sys
from celery import Celery
from kombu import Queue, Exchange

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Redis configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', REDIS_URL)

# Create Celery app
app = Celery('homeflix_tasks')

# Celery configuration
app.conf.update(
    # Broker settings
    broker_url=CELERY_BROKER_URL,
    result_backend=CELERY_RESULT_BACKEND,
    
    # Task routing for multiple queues
    task_routes={
        'tasks.metadata.*': {'queue': 'metadata'},
        'tasks.thumbnails.*': {'queue': 'thumbnails'},
        'tasks.posters.*': {'queue': 'posters'},
        'tasks.video.*': {'queue': 'video_processing'},
        'tasks.subtitles.*': {'queue': 'subtitles'},
        'tasks.scanning.*': {'queue': 'scanning'},
    },
    
    # Queue definitions with different priorities
    task_queues=(
        # High priority: User-facing tasks
        Queue('metadata', Exchange('metadata'), routing_key='metadata', 
              queue_arguments={'x-max-priority': 10}),
        Queue('thumbnails', Exchange('thumbnails'), routing_key='thumbnails',
              queue_arguments={'x-max-priority': 8}),
        
        # Medium priority: Background processing
        Queue('posters', Exchange('posters'), routing_key='posters',
              queue_arguments={'x-max-priority': 6}),
        Queue('video_processing', Exchange('video_processing'), routing_key='video_processing',
              queue_arguments={'x-max-priority': 5}),
        
        # Low priority: Batch operations
        Queue('subtitles', Exchange('subtitles'), routing_key='subtitles',
              queue_arguments={'x-max-priority': 3}),
        Queue('scanning', Exchange('scanning'), routing_key='scanning',
              queue_arguments={'x-max-priority': 2}),
    ),
    
    # Worker settings for performance
    worker_prefetch_multiplier=4,
    task_acks_late=True,
    worker_disable_rate_limits=True,
    
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Result settings
    result_expires=3600,  # 1 hour
    task_ignore_result=False,
    
    # Retry settings
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
    # Concurrency settings
    worker_concurrency=None,  # Auto-detect CPU cores
    worker_max_tasks_per_child=1000,
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Import task modules
from tasks import metadata_tasks
from tasks import thumbnail_tasks
from tasks import poster_tasks
from tasks import video_tasks
from tasks import subtitle_tasks
from tasks import scanning_tasks

if __name__ == '__main__':
    app.start()
