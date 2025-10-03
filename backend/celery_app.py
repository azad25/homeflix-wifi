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

# Redis configuration - Using container name for Docker networking
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
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
    
    # Worker settings for performance optimization
    worker_prefetch_multiplier=1,  # Reduced to prevent memory issues
    task_acks_late=True,
    worker_disable_rate_limits=True,
    task_reject_on_worker_lost=True,  # Prevent lost tasks
    
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Result settings
    result_expires=1800,  # 30 minutes (reduced)
    task_ignore_result=False,
    
    # Retry settings with exponential backoff
    task_default_retry_delay=60,  # 1 minute base
    task_max_retries=2,  # Reduced from 3
    task_retry_jitter=True,  # Add jitter to prevent thundering herd
    
    # Concurrency settings optimized for 730 files
    worker_concurrency=None,  # Auto-detect but limited by Docker resources
    worker_max_tasks_per_child=50,  # Reduced to prevent memory leaks
    
    # Monitoring and inspection settings
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Enhanced connection retry settings for Docker
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=20,
    broker_heartbeat=30,
    broker_pool_limit=20,
    
    # Enhanced broker transport options optimized for stability
    broker_transport_options={
        'visibility_timeout': 1800,  # Reduced from 3600
        'socket_connect_timeout': 15,  # Reduced timeout
        'socket_keepalive': True,
        'retry_on_timeout': True,
        'max_connections': 10,  # Reduced connection pool
        'health_check_interval': 60,  # Less frequent health checks
        'connection_errors_retry_delay': 2.0,  # Faster retry
        'connection_errors_retry_max': 5,  # Fewer retries
        'fanout_prefix': True,
        'fanout_patterns': True,
        'priority_steps': list(range(10)),
        'sep': ':',
        'queue_order_strategy': 'priority',
        'master_name': None,  # Disable Redis Sentinel
    },
    
    # Task routing optimization
    task_routes_cache=True,
    task_always_eager=False,
    task_eager_propagates=False,
    
    # Memory and performance optimizations
    worker_log_color=False,  # Disable colored logs
    worker_hijack_root_logger=False,
    worker_redirect_stdouts=True,
    worker_redirect_stdouts_level='INFO',
    
    # Control settings for inspection
    control_exchange='celery.pidbox',
    control_exchange_type='fanout',
    
    # Task execution optimizations
    task_soft_time_limit=300,  # 5 minutes soft limit
    task_time_limit=600,       # 10 minutes hard limit
    task_track_started=True,   # Track task start time
    
    # Beat scheduler settings (if needed)
    beat_schedule_filename='celerybeat-schedule',
    beat_sync_every=1,
    
    # Security settings
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    
    # Error handling
    task_annotations={
        '*': {
            'rate_limit': '10/m',  # Global rate limit
            'time_limit': 600,     # 10 minute timeout
            'soft_time_limit': 300, # 5 minute soft timeout
        },
        'tasks.thumbnail_tasks.generate_thumbnail': {
            'rate_limit': '5/m',   # Slower rate for thumbnails
            'time_limit': 180,     # 3 minute timeout
        },
        'tasks.thumbnail_tasks.generate_preview_clip': {
            'rate_limit': '3/m',   # Even slower for previews
            'time_limit': 300,     # 5 minute timeout
        },
        'tasks.metadata_tasks.generate_metadata': {
            'rate_limit': '10/m',  # Metadata can be faster
            'time_limit': 120,     # 2 minute timeout
        },
    }
)

# Import task modules
from tasks import metadata_tasks
from tasks import thumbnail_tasks
from tasks import poster_tasks
from tasks import video_tasks
from tasks import subtitle_tasks
from tasks import scanning_tasks
from tasks import file_watcher
from tasks import resource_manager
from tasks import optimized_scanning

if __name__ == '__main__':
    app.start()
