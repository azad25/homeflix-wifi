#!/bin/bash

# Auto Permissions Setup - Minimal version for automatic execution
# This script automatically sets basic permissions without user interaction

# Make all shell scripts executable
find . -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true

# Create and set permissions for essential directories
mkdir -p config setup-data jackett-config downloads 2>/dev/null || true
mkdir -p backend/thumbnails backend/posters backend/previews backend/subtitles backend/optimized backend/backdrops backend/logos backend/alac_audio 2>/dev/null || true
mkdir -p thumbnails posters previews subtitles optimized 2>/dev/null || true

# Set directory permissions
chmod 755 config setup-data jackett-config downloads 2>/dev/null || true
chmod 755 backend/thumbnails backend/posters backend/previews backend/subtitles backend/optimized backend/backdrops backend/logos backend/alac_audio 2>/dev/null || true
chmod 755 thumbnails posters previews subtitles optimized 2>/dev/null || true

# Set database permissions
chmod 644 backend/homeflix.db 2>/dev/null || true

# Set config file permissions (more restrictive for security)
find config -name "*.env" -type f -exec chmod 600 {} \; 2>/dev/null || true
find config -name "*.json" -type f -exec chmod 644 {} \; 2>/dev/null || true

# Set log file permissions
chmod 644 *.log 2>/dev/null || true
chmod 644 *.pid 2>/dev/null || true

# Set Docker file permissions
chmod 644 docker-compose*.yml 2>/dev/null || true
find . -name "Dockerfile*" -type f -exec chmod 644 {} \; 2>/dev/null || true

# Silent success - no output unless there's an error
exit 0