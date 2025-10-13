import React, { useEffect, useState } from 'react';
import { usePreviewStreaming } from '@/hooks/useGRPCStreaming';

interface SmartPreviewPlayerProps {
  mediaUuid: string;
  thumbnailUrl?: string;
  autoPlay?: boolean;
  onPreviewReady?: () => void;
  onGenerationStart?: () => void;
  className?: string;
}

export const SmartPreviewPlayer: React.FC<SmartPreviewPlayerProps> = ({
  mediaUuid,
  thumbnailUrl,
  autoPlay = true,
  onPreviewReady,
  onGenerationStart,
  className = '',
}) => {
  const {
    streamPreview,
    isLoading,
    error,
    previewUrl,
    isGenerating,
    generationProgress,
  } = usePreviewStreaming(mediaUuid);

  const [showGenerationUI, setShowGenerationUI] = useState(false);

  useEffect(() => {
    streamPreview();
  }, [streamPreview]);

  useEffect(() => {
    if (previewUrl && onPreviewReady) {
      onPreviewReady();
    }
  }, [previewUrl, onPreviewReady]);

  useEffect(() => {
    if (isGenerating && onGenerationStart) {
      onGenerationStart();
      setShowGenerationUI(true);
    }
  }, [isGenerating, onGenerationStart]);

  // Show loading state
  if (isLoading && !isGenerating) {
    return (
      <div className={`relative overflow-hidden bg-gray-900 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
        {thumbnailUrl && (
          <img 
            src={thumbnailUrl} 
            alt="Loading preview" 
            className="w-full h-full object-cover opacity-50"
          />
        )}
      </div>
    );
  }

  // Show preview video if available
  if (previewUrl) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <video
          src={previewUrl}
          autoPlay={autoPlay}
          muted
          loop
          className="w-full h-full object-cover"
          onLoadedData={() => console.log('Preview loaded successfully')}
          onError={(e) => console.error('Preview playback error:', e)}
        />
        
        {/* Success indicator */}
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded opacity-75">
          Preview Ready
        </div>
      </div>
    );
  }

  // Show generation progress
  if (isGenerating) {
    return (
      <div className={`relative overflow-hidden bg-gray-900 ${className}`}>
        {/* Fallback thumbnail or original thumbnail */}
        <img 
          src={thumbnailUrl} 
          alt="Generating preview" 
          className="w-full h-full object-cover"
        />
        
        {/* Generation overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center">
          <div className="text-white text-center">
            {/* Generating icon */}
            <div className="mb-3">
              <svg className="animate-spin h-8 w-8 text-white mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            
            {/* Progress text */}
            <div className="text-sm font-medium mb-2">
              Generating Preview...
            </div>
            
            {/* Progress bar */}
            <div className="w-32 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            
            {/* Progress percentage */}
            <div className="text-xs text-gray-300 mt-1">
              {Math.round(generationProgress)}%
            </div>
            
            {/* ETA */}
            <div className="text-xs text-gray-400 mt-1">
              {generationProgress < 50 ? 'ETA: ~2 minutes' : 'Almost ready...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`relative overflow-hidden bg-gray-900 ${className}`}>
        <img 
          src={thumbnailUrl} 
          alt="Preview unavailable" 
          className="w-full h-full object-cover opacity-50"
        />
        
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="mb-2">
              <svg className="h-8 w-8 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-sm">Preview Unavailable</div>
            <button 
              onClick={() => streamPreview()}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to thumbnail
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img 
        src={thumbnailUrl} 
        alt="Media thumbnail" 
        className="w-full h-full object-cover"
      />
    </div>
  );
};

// Usage example component
export const MediaCardWithSmartPreview: React.FC<{
  media: any;
  onHover?: boolean;
}> = ({ media, onHover = false }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  return (
    <div 
      className="relative group cursor-pointer"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => {
        setShowPreview(false);
        setPreviewReady(false);
      }}
    >
      {/* Default thumbnail */}
      <img 
        src={media.thumbnail_path} 
        alt={media.title}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          showPreview && previewReady ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Smart preview overlay */}
      {showPreview && (
        <div className="absolute inset-0">
          <SmartPreviewPlayer
            mediaUuid={media.uuid}
            thumbnailUrl={media.thumbnail_path}
            onPreviewReady={() => setPreviewReady(true)}
            onGenerationStart={() => console.log('Preview generation started for:', media.title)}
            className="w-full h-full"
          />
        </div>
      )}
      
      {/* Media info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
        <h3 className="text-white font-semibold">{media.title}</h3>
        <p className="text-gray-300 text-sm">{media.year} • {media.quality}</p>
      </div>
      
      {/* Generation status indicator */}
      {showPreview && (
        <div className="absolute top-2 left-2">
          <div className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {previewReady ? '🎬 Preview' : '⏳ Loading'}
          </div>
        </div>
      )}
    </div>
  );
};