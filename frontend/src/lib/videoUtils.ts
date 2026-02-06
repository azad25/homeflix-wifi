/**
 * Video utility functions for detecting and handling placeholder videos
 */

/**
 * Detects if a video is a placeholder/fallback video based on its characteristics
 * Placeholder videos are typically:
 * - Very short duration (< 10 seconds)
 * - Low resolution (1920x1080 or less)
 * - Have minimal file size
 * - Often have black screens with text
 */
export const isPlaceholderVideo = (video: HTMLVideoElement): boolean => {
  if (!video) return false;

  // Check if video duration is suspiciously short (placeholder videos are usually 5 seconds)
  if (video.duration > 0 && video.duration <= 10) {
    console.log('🎬 Detected short video duration:', video.duration, 'seconds - likely placeholder');
    return true;
  }

  // Check video dimensions - placeholder videos are typically low resolution
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const totalPixels = video.videoWidth * video.videoHeight;
    // If resolution is very low (less than 480p), likely a placeholder
    if (totalPixels < 640 * 480) {
      console.log('🎬 Detected low resolution:', video.videoWidth, 'x', video.videoHeight, '- likely placeholder');
      return true;
    }
    
    // Also check for common placeholder resolutions
    if ((video.videoWidth === 1920 && video.videoHeight === 1080) && video.duration <= 10) {
      console.log('🎬 Detected 1080p short video - likely placeholder');
      return true;
    }
  }

  // Check if video file size is suspiciously small (if available)
  if (video.buffered && video.buffered.length > 0 && video.duration > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const bufferedRatio = bufferedEnd / video.duration;
    
    // If the entire video is buffered quickly, it might be very small (placeholder)
    if (bufferedRatio > 0.9 && video.duration <= 10) {
      console.log('🎬 Video buffered quickly and short - likely placeholder');
      return true;
    }
  }

  return false;
};

/**
 * Checks if a video element is playing a placeholder video and triggers fallback
 */
export const checkAndHandlePlaceholder = (
  video: HTMLVideoElement,
  onPlaceholderDetected: () => void
): void => {
  if (!video) return;

  // Wait for metadata to be loaded
  const checkPlaceholder = () => {
    if (isPlaceholderVideo(video)) {
      console.log('🎬 Placeholder video detected, triggering fallback');
      onPlaceholderDetected();
    }
  };

  // Check immediately if metadata is already loaded
  if (video.readyState >= 1) {
    checkPlaceholder();
  }

  // Also check when metadata loads
  video.addEventListener('loadedmetadata', checkPlaceholder, { once: true });
};

/**
 * Analyzes video content to detect if it's a black screen with text (placeholder)
 * This is more advanced detection using canvas analysis
 */
export const analyzeVideoContent = async (video: HTMLVideoElement): Promise<boolean> => {
  if (!video || video.readyState < 2) return false;

  try {
    // Create a canvas to analyze video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');

    if (!ctx) return false;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Count black pixels (placeholder videos have mostly black background)
    let blackPixels = 0;
    const totalPixels = canvas.width * canvas.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Consider pixel black if RGB values are all low
      if (r < 30 && g < 30 && b < 30) {
        blackPixels++;
      }
    }

    const blackPercentage = (blackPixels / totalPixels) * 100;

    // If more than 80% of pixels are black, it's likely a placeholder
    if (blackPercentage > 80) {
      console.log('🎬 Video content analysis: ', blackPercentage.toFixed(1), '% black pixels - likely placeholder');
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Error analyzing video content:', error);
    return false;
  }
};

/**
 * Checks if all video sources have failed and triggers fallback
 * Returns true if all sources failed, false otherwise
 */
export const checkAllSourcesFailed = (videoElement: HTMLVideoElement | null): boolean => {
  if (!videoElement) return true;
  
  const sources = Array.from(videoElement.querySelectorAll('source'));
  const activeSources = sources.filter(s => s.style.display !== 'none');
  
  if (activeSources.length === 0) {
    console.log('🎬 All video sources have failed');
    return true;
  }
  
  return false;
};

/**
 * Detects placeholder video on metadata load and triggers callback
 * Uses multiple detection methods for better accuracy
 */
export const detectPlaceholderOnLoad = (
  video: HTMLVideoElement,
  onPlaceholderDetected: () => void
): void => {
  if (!video) return;

  const checkForPlaceholder = () => {
    if (isPlaceholderVideo(video)) {
      console.log('🎬 Placeholder detected on load, triggering fallback');
      onPlaceholderDetected();
      return;
    }
    
    // Additional check: analyze video content if possible
    analyzeVideoContent(video).then((isPlaceholder) => {
      if (isPlaceholder) {
        console.log('🎬 Placeholder detected via content analysis, triggering fallback');
        onPlaceholderDetected();
      }
    }).catch(() => {
      // Content analysis failed, rely on basic detection
    });
  };

  // Check when metadata is loaded
  if (video.readyState >= 1) {
    checkForPlaceholder();
  } else {
    video.addEventListener('loadedmetadata', checkForPlaceholder, { once: true });
  }

  // Also check after video starts playing (some placeholders only show their true nature when playing)
  video.addEventListener('playing', () => {
    setTimeout(checkForPlaceholder, 500);
  }, { once: true });

  // Check after a short delay to catch late detections
  setTimeout(checkForPlaceholder, 1000);
  setTimeout(checkForPlaceholder, 3000); // Additional check after 3 seconds
};
