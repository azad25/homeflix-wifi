"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Play, Plus, Check } from 'lucide-react';
import { Media } from '@/types/media';
import { getApiUrl } from '@/lib/api';
import { useImageWithFallback } from '@/lib/imageUtils';
import { useNearViewport } from '@/hooks/useNearViewport';
import { usePreference } from '@/lib/preferences';

interface NetflixMediaCardProps {
  media: Media;
  onPlay: (media: Media) => void;
  onInfo: (media: Media) => void;
  onAddToList?: (media: Media) => void;
  isInList?: boolean;
  priority?: 'high' | 'normal' | 'low';
  showPreviewOnHover?: boolean;
  disableHover?: boolean;
}

const PREVIEW_DWELL_MS = 650;

// Library items have numeric DB ids; TMDB entries saved to lists use a
// "9"-prefixed id and have no local preview clip.
const hasLocalPreview = (m: Media) =>
  !(m as any).tmdb_id || !String(m.id).startsWith('9') || !!(m as any).file_path;

/**
 * Apple TV style poster card (2:3) used by library grids (Browse, TV
 * Series, My List). The whole card opens details; Play and My List sit on
 * the artwork. Preview clips load only after a hover dwell - the old card
 * HEAD-probed preview URLs for every card on mount (hundreds of requests on
 * large grids).
 */
const NetflixMediaCard: React.FC<NetflixMediaCardProps> = ({
  media,
  onPlay,
  onInfo,
  onAddToList,
  isInList = false,
  priority = 'normal',
  showPreviewOnHover = true,
  disableHover = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { primarySrc, fallbackSrc } = useImageWithFallback(media.id, media.poster_url);
  // Explicit near-viewport loading (native lazy loading sometimes skipped
  // posters until the card was hovered).
  const [cardRef, near] = useNearViewport<HTMLDivElement>(priority === 'high');
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => () => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
  }, []);

  const previewsOn = usePreference('autoplayPreviews');
  const canPreview = previewsOn && showPreviewOnHover && !disableHover && !previewFailed && hasLocalPreview(media);
  const previewUrl = `${getApiUrl()}/api/preview-clips/${media.id}`;

  const startDwell = () => {
    if (!canPreview) return;
    if (dwellRef.current) clearTimeout(dwellRef.current);
    dwellRef.current = setTimeout(() => setPreviewOn(true), PREVIEW_DWELL_MS);
  };
  const stopDwell = () => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
    dwellRef.current = null;
    setPreviewOn(false);
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src === primarySrc && !imageError) setImageError(true);
    else setFallbackError(true);
  };

  const imageSrc = fallbackError ? null : imageError ? fallbackSrc : primarySrc;

  // Images served from cache can finish before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setImgLoaded(true);
  }, [near, imageSrc]);
  const year =
    media.year ||
    (media.release_date ? new Date(media.release_date).getFullYear() : null);
  const typeLabel = media.type === 'episode' || media.type === 'tv' || media.type === 'series' ? 'TV Show' : 'Movie';
  const quality = media.quality
    ? media.quality.includes('2160') || media.quality.toLowerCase().includes('4k')
      ? '4K'
      : 'HD'
    : null;

  return (
    <div
      ref={cardRef}
      className="tv-card-group group/poster relative"
      onMouseEnter={startDwell}
      onMouseLeave={stopDwell}
      onFocus={startDwell}
      onBlur={stopDwell}
    >
      <button
        type="button"
        onClick={() => onInfo(media)}
        aria-label={`${media.title}${year ? `, ${year}` : ''}`}
        className="block w-full text-left outline-none"
      >
        <div className="tv-card aspect-[2/3] w-full">
          {!imgLoaded && imageSrc && <div className="absolute inset-0 animate-pulse bg-white/[0.06]" />}

          {imageSrc ? (
            near && (
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                onLoad={() => setImgLoaded(true)}
                onError={handleImageError}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 text-center">
              <span className="text-2xl">🎬</span>
              <span className="line-clamp-3 text-xs font-semibold text-white/70">{media.title}</span>
            </div>
          )}

          {previewOn && canPreview && (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={previewUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
              onError={() => {
                setPreviewFailed(true);
                setPreviewOn(false);
              }}
            />
          )}

          {quality && (
            <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur-md">
              {quality}
            </span>
          )}
        </div>

        <div className="mt-2.5 min-w-0 px-0.5">
          <p className="truncate text-[14px] font-semibold leading-tight text-[var(--tv-text)]" title={media.title}>
            {media.title}
          </p>
          <p className="tv-caption mt-0.5 truncate">
            {[year, typeLabel, media.rating ? `★ ${Number(media.rating).toFixed(1)}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </button>

      {/* Quick actions over the artwork (siblings of the card button). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[2/3] items-end justify-between p-2.5 opacity-0 transition-opacity duration-200 group-hover/poster:opacity-100 group-focus-within/poster:opacity-100">
        <button
          type="button"
          onClick={() => onPlay(media)}
          aria-label={`Play ${media.title}`}
          className="tv-focus pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-110"
        >
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </button>
        {onAddToList && (
          <button
            type="button"
            onClick={() => onAddToList(media)}
            aria-label={isInList ? `Remove ${media.title} from My List` : `Add ${media.title} to My List`}
            className="tv-glass tv-focus pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          >
            {isInList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export default NetflixMediaCard;
