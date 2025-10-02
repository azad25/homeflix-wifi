#!/usr/bin/env python3
"""
Redis Connection Test for HomeFlix Celery Workers
Tests Redis connectivity and Celery broker configuration
"""

import os
import sys
import time
import redis
from celery import Celery
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_redis_connection():
    """Test direct Redis connection"""
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    print(f"Testing Redis connection to: {redis_url}")
    
    try:
        # Parse Redis URL
        if redis_url.startswith('redis://'):
            # Extract host and port from URL
            url_parts = redis_url.replace('redis://', '').split('/')
            host_port = url_parts[0].split(':')
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 6379
            db = int(url_parts[1]) if len(url_parts) > 1 else 0
        else:
            host, port, db = 'redis', 6379, 0
        
        print(f"Connecting to Redis: host={host}, port={port}, db={db}")
        
        # Create Redis client with simplified settings
        r = redis.Redis(
            host=host,
            port=port,
            db=db,
            socket_connect_timeout=30,
            socket_keepalive=True,
            retry_on_timeout=True,
            health_check_interval=30
        )
        
        # Test connection with retries
        max_retries = 10
        for attempt in range(max_retries):
            try:
                response = r.ping()
                if response:
                    print(f"✅ Redis connection successful on attempt {attempt + 1}")
                    
                    # Test basic operations
                    r.set('test_key', 'test_value', ex=60)
                    value = r.get('test_key')
                    if value == b'test_value':
                        print("✅ Redis read/write operations working")
                        r.delete('test_key')
                        return True
                    else:
                        print("❌ Redis read/write operations failed")
                        return False
                        
            except redis.ConnectionError as e:
                print(f"⚠️  Redis connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)
                    continue
                else:
                    print("❌ Redis connection failed after all retries")
                    return False
            except Exception as e:
                print(f"❌ Unexpected Redis error: {e}")
                return False
                
    except Exception as e:
        print(f"❌ Redis connection setup failed: {e}")
        return False

def test_celery_broker():
    """Test Celery broker connection"""
    print("\nTesting Celery broker connection...")
    
    try:
        # Import celery app
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from celery_app import app
        
        # Test broker connection
        with app.connection() as conn:
            conn.ensure_connection(max_retries=10)
            print("✅ Celery broker connection successful")
            
            # Test basic task routing
            inspector = app.control.inspect()
            try:
                stats = inspector.stats()
                if stats:
                    print("✅ Celery worker inspection working")
                    for worker, stat in stats.items():
                        print(f"  Worker: {worker}")
                        print(f"    Pool: {stat.get('pool', {}).get('implementation', 'unknown')}")
                        print(f"    Processes: {stat.get('pool', {}).get('processes', 'unknown')}")
                else:
                    print("⚠️  No active Celery workers found")
            except Exception as e:
                print(f"⚠️  Celery worker inspection failed: {e}")
            
            return True
            
    except Exception as e:
        print(f"❌ Celery broker connection failed: {e}")
        return False

def main():
    """Main test function"""
    print("HomeFlix Redis & Celery Connection Test")
    print("=" * 50)
    
    # Test Redis connection
    redis_ok = test_redis_connection()
    
    # Test Celery broker
    celery_ok = test_celery_broker()
    
    print("\n" + "=" * 50)
    print("Test Results:")
    print(f"Redis Connection: {'✅ PASS' if redis_ok else '❌ FAIL'}")
    print(f"Celery Broker: {'✅ PASS' if celery_ok else '❌ FAIL'}")
    
    if redis_ok and celery_ok:
        print("\n🎉 All tests passed! Celery workers should connect successfully.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check Redis and Celery configuration.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
