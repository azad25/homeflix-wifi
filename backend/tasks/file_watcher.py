#!/usr/bin/env python3
"""
File Watcher for Media Scanner
Monitors media directories for new files and automatically queues them for processing
"""

import os
import time
import logging
import threading
from pathlib import Path
from typing import Dict, Any, Set, List
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from celery import current_app
from celery.utils.log import get_task_logger

# Import scanning tasks
from tasks.scanning_tasks import process_new_media

logger = get_task_logger(__name__)

class MediaFileHandler(FileSystemEventHandler):
    """Handler for media file system events"""
    
    # Supported media extensions
    MEDIA_EXTENSIONS = {
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        '.mpg', '.mpeg', '.3gp', '.ogv', '.ts', '.m2ts', '.mts'
    }
    
    def __init__(self, debounce_seconds: int = 5):
        super().__init__()
        self.debounce_seconds = debounce_seconds
        self.pending_files: Dict[str, float] = {}  # file_path -> timestamp
        self.processed_files: Set[str] = set()
        self.lock = threading.Lock()
        
        # Start debounce timer thread
        self.debounce_thread = threading.Thread(target=self._debounce_worker, daemon=True)
        self.debounce_thread.start()
        
    def on_created(self, event):
        """Handle file creation events"""
        if not event.is_directory:
            self._handle_file_event(event.src_path, 'created')
    
    def on_moved(self, event):
        """Handle file move events"""
        if not event.is_directory:
            self._handle_file_event(event.dest_path, 'moved')
    
    def on_modified(self, event):
        """Handle file modification events (for files being copied)"""
        if not event.is_directory:
            self._handle_file_event(event.src_path, 'modified')
    
    def _handle_file_event(self, file_path: str, event_type: str):
        """Process file system events with debouncing"""
        try:
            # Check if it's a media file
            if not self._is_media_file(file_path):
                return
            
            # Skip if already processed
            if file_path in self.processed_files:
                return
            
            # Check if file is complete (not being written)
            if not self._is_file_complete(file_path):
                logger.debug(f"File {file_path} is still being written, waiting...")
                return
            
            with self.lock:
                # Add to pending files with current timestamp
                self.pending_files[file_path] = time.time()
                logger.info(f"📁 Detected {event_type} media file: {file_path}")
                
        except Exception as e:
            logger.error(f"Error handling file event for {file_path}: {e}")
    
    def _debounce_worker(self):
        """Worker thread to process debounced file events"""
        while True:
            try:
                time.sleep(1)  # Check every second
                
                with self.lock:
                    current_time = time.time()
                    files_to_process = []
                    
                    # Find files that have been stable for debounce_seconds
                    for file_path, timestamp in list(self.pending_files.items()):
                        if current_time - timestamp >= self.debounce_seconds:
                            files_to_process.append(file_path)
                            del self.pending_files[file_path]
                
                # Process stable files
                for file_path in files_to_process:
                    self._process_new_file(file_path)
                    
            except Exception as e:
                logger.error(f"Error in debounce worker: {e}")
    
    def _is_media_file(self, file_path: str) -> bool:
        """Check if file is a supported media file"""
        try:
            path = Path(file_path)
            return path.suffix.lower() in self.MEDIA_EXTENSIONS
        except Exception:
            return False
    
    def _is_file_complete(self, file_path: str) -> bool:
        """Check if file is completely written (not being copied)"""
        try:
            if not os.path.exists(file_path):
                return False
            
            # Check file size stability
            initial_size = os.path.getsize(file_path)
            time.sleep(0.5)  # Wait half second
            
            if not os.path.exists(file_path):
                return False
                
            final_size = os.path.getsize(file_path)
            
            # File is complete if size is stable and > 0
            return initial_size == final_size and final_size > 0
            
        except Exception as e:
            logger.error(f"Error checking file completeness for {file_path}: {e}")
            return False
    
    def _process_new_file(self, file_path: str):
        """Process a new media file by queuing it for processing"""
        try:
            # Skip if already processed
            if file_path in self.processed_files:
                return
            
            # Extract media information
            media_info = self._extract_media_info(file_path)
            
            # Add to database first
            media_id = self._add_to_database(media_info)
            
            if media_id:
                # Update media_info with database ID
                media_info['media_id'] = media_id
                
                # Queue for processing
                logger.info(f"🚀 Queuing new media file for processing: {file_path}")
                process_new_media.apply_async(
                    args=[media_info],
                    queue='scanning',
                    priority=5  # High priority for new files
                )
                
                # Mark as processed
                self.processed_files.add(file_path)
                
                logger.info(f"✅ Successfully queued media ID {media_id}: {media_info['title']}")
            else:
                logger.error(f"❌ Failed to add media to database: {file_path}")
                
        except Exception as e:
            logger.error(f"❌ Failed to process new file {file_path}: {e}")
    
    def _extract_media_info(self, file_path: str) -> Dict[str, Any]:
        """Extract basic media information from file path"""
        try:
            path = Path(file_path)
            
            # Extract title from filename (remove extension and clean up)
            title = path.stem
            title = title.replace('.', ' ').replace('_', ' ').replace('-', ' ')
            title = ' '.join(title.split())  # Normalize whitespace
            
            # Try to extract year from title
            year = None
            import re
            year_match = re.search(r'\b(19|20)\d{2}\b', title)
            if year_match:
                year = int(year_match.group())
                # Remove year from title
                title = re.sub(r'\s*\(\s*(19|20)\d{2}\s*\)\s*', '', title)
                title = re.sub(r'\s*(19|20)\d{2}\s*', '', title)
                title = title.strip()
            
            # Determine media type based on path structure
            media_type = 'movie'  # Default
            path_parts = path.parts
            
            # Check for TV series indicators
            for part in path_parts:
                part_lower = part.lower()
                if any(indicator in part_lower for indicator in ['season', 'episode', 's0', 'e0', 'tv', 'series']):
                    media_type = 'tv'
                    break
            
            return {
                'file_path': str(file_path),
                'title': title,
                'year': year,
                'type': media_type,
                'file_size': path.stat().st_size,
                'file_extension': path.suffix.lower(),
                'detected_at': time.time()
            }
            
        except Exception as e:
            logger.error(f"Error extracting media info from {file_path}: {e}")
            return {
                'file_path': str(file_path),
                'title': Path(file_path).stem,
                'year': None,
                'type': 'movie',
                'file_size': 0,
                'file_extension': Path(file_path).suffix.lower(),
                'detected_at': time.time()
            }
    
    def _add_to_database(self, media_info: Dict[str, Any]) -> int:
        """Add new media to database via API"""
        try:
            import requests
            api_url = os.getenv('API_URL', 'http://backend:8251')
            
            # Prepare data for API
            data = {
                'title': media_info['title'],
                'file_path': media_info['file_path'],
                'year': media_info.get('year'),
                'type': media_info.get('type', 'movie'),
                'file_size': media_info.get('file_size', 0),
                'file_extension': media_info.get('file_extension', ''),
                'status': 'processing'  # Mark as being processed
            }
            
            # Create media entry
            response = requests.post(
                f"{api_url}/api/admin/media",
                json=data,
                timeout=30
            )
            
            if response.status_code == 201:
                result = response.json()
                media_id = result.get('id')
                logger.info(f"✅ Added media to database with ID {media_id}: {media_info['title']}")
                return media_id
            else:
                logger.error(f"Failed to add media to database: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Database API error: {e}")
            return None


class MediaDirectoryWatcher:
    """Main file watcher class for monitoring media directories"""
    
    def __init__(self, watch_directories: List[str], debounce_seconds: int = 5):
        self.watch_directories = watch_directories
        self.debounce_seconds = debounce_seconds
        self.observer = Observer()
        self.handler = MediaFileHandler(debounce_seconds)
        self.is_running = False
        
    def start(self):
        """Start watching directories"""
        try:
            logger.info(f"🔍 Starting file watcher for {len(self.watch_directories)} directories")
            
            for directory in self.watch_directories:
                if os.path.exists(directory):
                    self.observer.schedule(
                        self.handler, 
                        directory, 
                        recursive=True
                    )
                    logger.info(f"📁 Watching directory: {directory}")
                else:
                    logger.warning(f"⚠️ Directory does not exist: {directory}")
            
            self.observer.start()
            self.is_running = True
            logger.info("✅ File watcher started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start file watcher: {e}")
            raise
    
    def stop(self):
        """Stop watching directories"""
        try:
            if self.is_running:
                logger.info("🛑 Stopping file watcher...")
                self.observer.stop()
                self.observer.join(timeout=10)
                self.is_running = False
                logger.info("✅ File watcher stopped")
        except Exception as e:
            logger.error(f"Error stopping file watcher: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current watcher status"""
        return {
            'is_running': self.is_running,
            'watch_directories': self.watch_directories,
            'debounce_seconds': self.debounce_seconds,
            'pending_files': len(self.handler.pending_files),
            'processed_files': len(self.handler.processed_files)
        }


# Celery task for managing file watcher
@current_app.task(queue='scanning', priority=1)
def start_file_watcher(watch_directories: List[str] = None, debounce_seconds: int = 5) -> Dict[str, Any]:
    """
    Start file watcher as a Celery task
    
    Args:
        watch_directories: List of directories to watch
        debounce_seconds: Seconds to wait before processing file events
        
    Returns:
        Dict with watcher status
    """
    try:
        # Default directories from environment
        if not watch_directories:
            media_dirs = os.getenv('MEDIA_DIRECTORIES', '/media').split(',')
            watch_directories = [d.strip() for d in media_dirs if d.strip()]
        
        # Create and start watcher
        watcher = MediaDirectoryWatcher(watch_directories, debounce_seconds)
        watcher.start()
        
        logger.info(f"🔍 File watcher started for directories: {watch_directories}")
        
        # Keep the task running
        try:
            while watcher.is_running:
                time.sleep(10)  # Check every 10 seconds
                
        except KeyboardInterrupt:
            logger.info("File watcher interrupted by user")
        finally:
            watcher.stop()
        
        return {
            'status': 'completed',
            'message': 'File watcher stopped',
            'directories_watched': watch_directories
        }
        
    except Exception as e:
        logger.error(f"❌ File watcher task failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }


@current_app.task(queue='scanning', priority=2)
def get_file_watcher_status() -> Dict[str, Any]:
    """Get current file watcher status"""
    try:
        # This would need to be implemented with a shared state mechanism
        # For now, return basic info
        return {
            'status': 'info',
            'message': 'File watcher status check - implement shared state for full status'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }
