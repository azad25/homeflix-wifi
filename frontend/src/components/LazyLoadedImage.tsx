import React, { forwardRef, useEffect, useState } from 'react';

interface LazyLoadedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  loading?: 'eager' | 'lazy';
  fallbackSrc?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoad?: () => void;
}

const LazyLoadedImage = forwardRef<HTMLImageElement, LazyLoadedImageProps>(
  ({
    src,
    alt,
    loading = 'lazy',
    fallbackSrc = '/images/placeholder.jpg',
    onError,
    onLoad,
    ...props
  }, ref) => {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      if (!src) return;
      
      const img = new Image();
      img.src = src;
      
      const handleLoad = () => {
        setImageSrc(src);
        onLoad?.();
      };
      
      const handleError = (e: Event) => {
        if (fallbackSrc && !hasError) {
          setImageSrc(fallbackSrc);
          setHasError(true);
        } else {
          onError?.(e as unknown as React.SyntheticEvent<HTMLImageElement, Event>);
        }
      };

      img.addEventListener('load', handleLoad);
      img.addEventListener('error', handleError);

      return () => {
        img.removeEventListener('load', handleLoad);
        img.removeEventListener('error', handleError);
      };
    }, [src, fallbackSrc, onLoad, onError, hasError]);

    return (
      <img
        ref={ref}
        src={imageSrc || fallbackSrc}
        alt={alt}
        loading={loading}
        onError={(e) => {
          if (fallbackSrc && !hasError) {
            setImageSrc(fallbackSrc);
            setHasError(true);
          } else {
            onError?.(e);
          }
        }}
        {...props}
      />
    );
  }
);

LazyLoadedImage.displayName = 'LazyLoadedImage';

export default LazyLoadedImage;
