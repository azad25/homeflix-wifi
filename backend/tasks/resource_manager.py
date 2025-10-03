#!/usr/bin/env python3
"""
Resource Manager for Celery Workers
Manages system resources and implements sleep mechanisms after task completion
"""

import os
import time
import psutil
import logging
from typing import Dict, Any
from celery import current_app
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

class CeleryResourceManager:
    """Manages Celery worker resources and implements sleep mechanisms"""
    
    def __init__(self):
        self.sleep_after_batch = int(os.getenv('CELERY_SLEEP_AFTER_BATCH', '30'))  # 30 seconds default
        self.memory_threshold = float(os.getenv('MEMORY_THRESHOLD_PERCENT', '80'))  # 80% memory threshold
        self.cpu_threshold = float(os.getenv('CPU_THRESHOLD_PERCENT', '85'))  # 85% CPU threshold
        self.idle_sleep_duration = int(os.getenv('IDLE_SLEEP_DURATION', '60'))  # 60 seconds idle sleep
        
    def check_system_resources(self) -> Dict[str, Any]:
        """Check current system resource usage"""
        try:
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # CPU usage (average over 1 second)
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            # Process count
            process_count = len(psutil.pids())
            
            return {
                'memory_percent': memory_percent,
                'cpu_percent': cpu_percent,
                'disk_percent': disk_percent,
                'process_count': process_count,
                'memory_available_gb': memory.available / (1024**3),
                'high_memory_usage': memory_percent > self.memory_threshold,
                'high_cpu_usage': cpu_percent > self.cpu_threshold
            }
            
        except Exception as e:
            logger.error(f"Error checking system resources: {e}")
            return {
                'memory_percent': 0,
                'cpu_percent': 0,
                'disk_percent': 0,
                'process_count': 0,
                'error': str(e)
            }
    
    def should_sleep(self, task_type: str = None) -> Dict[str, Any]:
        """Determine if worker should sleep based on system resources"""
        resources = self.check_system_resources()
        
        # Always sleep after batch processing
        if task_type in ['batch_process_media_library', 'optimized_media_scan']:
            return {
                'should_sleep': True,
                'sleep_duration': self.sleep_after_batch,
                'reason': 'batch_processing_complete',
                'resources': resources
            }
        
        # Sleep if high resource usage
        if resources.get('high_memory_usage') or resources.get('high_cpu_usage'):
            sleep_duration = min(self.idle_sleep_duration, 120)  # Max 2 minutes
            return {
                'should_sleep': True,
                'sleep_duration': sleep_duration,
                'reason': 'high_resource_usage',
                'resources': resources
            }
        
        # Normal operation - no sleep needed
        return {
            'should_sleep': False,
            'reason': 'normal_operation',
            'resources': resources
        }
    
    def sleep_worker(self, duration: int, reason: str = 'resource_management'):
        """Put worker to sleep for specified duration"""
        logger.info(f"💤 Worker sleeping for {duration} seconds (reason: {reason})")
        
        # Log resource state before sleep
        resources = self.check_system_resources()
        logger.info(f"📊 Resources before sleep - Memory: {resources['memory_percent']:.1f}%, CPU: {resources['cpu_percent']:.1f}%")
        
        # Sleep in chunks to allow for interruption
        chunk_size = 10  # 10-second chunks
        chunks = duration // chunk_size
        remainder = duration % chunk_size
        
        for i in range(chunks):
            time.sleep(chunk_size)
            if i % 3 == 0:  # Log every 30 seconds
                logger.debug(f"💤 Sleeping... {(i + 1) * chunk_size}/{duration} seconds elapsed")
        
        if remainder > 0:
            time.sleep(remainder)
        
        # Log resource state after sleep
        resources_after = self.check_system_resources()
        logger.info(f"🌅 Worker awakened - Memory: {resources_after['memory_percent']:.1f}%, CPU: {resources_after['cpu_percent']:.1f}%")
        
        return {
            'slept_duration': duration,
            'reason': reason,
            'resources_before': resources,
            'resources_after': resources_after
        }
    
    def cleanup_worker_resources(self):
        """Clean up worker resources and force garbage collection"""
        try:
            import gc
            
            # Force garbage collection
            collected = gc.collect()
            
            # Clear any temporary files if needed
            temp_dirs = ['/tmp', '/var/tmp']
            cleaned_files = 0
            
            for temp_dir in temp_dirs:
                if os.path.exists(temp_dir):
                    try:
                        for file in os.listdir(temp_dir):
                            if file.startswith('celery_') or file.startswith('homeflix_'):
                                file_path = os.path.join(temp_dir, file)
                                if os.path.isfile(file_path):
                                    os.remove(file_path)
                                    cleaned_files += 1
                    except Exception as e:
                        logger.debug(f"Error cleaning temp files in {temp_dir}: {e}")
            
            logger.info(f"🧹 Cleaned up resources - GC collected: {collected}, Temp files removed: {cleaned_files}")
            
            return {
                'gc_collected': collected,
                'temp_files_cleaned': cleaned_files
            }
            
        except Exception as e:
            logger.error(f"Error during resource cleanup: {e}")
            return {'error': str(e)}


# Global resource manager instance
resource_manager = CeleryResourceManager()


# Decorator for tasks that should sleep after completion
def sleep_after_task(task_type: str = None):
    """Decorator to add sleep mechanism after task completion"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                # Execute the original task
                result = func(*args, **kwargs)
                
                # Check if we should sleep
                sleep_decision = resource_manager.should_sleep(task_type)
                
                if sleep_decision['should_sleep']:
                    # Clean up resources first
                    cleanup_result = resource_manager.cleanup_worker_resources()
                    
                    # Sleep to free up resources
                    sleep_result = resource_manager.sleep_worker(
                        sleep_decision['sleep_duration'],
                        sleep_decision['reason']
                    )
                    
                    # Add sleep info to result if it's a dict
                    if isinstance(result, dict):
                        result['resource_management'] = {
                            'slept': True,
                            'sleep_duration': sleep_decision['sleep_duration'],
                            'reason': sleep_decision['reason'],
                            'cleanup': cleanup_result,
                            'resources': sleep_decision['resources']
                        }
                
                return result
                
            except Exception as e:
                logger.error(f"Error in sleep_after_task wrapper: {e}")
                return func(*args, **kwargs)  # Fallback to original function
        
        return wrapper
    return decorator


# Celery task for resource monitoring
@current_app.task(queue='scanning', priority=1)
def monitor_system_resources() -> Dict[str, Any]:
    """Monitor system resources and return status"""
    try:
        resources = resource_manager.check_system_resources()
        
        # Add recommendations based on resource usage
        recommendations = []
        
        if resources.get('high_memory_usage'):
            recommendations.append("High memory usage detected - consider reducing worker concurrency")
        
        if resources.get('high_cpu_usage'):
            recommendations.append("High CPU usage detected - workers may need to sleep more frequently")
        
        if resources['disk_percent'] > 90:
            recommendations.append("Disk usage is high - consider cleaning up temporary files")
        
        return {
            'status': 'success',
            'resources': resources,
            'recommendations': recommendations,
            'timestamp': time.time()
        }
        
    except Exception as e:
        logger.error(f"❌ Resource monitoring failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }


@current_app.task(queue='scanning', priority=2)
def cleanup_system_resources() -> Dict[str, Any]:
    """Clean up system resources manually"""
    try:
        cleanup_result = resource_manager.cleanup_worker_resources()
        
        # Force sleep for resource recovery
        sleep_result = resource_manager.sleep_worker(30, 'manual_cleanup')
        
        return {
            'status': 'success',
            'cleanup': cleanup_result,
            'sleep': sleep_result
        }
        
    except Exception as e:
        logger.error(f"❌ Resource cleanup failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }
