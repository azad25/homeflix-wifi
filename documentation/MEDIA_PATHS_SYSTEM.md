# HomeFlix Media Paths System

## Overview

HomeFlix now supports multiple media directories through a configurable media paths system. This allows you to:

- **Scan multiple directories** for media files
- **Manage torrent downloads separately** from your main media collection
- **Add external drives** and network storage
- **Configure scanning priorities** for different paths

## How It Works

### 1. Torrent Downloads
- **Download Location**: `~/Downloads/homeflix` (configurable)
- **Purpose**: Separate directory for torrent downloads
- **Integration**: Automatically added to HomeFlix's scanning paths

### 2. Primary Media Collection
- **Location**: `/media/azad/Movies1` (your main collection)
- **Purpose**: Main HomeFlix media library
- **Priority**: Highest (scanned first)

### 3. Additional Paths
- **External Drives**: USB drives, network storage, etc.
- **Custom Directories**: Any additional media folders
- **Configurable**: Add/remove through settings page

## Configuration

### Default Setup
When HomeFlix starts, it automatically creates these default paths:

```
1. Primary Media Path
   - Path: /media/azad/Movies1
   - Type: primary
   - Priority: 100 (highest)
   - Status: Active

2. Torrent Downloads
   - Path: ~/Downloads/homeflix
   - Type: torrent
   - Priority: 50
   - Status: Active
```

### Adding New Paths
Use the **Settings > Media Paths** tab to:

1. **Add External Drives**
   ```
   Path: /mnt/usb-drive/movies
   Name: USB Movies
   Type: external
   Priority: 25
   ```

2. **Add Network Storage**
   ```
   Path: /mnt/nas/media
   Name: NAS Media
   Type: external
   Priority: 30
   ```

3. **Add Custom Directories**
   ```
   Path: /home/user/personal-movies
   Name: Personal Collection
   Type: external
   Priority: 10
   ```

## Path Types

### Primary
- Main HomeFlix media collection
- Highest priority scanning
- Usually your permanent media storage

### Torrent
- Torrent download directories
- Automatically scanned when downloads complete
- Can have multiple torrent paths

### External
- External drives, USB storage
- Network attached storage (NAS)
- Temporary or secondary collections

## Scanning Behavior

### Priority-Based Scanning
- **Higher priority paths scanned first**
- **Priority 100**: Primary media (scanned first)
- **Priority 50**: Torrent downloads
- **Priority 25**: External drives
- **Priority 10**: Custom directories

### Automatic Detection
- **New files detected automatically** in all active paths
- **Torrent completion triggers scan** of torrent paths
- **File watcher monitors** all configured paths

## API Endpoints

### Media Paths Management
```bash
# Get all media paths
GET /api/admin/media-paths

# Add new media path
POST /api/admin/media-paths
{
  "path": "/path/to/media",
  "name": "Display Name",
  "description": "Optional description",
  "path_type": "primary|torrent|external",
  "priority": 50
}

# Update media path
PUT /api/admin/media-paths/{id}
{
  "is_active": true,
  "priority": 75
}

# Delete media path
DELETE /api/admin/media-paths/{id}
```

### Torrent Configuration
```bash
# Get torrent config (includes download path)
GET /api/torrent/config

# Update torrent config
PUT /api/torrent/config
{
  "download_path": "~/Downloads/homeflix",
  "jackett_url": "http://localhost:9117",
  "jackett_api_key": "your-api-key"
}
```

## Benefits

### 🎯 Organized Downloads
- Torrents download to separate directory
- No mixing with main media collection
- Easy to manage and organize

### 📁 Flexible Storage
- Support for multiple drives
- External USB drives
- Network storage (NAS)
- Cloud storage mounts

### ⚡ Automatic Integration
- New downloads automatically appear in HomeFlix
- No manual file moving required
- Real-time scanning of all paths

### 🔧 Easy Management
- Web-based configuration
- Add/remove paths without restart
- Priority-based scanning control

## Usage Examples

### Example 1: Basic Setup
```
1. Primary Collection: /media/azad/Movies1
2. Torrent Downloads: ~/Downloads/homeflix
```

### Example 2: Multi-Drive Setup
```
1. Primary SSD: /media/azad/Movies1 (priority: 100)
2. Torrent Downloads: ~/Downloads/homeflix (priority: 50)
3. External USB: /mnt/usb/movies (priority: 30)
4. Network NAS: /mnt/nas/media (priority: 20)
```

### Example 3: Organized by Quality
```
1. 4K Movies: /media/4k-movies (priority: 100)
2. HD Movies: /media/hd-movies (priority: 80)
3. Torrent Downloads: ~/Downloads/homeflix (priority: 50)
4. Archive Drive: /mnt/archive (priority: 10)
```

## Migration from Old System

If you're upgrading from the old system:

1. **Existing torrents**: Will continue downloading to configured path
2. **Database migration**: Automatically creates default media paths
3. **No data loss**: All existing media remains accessible
4. **Gradual adoption**: Add new paths as needed

## Troubleshooting

### Path Not Scanning
1. Check if path is marked as **Active**
2. Verify **path exists** and is accessible
3. Check **file permissions**
4. Review **priority settings**

### Torrent Downloads Not Appearing
1. Verify torrent download path is added to media paths
2. Check if torrent path is **Active**
3. Ensure **media scanner** is running
4. Check **file permissions** on download directory

### Performance Issues
1. **Reduce number of active paths** if scanning is slow
2. **Adjust priorities** to scan important paths first
3. **Disable unused paths** temporarily
4. **Check disk I/O** on slower drives

## Future Enhancements

- **Path health monitoring**
- **Automatic path discovery**
- **Smart priority adjustment**
- **Path-specific scanning schedules**
- **Integration with cloud storage**