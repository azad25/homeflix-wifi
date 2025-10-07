#!/bin/bash

# Test script for preview generation with fallbacks
# This script tests the new preview generation endpoints

BASE_URL="http://localhost:8252/api"

echo "🎬 Testing Preview Generation with Fallbacks"
echo "============================================="

# Test 1: Regenerate previews for missing media
echo ""
echo "Test 1: Regenerating previews for media with missing preview clips..."
curl -X POST "$BASE_URL/admin/preview-clips/regenerate-missing" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "Test 1 completed."

# Test 2: Get thumbnail service stats
echo ""
echo "Test 2: Getting thumbnail service statistics..."
curl -X GET "$BASE_URL/admin/thumbnail-service/stats" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "Test 2 completed."

# Test 3: Test batch preview generation with fallbacks
echo ""
echo "Test 3: Testing batch preview generation..."

# First get some media IDs
MEDIA_IDS=$(curl -s "$BASE_URL/media" | jq -r '.data[:3] | map(.id) | @json')

if [ "$MEDIA_IDS" != "null" ] && [ "$MEDIA_IDS" != "[]" ]; then
    echo "Using media IDs: $MEDIA_IDS"
    
    curl -X POST "$BASE_URL/admin/preview-clips/batch" \
      -H "Content-Type: application/json" \
      -d "{\"media_ids\": $MEDIA_IDS}" \
      | jq '.'
else
    echo "No media found for batch testing"
fi

echo ""
echo "Test 3 completed."

# Test 4: Test scanner regenerate missing previews
echo ""
echo "Test 4: Testing scanner regenerate missing previews..."
curl -X POST "$BASE_URL/admin/scan/regenerate-missing-previews" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "Test 4 completed."

echo ""
echo "🎬 All tests completed!"
echo "Check the server logs for detailed FFmpeg fallback information."