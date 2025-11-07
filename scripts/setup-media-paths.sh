#!/bin/bash

echo "🎬 HomeFlix Media Paths Setup"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create torrent download directory
TORRENT_DIR="$HOME/Downloads/homeflix"
echo -e "${BLUE}📁 Setting up torrent download directory...${NC}"

if [ ! -d "$TORRENT_DIR" ]; then
    mkdir -p "$TORRENT_DIR"
    echo -e "${GREEN}✅ Created torrent directory: $TORRENT_DIR${NC}"
else
    echo -e "${YELLOW}📁 Torrent directory already exists: $TORRENT_DIR${NC}"
fi

# Set proper permissions
chmod 755 "$TORRENT_DIR"
echo -e "${GREEN}✅ Set permissions for torrent directory${NC}"

# Check if primary media directory exists
PRIMARY_DIR="/media/azad/Movies1"
echo -e "\n${BLUE}📁 Checking primary media directory...${NC}"

if [ -d "$PRIMARY_DIR" ]; then
    echo -e "${GREEN}✅ Primary media directory exists: $PRIMARY_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  Primary media directory not found: $PRIMARY_DIR${NC}"
    echo -e "${YELLOW}   This will be created automatically when HomeFlix starts${NC}"
fi

echo -e "\n${BLUE}🔧 System Configuration${NC}"
echo "Primary Media Path: $PRIMARY_DIR"
echo "Torrent Downloads:  $TORRENT_DIR"
echo ""

echo -e "${GREEN}✅ Media Paths Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Start HomeFlix server"
echo "2. Go to Settings > Media Paths"
echo "3. Verify both paths are configured and active"
echo "4. Add any additional external drives or network storage"
echo ""
echo -e "${YELLOW}How it works:${NC}"
echo "• Torrents download to: $TORRENT_DIR"
echo "• HomeFlix scans both directories automatically"
echo "• New downloads appear in your library instantly"
echo "• You can add more paths through the web interface"