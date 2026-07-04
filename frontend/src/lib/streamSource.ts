import Hls from 'hls.js';
import { getApiUrl } from './api';

export interface StreamInfo {
  strategy: 'direct' | 'hls';
  url: string;
  reason?: string;
  video_codec?: string;
  audio_codec?: string;
  container?: string;
  duration?: number;
}

export interface AttachedStream {
  strategy: 'direct' | 'hls';
  info: StreamInfo | null;
  /** Tear down hls.js internals; call before switching media or unmounting */
  destroy: () => void;
}

/**
 * Ask the backend how this media should be played for a web client.
 * The decision is a DB lookup server-side (no ffprobe), so this is fast.
 */
export async function fetchStreamInfo(mediaId: number): Promise<StreamInfo | null> {
  try {
    const res = await fetch(`${getApiUrl()}/api/stream/${mediaId}/info?profile=web`);
    if (!res.ok) return null;
    return (await res.json()) as StreamInfo;
  } catch {
    return null;
  }
}

/**
 * Attach the right source to a <video> element:
 * - direct-playable files get the plain progressive URL (kernel sendfile,
 *   native byte-range seeking)
 * - everything else gets HLS via hls.js (or Safari's native HLS), which the
 *   server produces with GPU transcoding - seekable on every file
 *
 * Falls back to the legacy direct URL if the info endpoint is unreachable.
 */
export async function attachStreamSource(
  video: HTMLVideoElement,
  mediaId: number,
  fallbackDirectUrl?: string,
): Promise<AttachedStream> {
  const info = await fetchStreamInfo(mediaId);
  const apiUrl = getApiUrl();

  if (!info) {
    video.src = fallbackDirectUrl || `${apiUrl}/api/stream/${mediaId}`;
    video.load();
    return { strategy: 'direct', info: null, destroy: () => {} };
  }

  const absoluteUrl = info.url.startsWith('http') ? info.url : `${apiUrl}${info.url}`;

  if (info.strategy === 'hls') {
    if (Hls.isSupported()) {
      const hls = new Hls({
        // The server encodes ahead of playback; keep client buffering modest
        // so seeks don't queue up huge segment ranges
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Segment production can take a moment after a seek (encoder restart)
        fragLoadingTimeOut: 45000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
      });
      hls.loadSource(absoluteUrl);
      hls.attachMedia(video);
      return { strategy: 'hls', info, destroy: () => hls.destroy() };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari plays HLS natively
      video.src = absoluteUrl;
      video.load();
      return { strategy: 'hls', info, destroy: () => {} };
    }
    // No MSE, no native HLS - last resort: progressive URL
    video.src = `${apiUrl}/api/stream/${mediaId}`;
    video.load();
    return { strategy: 'direct', info, destroy: () => {} };
  }

  video.src = absoluteUrl;
  video.load();
  return { strategy: 'direct', info, destroy: () => {} };
}
