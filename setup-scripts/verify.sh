#!/bin/bash

# HomeFlix Installation Verification Script
set -e

echo "🔍 HomeFlix Installation Verification"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

fail() {
    echo -e "${RED}❌${NC} $1"
}

# Check Docker containers
check_containers() {
    log "Checking Docker containers..."
    
    local containers=("homeflix-backend" "homeflix-frontend" "homeflix-redis")
    local all_running=true
    
    for container in "${containers[@]}"; do
        if docker-compose ps "$container" | grep -q "Up"; then
            success "$container is running"
        else
            fail "$container is not running"
            all_running=false
        fi
    done
    
    # Check optional containers
    if docker-compose ps homeflix-jackett | grep -q "Up"; then
        success "homeflix-jackett is running (torrent support enabled)"
    else
        warn "homeflix-jackett is not running (torrent support disabled)"
    fi
    
    return $all_running
}

# Check service health
check_services() {
    log "Checking service health..."
    
    local services_ok=true
    
    # Check backend health
    if curl -f -s http://localhost:8252/api/health > /dev/null; then
        success "Backend API is responding"
    else
        fail "Backend API is not responding"
        services_ok=false
    fi
    
    # Check frontend
    if curl -f -s http://localhost:3008 > /dev/null; then
        success "Frontend is responding"
    else
        fail "Frontend is not responding"
        services_ok=false
    fi
    
    # Check Redis
    if docker exec homeflix-redis redis-cli ping | grep -q "PONG"; then
        success "Redis is responding"
    else
        fail "Redis is not responding"
        services_ok=false
    fi
    
    return $services_ok
}

# Check database
check_database() {
    log "Checking database..."
    
    if [ -f "backend/homeflix.db" ]; then
        success "Database file exists"
        
        # Check database size
        db_size=$(stat -f%z backend/homeflix.db 2>/dev/null || stat -c%s backend/homeflix.db 2>/dev/null || echo "0")
        if [ "$db_size" -gt 0 ]; then
            success "Database is initialized (${db_size} bytes)"
        else
            warn "Database file is empty"
        fi
    else
        fail "Database file not found"
        return 1
    fi
}

# Check media directories
check_media_directories() {
    log "Checking media directories..."
    
    local dirs=("backend/thumbnails" "backend/posters" "backend/previews" "backend/subtitles" "backend/optimized")
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            success "$dir exists"
        else
            fail "$dir not found"
        fi
    done
}

# Check configuration files
check_configuration() {
    log "Checking configuration..."
    
    if [ -f "config/.env" ]; then
        success "Environment configuration exists"
    else
        warn "Environment configuration not found"
    fi
    
    if [ -f "config/system.json" ]; then
        success "System configuration exists"
        
        # Check if setup is marked as complete
        if grep -q '"setupComplete": true' config/system.json; then
            success "Setup marked as complete"
        else
            warn "Setup not marked as complete"
        fi
    else
        warn "System configuration not found"
    fi
}

# Check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    local local_ip=$(hostname -I | awk '{print $1}')
    
    echo "Network Information:"
    echo "  Local IP: $local_ip"
    echo "  Frontend: http://localhost:3008"
    echo "  Backend:  http://localhost:8252"
    echo "  Network:  http://$local_ip:3008"
    
    # Check if ports are accessible
    if netstat -tlnp 2>/dev/null | grep -q ":3008 " || ss -tlnp 2>/dev/null | grep -q ":3008 "; then
        success "Frontend port 3008 is open"
    else
        fail "Frontend port 3008 is not accessible"
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":8252 " || ss -tlnp 2>/dev/null | grep -q ":8252 "; then
        success "Backend port 8252 is open"
    else
        fail "Backend port 8252 is not accessible"
    fi
}

# Check system resources
check_resources() {
    log "Checking system resources..."
    
    # Check memory usage
    local memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep homeflix || echo "No containers found")
    if [ "$memory_usage" != "No containers found" ]; then
        echo "Memory Usage:"
        echo "$memory_usage"
    fi
    
    # Check disk usage
    local disk_usage=$(df -h . | tail -1 | awk '{print $4}')
    echo "Available disk space: $disk_usage"
    
    # Check Docker disk usage
    local docker_usage=$(docker system df 2>/dev/null || echo "Unable to check Docker disk usage")
    if [ "$docker_usage" != "Unable to check Docker disk usage" ]; then
        echo "Docker disk usage:"
        echo "$docker_usage"
    fi
}

# Generate verification report
generate_report() {
    log "Generating verification report..."
    
    local report_file="homeflix_verification_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "HomeFlix Installation Verification Report"
        echo "========================================"
        echo "Date: $(date)"
        echo "System: $(uname -a)"
        echo ""
        
        echo "Container Status:"
        docker-compose ps
        echo ""
        
        echo "Service Logs (last 20 lines):"
        echo "--- Backend ---"
        docker-compose logs --tail=20 homeflix-backend 2>/dev/null || echo "Backend logs not available"
        echo ""
        echo "--- Frontend ---"
        docker-compose logs --tail=20 homeflix-frontend 2>/dev/null || echo "Frontend logs not available"
        echo ""
        
        echo "System Resources:"
        docker stats --no-stream 2>/dev/null || echo "Docker stats not available"
        echo ""
        
        echo "Network Information:"
        echo "Local IP: $(hostname -I | awk '{print $1}')"
        echo "Open Ports:"
        netstat -tlnp 2>/dev/null | grep -E ":(3008|8252|6379|9117) " || ss -tlnp 2>/dev/null | grep -E ":(3008|8252|6379|9117) " || echo "Port information not available"
        
    } > "$report_file"
    
    success "Verification report saved to: $report_file"
}

# Main verification process
main() {
    log "Starting HomeFlix verification..."
    
    local overall_status=true
    
    # Run all checks
    check_containers || overall_status=false
    echo ""
    
    check_services || overall_status=false
    echo ""
    
    check_database || overall_status=false
    echo ""
    
    check_media_directories
    echo ""
    
    check_configuration
    echo ""
    
    check_network
    echo ""
    
    check_resources
    echo ""
    
    generate_report
    echo ""
    
    # Final status
    if [ "$overall_status" = true ]; then
        echo -e "${GREEN}🎉 HomeFlix verification completed successfully!${NC}"
        echo ""
        echo "Your HomeFlix installation is working correctly."
        echo "Access your media platform at: ${BLUE}http://localhost:3008${NC}"
    else
        echo -e "${RED}⚠️  HomeFlix verification found issues.${NC}"
        echo ""
        echo "Please check the errors above and run the verification again."
        echo "You can also check the logs with: docker-compose logs"
    fi
}

# Run main function
main "$@"