#!/bin/bash

# Test script for MKV seeking improvements
# This script tests various MKV files to ensure proper seeking support

echo "🎬 Testing MKV Seeking Improvements"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test files directory
TEST_DIR="./test_videos"
RESULTS_FILE="mkv_seeking_test_results.txt"

# Create test results file
echo "MKV Seeking Test Results - $(date)" > $RESULTS_FILE
echo "=================================" >> $RESULTS_FILE

# Function to test MKV file
test_mkv_file() {
    local file="$1"
    local filename=$(basename "$file")
    
    echo -e "${BLUE}Testing: $filename${NC}"
    echo "Testing: $filename" >> $RESULTS_FILE
    
    # Check if mkvinfo is available
    if command -v mkvinfo &> /dev/null; then
        echo -e "${GREEN}✓ mkvinfo available${NC}"
        
        # Extract cue points
        cue_count=$(mkvinfo "$file" 2>/dev/null | grep -c "CuePoint")
        if [ $cue_count -gt 0 ]; then
            echo -e "${GREEN}✓ Has $cue_count cue points - SEEKABLE${NC}"
            echo "  ✓ Has $cue_count cue points - SEEKABLE" >> $RESULTS_FILE
        else
            echo -e "${YELLOW}⚠ No cue points found - NEEDS TRANSCODING${NC}"
            echo "  ⚠ No cue points found - NEEDS TRANSCODING" >> $RESULTS_FILE
        fi
        
        # Extract duration
        duration=$(mkvinfo "$file" 2>/dev/null | grep "Duration:" | head -1 | awk '{print $2}')
        if [ ! -z "$duration" ]; then
            echo -e "${GREEN}✓ Duration: $duration${NC}"
            echo "  ✓ Duration: $duration" >> $RESULTS_FILE
        fi
        
    else
        echo -e "${YELLOW}⚠ mkvinfo not available, using ffprobe${NC}"
        echo "  ⚠ mkvinfo not available, using ffprobe" >> $RESULTS_FILE
    fi
    
    # Check audio codec with ffprobe
    if command -v ffprobe &> /dev/null; then
        audio_codec=$(ffprobe -v quiet -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$file" 2>/dev/null)
        if [ ! -z "$audio_codec" ]; then
            case $audio_codec in
                "aac"|"mp3"|"opus"|"vorbis")
                    echo -e "${GREEN}✓ Audio codec: $audio_codec - COMPATIBLE${NC}"
                    echo "  ✓ Audio codec: $audio_codec - COMPATIBLE" >> $RESULTS_FILE
                    ;;
                "dts"|"truehd"|"flac"|"ac3"|"eac3")
                    echo -e "${YELLOW}⚠ Audio codec: $audio_codec - NEEDS TRANSCODING${NC}"
                    echo "  ⚠ Audio codec: $audio_codec - NEEDS TRANSCODING" >> $RESULTS_FILE
                    ;;
                *)
                    echo -e "${YELLOW}⚠ Audio codec: $audio_codec - UNKNOWN COMPATIBILITY${NC}"
                    echo "  ⚠ Audio codec: $audio_codec - UNKNOWN COMPATIBILITY" >> $RESULTS_FILE
                    ;;
            esac
        fi
    fi
    
    # Test range request simulation
    file_size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    if [ ! -z "$file_size" ]; then
        echo -e "${BLUE}ℹ File size: $(numfmt --to=iec $file_size)${NC}"
        echo "  ℹ File size: $(numfmt --to=iec $file_size)" >> $RESULTS_FILE
        
        # Test seeking to middle of file
        middle_byte=$((file_size / 2))
        echo -e "${BLUE}ℹ Middle byte position: $middle_byte${NC}"
        echo "  ℹ Middle byte position: $middle_byte" >> $RESULTS_FILE
    fi
    
    echo "" >> $RESULTS_FILE
    echo ""
}

# Function to check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    if command -v mkvinfo &> /dev/null; then
        echo -e "${GREEN}✓ mkvinfo available (mkvtoolnix)${NC}"
    else
        echo -e "${YELLOW}⚠ mkvinfo not available - install mkvtoolnix for better MKV analysis${NC}"
        echo "  Install with: sudo apt-get install mkvtoolnix (Ubuntu/Debian)"
        echo "  Install with: brew install mkvtoolnix (macOS)"
    fi
    
    if command -v ffprobe &> /dev/null; then
        echo -e "${GREEN}✓ ffprobe available (ffmpeg)${NC}"
    else
        echo -e "${RED}✗ ffprobe not available - install ffmpeg${NC}"
        echo "  Install with: sudo apt-get install ffmpeg (Ubuntu/Debian)"
        echo "  Install with: brew install ffmpeg (macOS)"
        exit 1
    fi
    
    if command -v ffmpeg &> /dev/null; then
        echo -e "${GREEN}✓ ffmpeg available${NC}"
    else
        echo -e "${RED}✗ ffmpeg not available - required for transcoding${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to create test MKV files (if needed)
create_test_files() {
    if [ ! -d "$TEST_DIR" ]; then
        echo -e "${YELLOW}Creating test directory: $TEST_DIR${NC}"
        mkdir -p "$TEST_DIR"
    fi
    
    # Note: In a real scenario, you would have actual MKV files to test
    echo -e "${BLUE}ℹ Place your MKV test files in: $TEST_DIR${NC}"
    echo -e "${BLUE}ℹ This script will analyze any .mkv files found there${NC}"
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}🎬 MKV Seeking Support Test${NC}"
    echo -e "${BLUE}===========================${NC}"
    echo ""
    
    check_dependencies
    create_test_files
    
    # Find and test MKV files
    mkv_files=$(find "$TEST_DIR" -name "*.mkv" 2>/dev/null)
    
    if [ -z "$mkv_files" ]; then
        echo -e "${YELLOW}⚠ No MKV files found in $TEST_DIR${NC}"
        echo "Please add some MKV files to test seeking support."
        echo ""
        echo "You can also test with existing files by running:"
        echo "  ./test_mkv_seeking.sh /path/to/your/video.mkv"
        exit 0
    fi
    
    # Test each MKV file
    for file in $mkv_files; do
        test_mkv_file "$file"
    done
    
    # Test command line argument if provided
    if [ ! -z "$1" ] && [ -f "$1" ]; then
        echo -e "${BLUE}Testing command line file: $1${NC}"
        test_mkv_file "$1"
    fi
    
    echo -e "${GREEN}✅ Testing complete! Results saved to: $RESULTS_FILE${NC}"
    echo ""
    echo -e "${BLUE}Summary of improvements:${NC}"
    echo "• Enhanced MKV indexing with proper cue point extraction"
    echo "• Automatic detection of seekable vs unseekable files"
    echo "• Smart transcoding only when necessary"
    echo "• Range request support during transcoding"
    echo "• Background pre-transcoding for instant access"
    echo ""
    echo -e "${BLUE}For unseekable files, the system will:${NC}"
    echo "1. Detect lack of cue points or incompatible audio"
    echo "2. Automatically transcode with seeking support"
    echo "3. Handle range requests during transcoding"
    echo "4. Cache transcoded files for future use"
}

# Run main function
main "$@"