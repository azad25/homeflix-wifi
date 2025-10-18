#!/bin/bash

# Test script to verify subtitle detection and serving
# This script tests the subtitle functionality

echo "🧪 Testing Subtitle Detection and Serving"
echo "=========================================="

# Configuration
API_BASE="http://localhost:8252/api"
MEDIA_ID=1  # Change this to a valid media ID

echo ""
echo "1. Testing subtitle track detection..."
echo "GET $API_BASE/media/$MEDIA_ID/subtitles"
curl -s "$API_BASE/media/$MEDIA_ID/subtitles" | jq '.' || echo "❌ Failed to get subtitle tracks"

echo ""
echo "2. Testing audio track detection..."
echo "GET $API_BASE/media/$MEDIA_ID/audio"
curl -s "$API_BASE/media/$MEDIA_ID/audio" | jq '.' || echo "❌ Failed to get audio tracks"

echo ""
echo "3. Testing subtitle file serving..."
# First get the tracks to find a valid track ID
TRACK_ID=$(curl -s "$API_BASE/media/$MEDIA_ID/subtitles" | jq -r '.[0].id // empty')

if [ -n "$TRACK_ID" ] && [ "$TRACK_ID" != "null" ]; then
    echo "Found track ID: $TRACK_ID"
    echo "GET $API_BASE/media/$MEDIA_ID/subtitles/$TRACK_ID/file"
    
    # Test subtitle file serving (just check headers)
    curl -I "$API_BASE/media/$MEDIA_ID/subtitles/$TRACK_ID/file" 2>/dev/null | head -5
    
    # Test actual content (first 200 characters)
    echo ""
    echo "Subtitle content preview:"
    curl -s "$API_BASE/media/$MEDIA_ID/subtitles/$TRACK_ID/file" | head -c 200
    echo ""
else
    echo "❌ No subtitle tracks found for media ID $MEDIA_ID"
fi

echo ""
echo "4. Testing media info with stream details..."
echo "GET $API_BASE/media/$MEDIA_ID"
curl -s "$API_BASE/media/$MEDIA_ID" | jq '.title, .file_path' || echo "❌ Failed to get media info"

echo ""
echo "✅ Subtitle testing completed!"
echo ""
echo "To test with a specific media file:"
echo "1. Find a media ID: curl $API_BASE/media | jq '.[] | {id, title, file_path}'"
echo "2. Update MEDIA_ID in this script"
echo "3. Run this script again"