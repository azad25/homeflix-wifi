#!/usr/bin/env python3
"""
Optimized Media Scanning for Large Libraries
Handles 730+ files efficiently with batching, parallel processing, and duplicate detection
"""

import os
import time
import hashlib
import logging
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from celery import current_app, group, chord
from celery.utils.log import get_task_logger

from tasks.scanning_tasks import process_new_media
from tasks.resource_manager import sleep_after_task, resource_manager

logger = get_task_logger(__name__)

class OptimizedMediaScanner:
    """Optimized scanner for large media libraries"""
    
    # Supported media extensions
    MEDIA_EXTENSIONS = {
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        '.mpg', '.mpeg', '.3gp', '.ogv', '.ts', '.m2ts', '.mts', '.asf',
        '.rm', '.rmvb', '.divx', '.xvid', '.f4v', '.vob'
    }
    
    # Minimum file size (1MB) to avoid processing incomplete files
    MIN_FILE_SIZE = 1024 * 1024
    
    def __init__(self, batch_size: int = 20, max_workers: int = 4):
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.processed_files: Set[str] = set()
        self.duplicate_files: Dict[str, List[str]] = {}
        
    def scan_directories(self, directories: List[str]) -> Dict[str, Any]:
        """
        Scan multiple directories for media files with optimization
        
        Args:
            directories: List of directory paths to scan
            
        Returns:
            Dict with scan results and statistics
        """
        try:
            start_time = time.time()
            logger.info(f"🔍 Starting optimized scan of {len(directories)} directories")
            
            # Phase 1: Fast file discovery with parallel processing
            all_files = []
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_dir = {
                    executor.submit(self._scan_directory, directory): directory 
                    for directory in directories
                }
                
                for future in as_completed(future_to_dir):
                    directory = future_to_dir[future]
                    try:
                        files = future.result()
                        all_files.extend(files)
                        logger.info(f"📁 Found {len(files)} files in {directory}")
                    except Exception as e:
                        logger.error(f"❌ Error scanning {directory}: {e}")
            
            logger.info(f"📊 Total files discovered: {len(all_files)}")
            
            # Phase 2: Filter and validate media files
            media_files = self._filter_media_files(all_files)
            logger.info(f"🎬 Valid media files: {len(media_files)}")
            
            # Phase 3: Check for existing files in database
            existing_files = self._get_existing_files()
            new_files = [f for f in media_files if f['file_path'] not in existing_files]
            logger.info(f"🆕 New files to process: {len(new_files)}")
            
            # Phase 4: Detect duplicates by content hash (for large files, sample-based)
            if len(new_files) > 100:  # Only for large libraries
                new_files = self._remove_duplicates(new_files)
                logger.info(f"🔄 After duplicate removal: {len(new_files)}")
            
            # Phase 5: Process in optimized batches
            processing_result = self._process_files_in_batches(new_files)
            
            scan_time = time.time() - start_time
            
            return {
                'status': 'completed',
                'scan_time_seconds': scan_time,
                'total_files_found': len(all_files),
                'media_files_found': len(media_files),
                'new_files': len(new_files),
                'existing_files': len(existing_files),
                'duplicates_removed': len(media_files) - len(new_files) if len(new_files) < len(media_files) else 0,
                'processing_result': processing_result,
                'performance_stats': {
                    'files_per_second': len(all_files) / scan_time if scan_time > 0 else 0,
                    'directories_scanned': len(directories),
                    'batch_size_used': self.batch_size,
                    'max_workers_used': self.max_workers
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Optimized scan failed: {e}")
            return {
                'status': 'failed',
                'error': str(e)
            }
    
    def _scan_directory(self, directory: str) -> List[Dict[str, Any]]:
        """Scan a single directory for files"""
        files = []
        try:
            for root, dirs, filenames in os.walk(directory):
                # Skip hidden directories and common non-media directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and 
                          d.lower() not in {'@eadir', 'thumbs.db', 'desktop.ini', '$recycle.bin'}]
                
                for filename in filenames:
                    if filename.startswith('.'):
                        continue
                        
                    file_path = os.path.join(root, filename)
                    try:
                        stat = os.stat(file_path)
                        files.append({
                            'file_path': file_path,
                            'filename': filename,
                            'size': stat.st_size,
                            'mtime': stat.st_mtime,
                            'extension': Path(filename).suffix.lower()
                        })
                    except (OSError, IOError) as e:
                        logger.debug(f"Skipping inaccessible file {file_path}: {e}")
                        
        except Exception as e:
            logger.error(f"Error scanning directory {directory}: {e}")
            
        return files
    
    def _filter_media_files(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter and validate media files"""
        media_files = []
        
        for file_info in files:
            # Check extension
            if file_info['extension'] not in self.MEDIA_EXTENSIONS:
                continue
                
            # Check minimum file size
            if file_info['size'] < self.MIN_FILE_SIZE:
                logger.debug(f"Skipping small file: {file_info['file_path']} ({file_info['size']} bytes)")
                continue
            
            # Extract media metadata
            media_info = self._extract_media_metadata(file_info)
            if media_info:
                media_files.append(media_info)
                
        return media_files
    
    def _extract_media_metadata(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metadata from file information"""
        try:
            path = Path(file_info['file_path'])
            
            # Clean title from filename
            title = path.stem
            title = self._clean_title(title)
            
            # Extract year
            year = self._extract_year(title, str(path.parent))
            
            # Determine media type
            media_type = self._determine_media_type(file_info['file_path'])
            
            # Extract series/season/episode info for TV shows
            series_info = None
            if media_type == 'tv':
                series_info = self._extract_series_info(file_info['file_path'])
            
            return {
                'file_path': file_info['file_path'],
                'title': title,
                'year': year,
                'type': media_type,
                'file_size': file_info['size'],
                'file_extension': file_info['extension'],
                'series_info': series_info,
                'detected_at': time.time()
            }
            
        except Exception as e:
            logger.error(f"Error extracting metadata from {file_info['file_path']}: {e}")
            return None
    
    def _clean_title(self, title: str) -> str:
        """Clean and normalize title"""
        import re
        
        # Remove common prefixes and suffixes
        title = re.sub(r'^(.*?)[\[\(].*?[\]\)]', r'\1', title)  # Remove bracketed content
        title = re.sub(r'\.(19|20)\d{2}\.', ' ', title)  # Remove year dots
        title = re.sub(r'\b(720p|1080p|4K|HDR|BluRay|WEB-DL|WEBRip|DVDRip|BRRip)\b', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\b(x264|x265|H\.264|H\.265|HEVC|AAC|AC3|DTS)\b', '', title, flags=re.IGNORECASE)
        title = re.sub(r'[\.\-_]+', ' ', title)  # Replace dots, dashes, underscores with spaces
        title = re.sub(r'\s+', ' ', title)  # Normalize whitespace
        
        return title.strip()
    
    def _extract_year(self, title: str, path: str) -> int:
        """Extract year from title or path"""
        import re
        
        # Try title first
        year_match = re.search(r'\b(19|20)\d{2}\b', title)
        if year_match:
            return int(year_match.group())
        
        # Try path
        year_match = re.search(r'\b(19|20)\d{2}\b', path)
        if year_match:
            return int(year_match.group())
            
        return None
    
    def _determine_media_type(self, file_path: str) -> str:
        """Determine if file is movie or TV show"""
        path_lower = file_path.lower()
        
        # TV show indicators
        tv_indicators = [
            'season', 'episode', 's0', 'e0', 'tv', 'series', 'show',
            r's\d+e\d+', r'season\s*\d+', r'episode\s*\d+'
        ]
        
        for indicator in tv_indicators:
            if indicator in path_lower:
                return 'tv'
                
        return 'movie'
    
    def _extract_series_info(self, file_path: str) -> Dict[str, Any]:
        """Extract series, season, episode information"""
        import re
        
        path = Path(file_path)
        
        # Try to extract season/episode from filename
        filename = path.stem.lower()
        
        # Pattern: S01E01, s1e1, Season 1 Episode 1, etc.
        patterns = [
            r's(\d+)e(\d+)',
            r'season\s*(\d+).*?episode\s*(\d+)',
            r'(\d+)x(\d+)'
        ]
        
        season_num = None
        episode_num = None
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                season_num = int(match.group(1))
                episode_num = int(match.group(2))
                break
        
        # Extract series name from path
        series_name = None
        path_parts = path.parts
        
        for part in reversed(path_parts[:-1]):  # Exclude filename
            if not re.search(r'season\s*\d+', part.lower()):
                series_name = part
                break
        
        return {
            'series_name': series_name,
            'season_number': season_num,
            'episode_number': episode_num
        }
    
    def _get_existing_files(self) -> Set[str]:
        """Get list of files already in database"""
        try:
            import requests
            api_url = os.getenv('API_URL', 'http://backend:8251')
            
            response = requests.get(f"{api_url}/api/media", timeout=30)
            
            if response.status_code == 200:
                media_list = response.json()
                return {item['file_path'] for item in media_list if 'file_path' in item}
            else:
                logger.warning(f"Failed to get existing files: {response.status_code}")
                return set()
                
        except Exception as e:
            logger.error(f"Error getting existing files: {e}")
            return set()
    
    def _remove_duplicates(self, files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate files based on content sampling"""
        logger.info("🔍 Checking for duplicates using content sampling...")
        
        unique_files = []
        file_hashes = {}
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(self._get_file_hash, file_info): file_info 
                for file_info in files
            }
            
            for future in as_completed(future_to_file):
                file_info = future_to_file[future]
                try:
                    file_hash = future.result()
                    
                    if file_hash in file_hashes:
                        logger.info(f"🔄 Duplicate found: {file_info['file_path']} (matches {file_hashes[file_hash]})")
                        continue
                    
                    file_hashes[file_hash] = file_info['file_path']
                    unique_files.append(file_info)
                    
                except Exception as e:
                    logger.error(f"Error hashing {file_info['file_path']}: {e}")
                    # Include file anyway if hashing fails
                    unique_files.append(file_info)
        
        return unique_files
    
    def _get_file_hash(self, file_info: Dict[str, Any]) -> str:
        """Get hash of file for duplicate detection (sample-based for large files)"""
        file_path = file_info['file_path']
        file_size = file_info['file_size']
        
        # For large files, sample beginning, middle, and end
        sample_size = min(64 * 1024, file_size // 3)  # 64KB or 1/3 of file
        
        hasher = hashlib.md5()
        
        try:
            with open(file_path, 'rb') as f:
                # Beginning
                hasher.update(f.read(sample_size))
                
                if file_size > sample_size * 2:
                    # Middle
                    f.seek(file_size // 2)
                    hasher.update(f.read(sample_size))
                    
                    # End
                    f.seek(max(0, file_size - sample_size))
                    hasher.update(f.read(sample_size))
                
                # Include file size and name in hash
                hasher.update(str(file_size).encode())
                hasher.update(Path(file_path).name.encode())
                
        except Exception as e:
            logger.error(f"Error reading file for hashing {file_path}: {e}")
            # Fallback to filename and size
            hasher.update(Path(file_path).name.encode())
            hasher.update(str(file_size).encode())
        
        return hasher.hexdigest()
    
    def _process_files_in_batches(self, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process files in optimized batches"""
        if not files:
            return {'status': 'no_files', 'batches_processed': 0}
        
        logger.info(f"🚀 Processing {len(files)} files in batches of {self.batch_size}")
        
        # Split into batches
        batches = [files[i:i + self.batch_size] for i in range(0, len(files), self.batch_size)]
        
        batch_results = []
        
        for batch_num, batch in enumerate(batches, 1):
            logger.info(f"📦 Processing batch {batch_num}/{len(batches)} ({len(batch)} files)")
            
            try:
                # Add files to database first
                media_ids = []
                for file_info in batch:
                    media_id = self._add_file_to_database(file_info)
                    if media_id:
                        file_info['media_id'] = media_id
                        media_ids.append(media_id)
                
                # Create Celery group for parallel processing
                if media_ids:
                    batch_tasks = group(
                        process_new_media.s(file_info) 
                        for file_info in batch 
                        if 'media_id' in file_info
                    )
                    
                    batch_result = batch_tasks.apply_async()
                    
                    batch_results.append({
                        'batch_number': batch_num,
                        'file_count': len(batch),
                        'media_ids': media_ids,
                        'group_id': batch_result.id,
                        'status': 'queued'
                    })
                
                # Small delay between batches to prevent overwhelming
                if batch_num < len(batches):
                    time.sleep(1)
                    
            except Exception as e:
                logger.error(f"❌ Error processing batch {batch_num}: {e}")
                batch_results.append({
                    'batch_number': batch_num,
                    'file_count': len(batch),
                    'status': 'failed',
                    'error': str(e)
                })
        
        return {
            'status': 'processing_started',
            'total_batches': len(batches),
            'batch_results': batch_results,
            'total_files_queued': sum(len(r.get('media_ids', [])) for r in batch_results)
        }
    
    def _add_file_to_database(self, file_info: Dict[str, Any]) -> int:
        """Add file to database and return media ID"""
        try:
            import requests
            api_url = os.getenv('API_URL', 'http://backend:8251')
            
            data = {
                'title': file_info['title'],
                'file_path': file_info['file_path'],
                'year': file_info.get('year'),
                'type': file_info.get('type', 'movie'),
                'file_size': file_info.get('file_size', 0)
            }
            
            response = requests.post(
                f"{api_url}/api/admin/media",
                json=data,
                timeout=30
            )
            
            if response.status_code == 201:
                result = response.json()
                return result.get('id')
            else:
                logger.error(f"Failed to add {file_info['file_path']} to database: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Database error for {file_info['file_path']}: {e}")
            return None


# Celery task for optimized scanning
@current_app.task(queue='scanning', priority=1)
@sleep_after_task('optimized_media_scan')
def optimized_media_scan(directories: List[str] = None, batch_size: int = 20, max_workers: int = 4) -> Dict[str, Any]:
    """
    Perform optimized media library scan
    
    Args:
        directories: List of directories to scan
        batch_size: Files per batch for processing
        max_workers: Number of parallel workers for file discovery
        
    Returns:
        Dict with scan results and performance statistics
    """
    try:
        # Default directories from environment
        if not directories:
            media_dirs = os.getenv('MEDIA_DIRECTORIES', '/media').split(',')
            directories = [d.strip() for d in media_dirs if d.strip() and os.path.exists(d.strip())]
        
        if not directories:
            return {
                'status': 'failed',
                'error': 'No valid directories to scan'
            }
        
        # Create optimized scanner
        scanner = OptimizedMediaScanner(batch_size=batch_size, max_workers=max_workers)
        
        # Perform scan
        result = scanner.scan_directories(directories)
        
        logger.info(f"✅ Optimized scan completed: {result.get('new_files', 0)} new files processed")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Optimized media scan failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }


@current_app.task(queue='scanning', priority=2)
def incremental_media_scan(directories: List[str] = None, since_hours: int = 24) -> Dict[str, Any]:
    """
    Perform incremental scan for recently modified files
    
    Args:
        directories: List of directories to scan
        since_hours: Only scan files modified in last N hours
        
    Returns:
        Dict with incremental scan results
    """
    try:
        import time
        
        cutoff_time = time.time() - (since_hours * 3600)
        
        # Default directories
        if not directories:
            media_dirs = os.getenv('MEDIA_DIRECTORIES', '/media').split(',')
            directories = [d.strip() for d in media_dirs if d.strip() and os.path.exists(d.strip())]
        
        scanner = OptimizedMediaScanner(batch_size=10, max_workers=2)
        
        # Scan only recently modified files
        recent_files = []
        for directory in directories:
            for root, dirs, files in os.walk(directory):
                for filename in files:
                    file_path = os.path.join(root, filename)
                    try:
                        if os.path.getmtime(file_path) > cutoff_time:
                            stat = os.stat(file_path)
                            recent_files.append({
                                'file_path': file_path,
                                'filename': filename,
                                'size': stat.st_size,
                                'mtime': stat.st_mtime,
                                'extension': Path(filename).suffix.lower()
                            })
                    except OSError:
                        continue
        
        # Filter and process recent media files
        media_files = scanner._filter_media_files(recent_files)
        existing_files = scanner._get_existing_files()
        new_files = [f for f in media_files if f['file_path'] not in existing_files]
        
        if new_files:
            result = scanner._process_files_in_batches(new_files)
            result['incremental'] = True
            result['since_hours'] = since_hours
            result['recent_files_found'] = len(recent_files)
        else:
            result = {
                'status': 'no_new_files',
                'incremental': True,
                'since_hours': since_hours,
                'recent_files_found': len(recent_files),
                'new_files': 0
            }
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Incremental scan failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }
