#!/usr/bin/env python3
"""
File Watcher Startup Script
Starts the media file watcher service
"""

import os
import sys
import time
import logging
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, '/app')

from tasks.file_watcher import MediaDirectoryWatcher

def main():
    """Main function to start file watcher"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)
    
    try:
        # Get media directories from environment
        media_dirs_str = os.getenv('MEDIA_DIRECTORIES', '/media')
        media_dirs = [d.strip() for d in media_dirs_str.split(',') if d.strip()]
        
        # Filter to existing directories
        watch_dirs = []
        for directory in media_dirs:
            if os.path.exists(directory):
                watch_dirs.append(directory)
                logger.info(f"Will watch directory: {directory}")
            else:
                logger.warning(f"Directory does not exist: {directory}")
        
        if not watch_dirs:
            logger.error("No valid media directories found to watch")
            return 1
        
        # Get debounce seconds from environment
        debounce_seconds = int(os.getenv('FILE_WATCHER_DEBOUNCE', '5'))
        
        logger.info(f"Starting file watcher for {len(watch_dirs)} directories with {debounce_seconds}s debounce")
        
        # Create and start watcher
        watcher = MediaDirectoryWatcher(watch_dirs, debounce_seconds)
        watcher.start()
        
        logger.info("File watcher started successfully")
        
        # Keep running
        try:
            while watcher.is_running:
                time.sleep(10)
                # Log status periodically
                status = watcher.get_status()
                if status['pending_files'] > 0 or status['processed_files'] % 10 == 0:
                    logger.info(f"File watcher status: {status['pending_files']} pending, {status['processed_files']} processed")
                    
        except KeyboardInterrupt:
            logger.info("File watcher interrupted by user")
        except Exception as e:
            logger.error(f"File watcher error: {e}")
            return 1
        finally:
            logger.info("Stopping file watcher...")
            watcher.stop()
            logger.info("File watcher stopped")
            
        return 0
        
    except Exception as e:
        logger.error(f"Failed to start file watcher: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
