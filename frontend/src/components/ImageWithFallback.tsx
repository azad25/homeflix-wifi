"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useImageWithFallback } from '@/lib/imageUtils';

interface ImageWithFallbackProps {
  mediaId: number | string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  priority?: boolean;
  onLoad?: () => void;
  posterUrl?: string | null; // For TMDB or custom poster URLs
  mediaType?: string; // Media type for proper poster endpoint selection
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  mediaId,
  alt,
  fill = false,
  sizes,
  className,
  loading = 'lazy',
  priority = false,
  onLoad,
  posterUrl,
  mediaType
}) => {
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  
  const { primarySrc, fallbackSrc } = useImageWithFallback(mediaId, posterUrl, mediaType);

  // Determine which source to use
  const currentSrc = imageError ? fallbackSrc : primarySrc;

  const handleError = () => {
    if (!imageError) {
      console.log(`🖼️ Poster failed for media ${mediaId}, trying thumbnail fallback`);
      setImageError(true);
    } else {
      console.log(`🖼️ Thumbnail also failed for media ${mediaId}`);
      setFallbackError(true);
    }
  };

  const handleLoad = () => {
    if (onLoad) onLoad();
    if (imageError) {
      console.log(`🖼️ Thumbnail loaded successfully for media ${mediaId}`);
    } else {
      console.log(`🖼️ Poster loaded successfully for media ${mediaId}`);
    }
  };

  if (fallbackError) {
    return (
      <div className={`bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center ${className}`}>
        <div className="text-white text-center p-2">
          <div className="text-2xl mb-2">🎬</div>
          <div className="text-xs font-medium line-clamp-2">{alt}</div>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      loading={priority ? 'eager' : loading}
      priority={priority}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
};

export default ImageWithFallback;