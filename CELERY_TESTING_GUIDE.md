# HomeFlix Celery Testing & Deployment Guide

## 🚀 Quick Start Testing

### Prerequisites
```bash
# Install Redis
sudo apt-get install redis-server
# or
brew install redis

# Install Python dependencies
cd /home/azad/Documents/homeflix/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install Go dependencies
go mod tidy
```

### Start the System
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Celery Workers
cd /home/azad/Documents/homeflix/backend
./start-celery.sh

# Terminal 3: Start Go Backend
go run main.go
```

### Verify System Health
```bash
# Check Redis connection
redis-cli ping
# Expected: PONG

# Check Celery workers
celery -A celery_app status
# Expected: List of active workers

# Check Go backend
curl http://localhost:8251/api/celery/queues/status
# Expected: JSON with queue lengths
```

---

## 🧪 End-to-End Testing

### Test 1: Queue Media Processing
```bash
# Queue comprehensive media processing
curl -X POST http://localhost:8251/api/celery/queue/media/process \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": 1,
    "file_path": "/media/test_movie.mp4",
    "title": "Test Movie",
    "media_type": "movie"
  }'

# Expected Response:
{
  "status": "queued",
  "media_id": 1,
  "title": "Test Movie",
  "media_type": "movie"
}
```

### Test 2: Queue Specific Tasks
```bash
# Queue metadata generation
curl -X POST http://localhost:8251/api/celery/queue/metadata/generate \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": 1,
    "file_path": "/media/test_movie.mp4",
    "title": "Test Movie"
  }'

# Queue thumbnail generation
curl -X POST http://localhost:8251/api/celery/queue/thumbnails/generate \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": 1,
    "file_path": "/media/test_movie.mp4"
  }'

# Queue poster download
curl -X POST http://localhost:8251/api/celery/queue/posters/download \
  -H "Content-Type: application/json" \
  -d '{
    "media_id": 1,
    "title": "Inception",
    "year": 2010,
    "media_type": "movie"
  }'
```

### Test 3: Monitor Queue Status
```bash
# Get all queue lengths
curl http://localhost:8251/api/celery/queues/status

# Get specific queue length
curl http://localhost:8251/api/celery/queues/metadata/length

# Expected Response:
{
  "queue_lengths": {
    "metadata": 0,
    "thumbnails": 0,
    "posters": 0,
    "video_processing": 0,
    "subtitles": 0,
    "scanning": 1
  },
  "queues": {
    "metadata": "AI metadata generation (High Priority)",
    "thumbnails": "Thumbnail & preview generation (High Priority)",
    "posters": "Poster downloads (Medium Priority)",
    "video_processing": "Video analysis & optimization (Medium Priority)",
    "subtitles": "Subtitle extraction (Low Priority)",
    "scanning": "Media scanning & orchestration (Low Priority)"
  }
}
```

### Test 4: Batch Processing
```bash
curl -X POST http://localhost:8251/api/celery/queue/batch/process \
  -H "Content-Type: application/json" \
  -d '{
    "media_list": [
      {
        "media_id": 1,
        "file_path": "/media/movie1.mp4",
        "title": "Movie 1",
        "type": "movie"
      },
      {
        "media_id": 2,
        "file_path": "/media/movie2.mp4",
        "title": "Movie 2",
        "type": "movie"
      }
    ]
  }'
```

### Test 5: Reprocess Media
```bash
# Reprocess with specific tasks
curl -X POST http://localhost:8251/api/celery/media/1/reprocess \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/media/test_movie.mp4",
    "title": "Test Movie",
    "media_type": "movie",
    "tasks": ["metadata", "thumbnails", "posters"],
    "force_regenerate": false
  }'

# Force complete reprocessing
curl -X POST http://localhost:8251/api/celery/media/1/reprocess \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/media/test_movie.mp4",
    "title": "Test Movie",
    "media_type": "movie",
    "force_regenerate": true
  }'
```

---

## 📊 Monitoring & Debugging

### Flower Dashboard
- **URL**: http://localhost:5555
- **Features**: Real-time task monitoring, worker status, queue inspection
- **Usage**: Monitor task progress, identify bottlenecks, debug failures

### Celery Bridge Service
- **URL**: http://localhost:5000
- **Health Check**: `curl http://localhost:5000/health`
- **Features**: HTTP API bridge between Go and Celery

### Log Monitoring
```bash
# Watch Celery worker logs
tail -f celery_worker.log

# Watch Go backend logs
tail -f homeflix-backend.log

# Watch Redis logs
redis-cli monitor
```

### Queue Management
```bash
# Purge specific queue
curl -X DELETE http://localhost:8251/api/celery/queues/metadata/purge

# Purge all queues
redis-cli FLUSHDB
```

---

## 🐳 Docker Testing

### Start with Docker Compose
```bash
# Start entire Celery cluster
docker-compose -f docker-compose.celery.yml up -d

# Check container status
docker-compose -f docker-compose.celery.yml ps

# View logs
docker-compose -f docker-compose.celery.yml logs -f celery_metadata
```

### Scale Workers
```bash
# Scale metadata workers for heavy load
docker-compose -f docker-compose.celery.yml up -d --scale celery_metadata=4

# Scale thumbnail workers
docker-compose -f docker-compose.celery.yml up -d --scale celery_thumbnails=8
```

### Container Health Checks
```bash
# Check Redis container
docker exec homeflix_redis redis-cli ping

# Check worker container
docker exec homeflix_celery_metadata celery -A celery_app status

# Check Flower dashboard
curl http://localhost:5555
```

---

## 🔧 Performance Testing

### Load Testing Script
```python
#!/usr/bin/env python3
import requests
import time
import concurrent.futures
import json

def queue_media_task(media_id):
    """Queue a media processing task"""
    payload = {
        "media_id": media_id,
        "file_path": f"/media/test_movie_{media_id}.mp4",
        "title": f"Test Movie {media_id}",
        "media_type": "movie"
    }
    
    response = requests.post(
        "http://localhost:8251/api/celery/queue/media/process",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    return response.status_code, response.json()

def load_test(num_tasks=100, concurrent_workers=10):
    """Run load test with multiple concurrent requests"""
    print(f"Starting load test: {num_tasks} tasks, {concurrent_workers} workers")
    
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_workers) as executor:
        futures = [executor.submit(queue_media_task, i) for i in range(1, num_tasks + 1)]
        
        results = []
        for future in concurrent.futures.as_completed(futures):
            status_code, response = future.result()
            results.append((status_code, response))
    
    end_time = time.time()
    
    # Analyze results
    successful = len([r for r in results if r[0] == 200])
    failed = len(results) - successful
    
    print(f"Load test completed in {end_time - start_time:.2f} seconds")
    print(f"Successful: {successful}/{num_tasks}")
    print(f"Failed: {failed}/{num_tasks}")
    print(f"Throughput: {num_tasks / (end_time - start_time):.2f} tasks/second")

if __name__ == "__main__":
    load_test(100, 10)
```

### Performance Benchmarks
```bash
# Run load test
python3 load_test.py

# Monitor system resources
htop

# Monitor Redis performance
redis-cli --latency-history

# Monitor queue lengths during load
watch -n 1 'curl -s http://localhost:8251/api/celery/queues/status | jq .queue_lengths'
```

---

## 🚨 Troubleshooting

### Common Issues

#### Redis Connection Failed
```bash
# Check Redis status
systemctl status redis-server

# Start Redis
sudo systemctl start redis-server

# Check Redis configuration
redis-cli config get "*"
```

#### Celery Workers Not Starting
```bash
# Check Python environment
source venv/bin/activate
which python
which celery

# Check dependencies
pip list | grep celery

# Manual worker start
celery -A celery_app worker -Q metadata --loglevel=debug
```

#### Go Backend Connection Issues
```bash
# Check environment variables
env | grep REDIS
env | grep CELERY

# Test Redis connection from Go
go run -c "
package main
import (
    \"github.com/go-redis/redis/v8\"
    \"context\"
    \"fmt\"
)
func main() {
    client := redis.NewClient(&redis.Options{Addr: \"localhost:6379\"})
    pong, err := client.Ping(context.Background()).Result()
    fmt.Println(pong, err)
}
"
```

#### Task Execution Failures
```bash
# Check task logs
celery -A celery_app events

# Inspect failed tasks
celery -A celery_app inspect reserved

# Purge failed tasks
celery -A celery_app purge
```

### Debug Mode
```bash
# Start workers in debug mode
celery -A celery_app worker -Q metadata --loglevel=debug

# Enable Go debug logging
export GIN_MODE=debug
go run main.go

# Enable Python debug logging
export FLASK_DEBUG=true
python celery_bridge.py
```

---

## 📈 Production Deployment

### Environment Configuration
```bash
# Production Redis (with persistence)
redis-server --appendonly yes --save 900 1 --save 300 10

# Production Celery (with monitoring)
celery -A celery_app worker -Q metadata --loglevel=info --pidfile=/var/run/celery/metadata.pid

# Production Go (with proper logging)
./homeflix-backend > /var/log/homeflix/backend.log 2>&1 &
```

### Systemd Services
```ini
# /etc/systemd/system/homeflix-celery-metadata.service
[Unit]
Description=HomeFlix Celery Metadata Worker
After=redis.service

[Service]
Type=forking
User=homeflix
Group=homeflix
WorkingDirectory=/opt/homeflix/backend
Environment=CELERY_BROKER_URL=redis://localhost:6379/0
ExecStart=/opt/homeflix/backend/venv/bin/celery -A celery_app worker -Q metadata --pidfile=/var/run/celery/metadata.pid --detach
ExecStop=/bin/kill -TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

### Monitoring Setup
```bash
# Prometheus metrics
pip install celery-prometheus-exporter

# Grafana dashboard
# Import Celery dashboard template

# Log aggregation
# Configure ELK stack or similar
```

---

## ✅ Test Checklist

### Basic Functionality
- [ ] Redis server starts and accepts connections
- [ ] All 6 Celery workers start successfully
- [ ] Go backend compiles and starts
- [ ] Celery Bridge service responds to health checks
- [ ] Flower monitoring dashboard accessible

### API Endpoints
- [ ] Queue media processing: `POST /api/celery/queue/media/process`
- [ ] Queue metadata generation: `POST /api/celery/queue/metadata/generate`
- [ ] Queue thumbnail generation: `POST /api/celery/queue/thumbnails/generate`
- [ ] Queue poster download: `POST /api/celery/queue/posters/download`
- [ ] Queue batch processing: `POST /api/celery/queue/batch/process`
- [ ] Reprocess media: `POST /api/celery/media/:id/reprocess`
- [ ] Get queue status: `GET /api/celery/queues/status`
- [ ] Get queue length: `GET /api/celery/queues/:queue/length`
- [ ] Purge queue: `DELETE /api/celery/queues/:queue/purge`

### Task Execution
- [ ] Metadata generation tasks execute successfully
- [ ] Thumbnail generation tasks execute successfully
- [ ] Poster download tasks execute successfully
- [ ] Video analysis tasks execute successfully
- [ ] Subtitle extraction tasks execute successfully
- [ ] Batch processing orchestrates correctly

### Error Handling
- [ ] Failed tasks retry with exponential backoff
- [ ] Invalid requests return proper error messages
- [ ] System gracefully handles Redis disconnection
- [ ] Workers recover from crashes
- [ ] Queue purging works correctly

### Performance
- [ ] Multiple tasks execute in parallel
- [ ] High-priority queues process before low-priority
- [ ] System handles 100+ concurrent tasks
- [ ] Memory usage remains stable under load
- [ ] No task deadlocks or infinite loops

---

**Status**: ✅ Ready for Testing  
**Last Updated**: 2025-09-30  
**Version**: 1.0.0
