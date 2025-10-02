#!/usr/bin/env python3
"""
Media Assets Cleanup Script
Removes existing thumbnails and preview clips to allow fresh regeneration
"""

import os
import sys
import glob
import shutil
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def cleanup_thumbnails_and_previews():
    """
    Remove all existing thumbnails and preview clips
    """
    # Define directories
    thumbnail_dir = "./backend/thumbnails"
    preview_dir = "./backend/previews"
    
    # Make paths absolute
    base_dir = Path(__file__).parent
    thumbnail_path = base_dir / thumbnail_dir
    preview_path = base_dir / preview_dir
    
    logger.info("🧹 Starting media assets cleanup...")
    
    # Track cleanup statistics
    stats = {
        'thumbnails_removed': 0,
        'previews_removed': 0,
        'total_size_freed': 0
    }
    
    # Clean thumbnails directory
    if thumbnail_path.exists():
        logger.info(f"📁 Cleaning thumbnails directory: {thumbnail_path}")
        
        # Remove thumbnail files (thumb_*.jpg)
        thumb_files = list(thumbnail_path.glob("thumb_*.jpg"))
        for thumb_file in thumb_files:
            try:
                file_size = thumb_file.stat().st_size
                thumb_file.unlink()
                stats['thumbnails_removed'] += 1
                stats['total_size_freed'] += file_size
                logger.debug(f"🗑️  Removed thumbnail: {thumb_file.name}")
            except Exception as e:
                logger.error(f"❌ Failed to remove {thumb_file}: {e}")
        
        # Remove preview files (preview_*.mp4)
        preview_files = list(thumbnail_path.glob("preview_*.mp4"))
        for preview_file in preview_files:
            try:
                file_size = preview_file.stat().st_size
                preview_file.unlink()
                stats['previews_removed'] += 1
                stats['total_size_freed'] += file_size
                logger.debug(f"🗑️  Removed preview: {preview_file.name}")
            except Exception as e:
                logger.error(f"❌ Failed to remove {preview_file}: {e}")
    else:
        logger.warning(f"⚠️  Thumbnails directory not found: {thumbnail_path}")
    
    # Clean previews directory (if separate)
    if preview_path.exists() and preview_path != thumbnail_path:
        logger.info(f"📁 Cleaning previews directory: {preview_path}")
        
        preview_files = list(preview_path.glob("preview_*.mp4"))
        for preview_file in preview_files:
            try:
                file_size = preview_file.stat().st_size
                preview_file.unlink()
                stats['previews_removed'] += 1
                stats['total_size_freed'] += file_size
                logger.debug(f"🗑️  Removed preview: {preview_file.name}")
            except Exception as e:
                logger.error(f"❌ Failed to remove {preview_file}: {e}")
    
    # Format file size
    def format_size(size_bytes):
        if size_bytes == 0:
            return "0 B"
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
        return f"{size_bytes:.1f} {size_names[i]}"
    
    # Print cleanup summary
    logger.info("📊 Cleanup Summary:")
    logger.info(f"   🖼️  Thumbnails removed: {stats['thumbnails_removed']}")
    logger.info(f"   🎬 Preview clips removed: {stats['previews_removed']}")
    logger.info(f"   💾 Total space freed: {format_size(stats['total_size_freed'])}")
    
    return stats

def cleanup_database_flags():
    """
    Reset thumbnail and preview flags in database
    This would typically involve API calls to reset the has_thumbnail and has_preview flags
    """
    logger.info("🗄️  Database cleanup would be handled by separate API calls")
    logger.info("   You may want to run SQL commands to reset thumbnail/preview flags:")
    logger.info("   UPDATE media SET has_thumbnail = false, has_preview = false;")
    logger.info("   UPDATE media SET thumbnail_path = NULL, preview_path = NULL;")

def main():
    """Main cleanup function"""
    try:
        logger.info("🚀 HomeFlix Media Assets Cleanup Tool")
        logger.info("=" * 50)
        
        # Confirm cleanup
        if len(sys.argv) > 1 and sys.argv[1] == "--force":
            proceed = True
        else:
            response = input("⚠️  This will remove ALL existing thumbnails and preview clips. Continue? (y/N): ")
            proceed = response.lower().strip() in ['y', 'yes']
        
        if not proceed:
            logger.info("❌ Cleanup cancelled by user")
            return
        
        # Perform cleanup
        stats = cleanup_thumbnails_and_previews()
        cleanup_database_flags()
        
        logger.info("✅ Media assets cleanup completed successfully!")
        logger.info("🔄 You can now regenerate fresh thumbnails and preview clips")
        
        # Suggest next steps
        logger.info("\n📋 Next Steps:")
        logger.info("1. Start Celery workers: ./start-celery.sh")
        logger.info("2. Trigger thumbnail generation via API or scanning")
        logger.info("3. Monitor progress with Flower dashboard: http://localhost:5555")
        
    except KeyboardInterrupt:
        logger.info("\n❌ Cleanup interrupted by user")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
