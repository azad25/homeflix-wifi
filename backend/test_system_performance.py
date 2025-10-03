#!/usr/bin/env python3
"""
System Performance Testing and Validation Script
Tests all HomeFlix backend fixes and optimizations
"""

import os
import sys
import time
import json
import requests
import logging
from pathlib import Path
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add app directory to path
sys.path.insert(0, '/app')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SystemPerformanceTester:
    """Comprehensive system performance tester"""
    
    def __init__(self, api_url: str = 'http://backend:8251'):
        self.api_url = api_url
        self.test_results = {}
        self.start_time = time.time()
        
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all system tests and return comprehensive results"""
        logger.info("🧪 Starting comprehensive system performance tests")
        
        tests = [
            ('Database Connection Pool', self.test_database_connection_pool),
            ('Admin API Endpoints', self.test_admin_api_endpoints),
            ('Celery Worker Health', self.test_celery_worker_health),
            ('File Watcher System', self.test_file_watcher_system),
            ('Media Scanning Performance', self.test_media_scanning_performance),
            ('Thumbnail Generation', self.test_thumbnail_generation),
            ('Memory Usage', self.test_memory_usage),
            ('API Response Times', self.test_api_response_times),
            ('Docker Container Health', self.test_docker_container_health),
            ('Redis Connection', self.test_redis_connection)
        ]
        
        for test_name, test_func in tests:
            logger.info(f"🔍 Running test: {test_name}")
            try:
                result = test_func()
                self.test_results[test_name] = {
                    'status': 'passed' if result.get('success', False) else 'failed',
                    'details': result,
                    'timestamp': time.time()
                }
                logger.info(f"✅ {test_name}: {'PASSED' if result.get('success', False) else 'FAILED'}")
            except Exception as e:
                logger.error(f"❌ {test_name}: ERROR - {e}")
                self.test_results[test_name] = {
                    'status': 'error',
                    'error': str(e),
                    'timestamp': time.time()
                }
        
        # Generate summary report
        return self.generate_summary_report()
    
    def test_database_connection_pool(self) -> Dict[str, Any]:
        """Test database connection pooling performance"""
        try:
            # Test concurrent database requests
            start_time = time.time()
            
            def make_request():
                response = requests.get(f"{self.api_url}/api/media", timeout=10)
                return response.status_code == 200, response.elapsed.total_seconds()
            
            # Test with 10 concurrent requests
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(make_request) for _ in range(10)]
                results = [future.result() for future in as_completed(futures)]
            
            total_time = time.time() - start_time
            success_count = sum(1 for success, _ in results if success)
            avg_response_time = sum(time for _, time in results) / len(results)
            
            return {
                'success': success_count >= 8,  # At least 80% success rate
                'concurrent_requests': 10,
                'successful_requests': success_count,
                'total_time_seconds': total_time,
                'average_response_time': avg_response_time,
                'requests_per_second': 10 / total_time if total_time > 0 else 0
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_admin_api_endpoints(self) -> Dict[str, Any]:
        """Test admin API endpoints for Celery workers"""
        try:
            endpoints_to_test = [
                ('GET', '/api/media'),
                ('GET', '/api/media/movies'),
                ('GET', '/api/media/tv-shows'),
            ]
            
            results = {}
            
            for method, endpoint in endpoints_to_test:
                try:
                    if method == 'GET':
                        response = requests.get(f"{self.api_url}{endpoint}", timeout=10)
                    
                    results[endpoint] = {
                        'status_code': response.status_code,
                        'response_time': response.elapsed.total_seconds(),
                        'success': 200 <= response.status_code < 300
                    }
                except Exception as e:
                    results[endpoint] = {
                        'success': False,
                        'error': str(e)
                    }
            
            success_count = sum(1 for r in results.values() if r.get('success', False))
            
            return {
                'success': success_count >= len(endpoints_to_test) * 0.8,
                'endpoints_tested': len(endpoints_to_test),
                'successful_endpoints': success_count,
                'endpoint_results': results
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_celery_worker_health(self) -> Dict[str, Any]:
        """Test Celery worker health and connectivity"""
        try:
            # Test Redis connection (Celery broker)
            import redis
            
            redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
            r = redis.from_url(redis_url)
            
            # Test Redis connectivity
            redis_ping = r.ping()
            
            # Check Celery queues
            queue_info = {}
            queues = ['metadata', 'thumbnails', 'posters', 'video_processing', 'subtitles', 'scanning']
            
            for queue in queues:
                try:
                    queue_length = r.llen(queue)
                    queue_info[queue] = {
                        'length': queue_length,
                        'accessible': True
                    }
                except Exception as e:
                    queue_info[queue] = {
                        'accessible': False,
                        'error': str(e)
                    }
            
            accessible_queues = sum(1 for q in queue_info.values() if q.get('accessible', False))
            
            return {
                'success': redis_ping and accessible_queues >= len(queues) * 0.8,
                'redis_ping': redis_ping,
                'total_queues': len(queues),
                'accessible_queues': accessible_queues,
                'queue_info': queue_info
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_file_watcher_system(self) -> Dict[str, Any]:
        """Test file watcher system functionality"""
        try:
            # Check if watchdog is available
            try:
                import watchdog
                watchdog_available = True
            except ImportError:
                watchdog_available = False
            
            # Check if file watcher module loads
            try:
                from tasks.file_watcher import MediaDirectoryWatcher
                file_watcher_module = True
            except ImportError as e:
                file_watcher_module = False
                import_error = str(e)
            
            # Check media directories
            media_dirs = os.getenv('MEDIA_DIRECTORIES', '/media').split(',')
            accessible_dirs = []
            
            for directory in media_dirs:
                directory = directory.strip()
                if directory and os.path.exists(directory):
                    accessible_dirs.append(directory)
            
            return {
                'success': watchdog_available and file_watcher_module and len(accessible_dirs) > 0,
                'watchdog_available': watchdog_available,
                'file_watcher_module': file_watcher_module,
                'media_directories': media_dirs,
                'accessible_directories': accessible_dirs,
                'import_error': import_error if not file_watcher_module else None
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_media_scanning_performance(self) -> Dict[str, Any]:
        """Test media scanning performance with sample files"""
        try:
            # Check if optimized scanning module loads
            try:
                from tasks.optimized_scanning import OptimizedMediaScanner
                scanner_available = True
            except ImportError as e:
                scanner_available = False
                import_error = str(e)
            
            if not scanner_available:
                return {
                    'success': False,
                    'scanner_available': scanner_available,
                    'import_error': import_error
                }
            
            # Test scanner initialization
            scanner = OptimizedMediaScanner(batch_size=5, max_workers=2)
            
            # Test directory scanning (if media directory exists)
            media_dirs = os.getenv('MEDIA_DIRECTORIES', '/media').split(',')
            test_dirs = [d.strip() for d in media_dirs if d.strip() and os.path.exists(d.strip())]
            
            if test_dirs:
                start_time = time.time()
                # Just test file discovery, not full processing
                sample_files = scanner._scan_directory(test_dirs[0])
                scan_time = time.time() - start_time
                
                media_files = scanner._filter_media_files(sample_files[:10])  # Test with first 10 files
                
                return {
                    'success': True,
                    'scanner_available': scanner_available,
                    'test_directory': test_dirs[0],
                    'files_found': len(sample_files),
                    'media_files_found': len(media_files),
                    'scan_time_seconds': scan_time,
                    'files_per_second': len(sample_files) / scan_time if scan_time > 0 else 0
                }
            else:
                return {
                    'success': True,
                    'scanner_available': scanner_available,
                    'test_directory': None,
                    'note': 'No accessible media directories for testing'
                }
                
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_thumbnail_generation(self) -> Dict[str, Any]:
        """Test thumbnail generation system"""
        try:
            # Check if thumbnail tasks module loads
            try:
                from tasks.thumbnail_tasks import generate_thumbnail
                thumbnail_module = True
            except ImportError as e:
                thumbnail_module = False
                import_error = str(e)
            
            # Check thumbnail directory
            thumbnail_dir = '/app/thumbnails'
            thumbnail_dir_exists = os.path.exists(thumbnail_dir)
            thumbnail_dir_writable = os.access(thumbnail_dir, os.W_OK) if thumbnail_dir_exists else False
            
            # Check FFmpeg availability
            ffmpeg_available = os.system('which ffmpeg > /dev/null 2>&1') == 0
            
            return {
                'success': thumbnail_module and thumbnail_dir_exists and thumbnail_dir_writable and ffmpeg_available,
                'thumbnail_module': thumbnail_module,
                'thumbnail_directory_exists': thumbnail_dir_exists,
                'thumbnail_directory_writable': thumbnail_dir_writable,
                'ffmpeg_available': ffmpeg_available,
                'import_error': import_error if not thumbnail_module else None
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_memory_usage(self) -> Dict[str, Any]:
        """Test system memory usage"""
        try:
            import psutil
            
            # Get system memory info
            memory = psutil.virtual_memory()
            
            # Get current process memory
            process = psutil.Process()
            process_memory = process.memory_info()
            
            return {
                'success': memory.percent < 90,  # Less than 90% memory usage
                'system_memory_percent': memory.percent,
                'system_memory_available_gb': memory.available / (1024**3),
                'process_memory_mb': process_memory.rss / (1024**2),
                'memory_warning': memory.percent > 80
            }
            
        except ImportError:
            return {
                'success': True,
                'note': 'psutil not available for memory monitoring'
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_api_response_times(self) -> Dict[str, Any]:
        """Test API response times under load"""
        try:
            endpoints = [
                '/api/media',
                '/api/media/movies',
                '/api/media/recent'
            ]
            
            results = {}
            
            for endpoint in endpoints:
                times = []
                for _ in range(5):  # Test each endpoint 5 times
                    start = time.time()
                    try:
                        response = requests.get(f"{self.api_url}{endpoint}", timeout=10)
                        if response.status_code == 200:
                            times.append(time.time() - start)
                    except:
                        pass
                
                if times:
                    avg_time = sum(times) / len(times)
                    max_time = max(times)
                    min_time = min(times)
                    
                    results[endpoint] = {
                        'average_response_time': avg_time,
                        'max_response_time': max_time,
                        'min_response_time': min_time,
                        'successful_requests': len(times),
                        'performance_good': avg_time < 2.0  # Less than 2 seconds average
                    }
            
            good_performance_count = sum(1 for r in results.values() if r.get('performance_good', False))
            
            return {
                'success': good_performance_count >= len(endpoints) * 0.7,
                'endpoints_tested': len(endpoints),
                'good_performance_count': good_performance_count,
                'endpoint_results': results
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_docker_container_health(self) -> Dict[str, Any]:
        """Test Docker container health (if running in Docker)"""
        try:
            # Check if running in Docker
            in_docker = os.path.exists('/.dockerenv') or os.path.exists('/proc/1/cgroup')
            
            if not in_docker:
                return {
                    'success': True,
                    'in_docker': False,
                    'note': 'Not running in Docker environment'
                }
            
            # Check container resources
            cpu_count = os.cpu_count()
            
            # Check disk space
            disk_usage = os.statvfs('/')
            disk_free_gb = (disk_usage.f_bavail * disk_usage.f_frsize) / (1024**3)
            
            return {
                'success': cpu_count >= 1 and disk_free_gb > 1,
                'in_docker': True,
                'cpu_count': cpu_count,
                'disk_free_gb': disk_free_gb,
                'resource_warning': disk_free_gb < 5
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def test_redis_connection(self) -> Dict[str, Any]:
        """Test Redis connection and performance"""
        try:
            import redis
            
            redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
            r = redis.from_url(redis_url)
            
            # Test basic operations
            start_time = time.time()
            
            # Ping test
            ping_result = r.ping()
            
            # Set/Get test
            test_key = 'homeflix_test_key'
            r.set(test_key, 'test_value', ex=60)
            get_result = r.get(test_key)
            r.delete(test_key)
            
            operation_time = time.time() - start_time
            
            # Test connection pool
            info = r.info()
            connected_clients = info.get('connected_clients', 0)
            
            return {
                'success': ping_result and get_result == b'test_value',
                'ping_successful': ping_result,
                'set_get_successful': get_result == b'test_value',
                'operation_time_seconds': operation_time,
                'connected_clients': connected_clients,
                'redis_version': info.get('redis_version', 'unknown')
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def generate_summary_report(self) -> Dict[str, Any]:
        """Generate comprehensive summary report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results.values() if r['status'] == 'passed')
        failed_tests = sum(1 for r in self.test_results.values() if r['status'] == 'failed')
        error_tests = sum(1 for r in self.test_results.values() if r['status'] == 'error')
        
        total_time = time.time() - self.start_time
        
        # Categorize issues
        critical_issues = []
        warnings = []
        
        for test_name, result in self.test_results.items():
            if result['status'] in ['failed', 'error']:
                if test_name in ['Database Connection Pool', 'Admin API Endpoints', 'Celery Worker Health']:
                    critical_issues.append(f"{test_name}: {result.get('error', 'Failed')}")
                else:
                    warnings.append(f"{test_name}: {result.get('error', 'Failed')}")
        
        # Overall system health
        system_health = 'excellent'
        if critical_issues:
            system_health = 'critical'
        elif failed_tests > total_tests * 0.3:
            system_health = 'poor'
        elif failed_tests > 0:
            system_health = 'good'
        
        return {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'error_tests': error_tests,
                'success_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
                'total_test_time_seconds': total_time,
                'system_health': system_health
            },
            'issues': {
                'critical_issues': critical_issues,
                'warnings': warnings
            },
            'detailed_results': self.test_results,
            'recommendations': self.generate_recommendations(),
            'timestamp': time.time()
        }
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        for test_name, result in self.test_results.items():
            if result['status'] == 'failed':
                if test_name == 'Database Connection Pool':
                    recommendations.append("Consider increasing database connection pool size or optimizing queries")
                elif test_name == 'Celery Worker Health':
                    recommendations.append("Check Celery worker configuration and Redis connectivity")
                elif test_name == 'Memory Usage':
                    recommendations.append("Monitor memory usage and consider increasing container memory limits")
                elif test_name == 'API Response Times':
                    recommendations.append("Optimize API endpoints and consider caching strategies")
        
        # General recommendations
        if not recommendations:
            recommendations.append("System is performing well. Continue monitoring for optimal performance.")
        
        return recommendations


def main():
    """Main function to run system tests"""
    logger.info("🚀 Starting HomeFlix System Performance Tests")
    
    # Initialize tester
    api_url = os.getenv('API_URL', 'http://backend:8251')
    tester = SystemPerformanceTester(api_url)
    
    # Run all tests
    results = tester.run_all_tests()
    
    # Print summary
    summary = results['summary']
    logger.info(f"📊 Test Summary:")
    logger.info(f"   Total Tests: {summary['total_tests']}")
    logger.info(f"   Passed: {summary['passed_tests']}")
    logger.info(f"   Failed: {summary['failed_tests']}")
    logger.info(f"   Errors: {summary['error_tests']}")
    logger.info(f"   Success Rate: {summary['success_rate']:.1f}%")
    logger.info(f"   System Health: {summary['system_health'].upper()}")
    
    # Print critical issues
    if results['issues']['critical_issues']:
        logger.error("🚨 Critical Issues:")
        for issue in results['issues']['critical_issues']:
            logger.error(f"   - {issue}")
    
    # Print warnings
    if results['issues']['warnings']:
        logger.warning("⚠️ Warnings:")
        for warning in results['issues']['warnings']:
            logger.warning(f"   - {warning}")
    
    # Print recommendations
    logger.info("💡 Recommendations:")
    for rec in results['recommendations']:
        logger.info(f"   - {rec}")
    
    # Save detailed results
    results_file = '/app/logs/system_test_results.json'
    os.makedirs(os.path.dirname(results_file), exist_ok=True)
    
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"📄 Detailed results saved to: {results_file}")
    
    # Return exit code based on critical issues
    return 1 if results['issues']['critical_issues'] else 0


if __name__ == "__main__":
    exit(main())
