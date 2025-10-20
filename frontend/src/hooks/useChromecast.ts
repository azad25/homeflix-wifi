import { useState, useEffect, useCallback, useRef } from 'react';

// Google Cast SDK types
declare global {
  interface Window {
    chrome: {
      cast: {
        isAvailable: boolean;
        initialize: (apiConfig: any, onInitSuccess: () => void, onInitError: (error: any) => void) => void;
        requestSession: (onSuccess: (session: any) => void, onError: (error: any) => void) => void;
        Session: any;
        SessionRequest: any;
        ApiConfig: any;
        Receiver: any;
        ReceiverAvailability: {
          AVAILABLE: string;
          UNAVAILABLE: string;
        };
        media: {
          MediaInfo: any;
          LoadRequest: any;
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          GenericMediaMetadata: any;
          SeekRequest: any;
        };
        Volume: any;
      };
    };
    __onGCastApiAvailable: (isAvailable: boolean) => void;
  }
}

export interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  currentTime: number;
  duration: number;
  playerState: string | null;
  volumeLevel: number;
  isMuted: boolean;
}

export interface CastMedia {
  contentId: string;
  contentType: string;
  title: string;
  subtitle?: string;
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
  metadata?: {
    title: string;
    subtitle?: string;
    images?: Array<{
      url: string;
    }>;
  };
}

export const useChromecast = () => {
  const [castState, setCastState] = useState<CastState>({
    isAvailable: false,
    isConnected: false,
    isConnecting: false,
    deviceName: null,
    currentTime: 0,
    duration: 0,
    playerState: null,
    volumeLevel: 1,
    isMuted: false,
  });

  // Chrome detection
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isChromium = /Chromium/.test(navigator.userAgent);

  const sessionRef = useRef<any>(null);
  const mediaRef = useRef<any>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Google Cast SDK
  useEffect(() => {
    console.log('Initializing Cast SDK...', {
      isChrome,
      isChromium,
      protocol: window.location.protocol,
      isSecureContext: window.isSecureContext,
      userAgent: navigator.userAgent
    });

    const initializeCast = () => {
      if (!window.chrome?.cast?.isAvailable) {
        console.log('Google Cast SDK not available');
        console.log('Current protocol:', window.location.protocol);
        console.log('User agent:', navigator.userAgent);
        console.log('Is Chrome:', isChrome);
        console.log('Is Chromium:', isChromium);
        console.log('Is secure context:', window.isSecureContext);
        return;
      }

      const sessionRequest = new window.chrome.cast.SessionRequest(
        window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
      );

      const apiConfig = new window.chrome.cast.ApiConfig(
        sessionRequest,
        (session: any) => {
          console.log('Cast session established:', session);
          sessionRef.current = session;
          setCastState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            deviceName: session.receiver?.friendlyName || 'Chromecast',
          }));
          setupSessionListeners(session);
        },
        (availability: string) => {
          const isAvailable = availability === window.chrome.cast.ReceiverAvailability.AVAILABLE;
          console.log('Cast receiver availability:', availability, isAvailable);
          setCastState(prev => ({
            ...prev,
            isAvailable,
          }));
        }
      );

      window.chrome.cast.initialize(
        apiConfig,
        () => {
          console.log('Google Cast SDK initialized successfully');
          setCastState(prev => ({ ...prev, isAvailable: true }));
        },
        (error: any) => {
          console.error('Google Cast SDK initialization failed:', error);
          console.error('Error details:', {
            code: error.code,
            description: error.description,
            details: error.details
          });

          // Set availability to false on initialization failure
          setCastState(prev => ({ ...prev, isAvailable: false }));

          // Chrome-specific error handling
          if (error.code === 'cancel') {
            console.log('Cast initialization cancelled - this is normal in Chrome without cast devices');
          } else if (error.code === 'timeout') {
            console.log('Cast initialization timeout - retrying in 2 seconds...');
            setTimeout(() => {
              if (window.chrome?.cast?.isAvailable) {
                initializeCast();
              }
            }, 2000);
          }
        }
      );
    };

    // Load Google Cast SDK if not already loaded
    if (!window.chrome?.cast) {
      // Check if we're in a secure context (required for Chrome)
      if (!window.isSecureContext && window.location.protocol !== 'https:') {
        console.warn('Cast API requires HTTPS in Chrome. Current protocol:', window.location.protocol);
        // Still try to load for development
      }

      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.defer = true;

      // Add error handling for script loading
      script.onerror = () => {
        console.error('Failed to load Google Cast SDK');
      };

      script.onload = () => {
        console.log('Google Cast SDK script loaded');
      };

      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        console.log('Cast API availability callback:', isAvailable);
        if (isAvailable) {
          console.log('Google Cast API loaded and available');
          // Add a small delay to ensure Chrome is ready
          setTimeout(() => {
            initializeCast();
          }, 100);
        } else {
          console.log('Google Cast API not available');
          // Force set availability to false
          setCastState(prev => ({ ...prev, isAvailable: false }));
        }
      };

      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    } else {
      // Cast API already loaded
      console.log('Cast API already present, initializing...');
      initializeCast();
    }
  }, [isChrome, isChromium]);

  // Development mode: Force show cast button for testing
  useEffect(() => {
    // Check if we're in development mode and want to force cast availability
    const isDevelopment = process.env.NODE_ENV === 'development';
    const forceShowCast = localStorage.getItem('force-cast-button') === 'true';

    if (isDevelopment && forceShowCast && !castState.isAvailable) {
      console.log('🔧 Development mode: Forcing cast button visibility');
      setCastState(prev => ({ ...prev, isAvailable: true }));
    }
  }, [castState.isAvailable]);

  // Setup session event listeners
  const setupSessionListeners = (session: any) => {
    session.addUpdateListener((isAlive: boolean) => {
      if (!isAlive) {
        console.log('Cast session ended');
        sessionRef.current = null;
        mediaRef.current = null;
        setCastState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          deviceName: null,
          currentTime: 0,
          duration: 0,
          playerState: null,
        }));

        if (statusUpdateIntervalRef.current) {
          clearInterval(statusUpdateIntervalRef.current);
          statusUpdateIntervalRef.current = null;
        }
      }
    });

    session.addMediaListener((media: any) => {
      console.log('Media loaded on cast device:', media);
      mediaRef.current = media;
      setupMediaListeners(media);
    });
  };

  // Setup media event listeners
  const setupMediaListeners = (media: any) => {
    media.addUpdateListener((isAlive: boolean) => {
      if (isAlive && media.playerState) {
        setCastState(prev => ({
          ...prev,
          currentTime: media.currentTime || 0,
          duration: media.media?.duration || 0,
          playerState: media.playerState,
          volumeLevel: media.volume?.level || 1,
          isMuted: media.volume?.muted || false,
        }));
      }
    });

    // Start periodic status updates
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
    }

    statusUpdateIntervalRef.current = setInterval(() => {
      if (media && media.playerState) {
        setCastState(prev => ({
          ...prev,
          currentTime: media.currentTime || 0,
          duration: media.media?.duration || 0,
          playerState: media.playerState,
          volumeLevel: media.volume?.level || 1,
          isMuted: media.volume?.muted || false,
        }));
      }
    }, 1000);
  };

  // Connect to cast device
  const connect = useCallback(() => {
    if (!window.chrome?.cast?.isAvailable) {
      console.error('Google Cast SDK not available');
      return;
    }

    console.log('Attempting to connect to cast device...');
    setCastState(prev => ({ ...prev, isConnecting: true }));

    window.chrome.cast.requestSession(
      (session: any) => {
        console.log('Cast session established successfully:', session.receiver?.friendlyName);
        sessionRef.current = session;
        setCastState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          deviceName: session.receiver?.friendlyName || 'Chromecast',
        }));
        setupSessionListeners(session);
      },
      (error: any) => {
        console.error('Cast session request failed:', error);
        setCastState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: false
        }));
      }
    );
  }, []);

  // Disconnect from cast device
  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop(
        () => {
          console.log('Cast session stopped successfully');
        },
        (error: any) => {
          console.error('Failed to stop cast session:', error);
        }
      );
    }
  }, []);

  // Load media on cast device with YouTube-like instant loading
  const loadMedia = useCallback((media: CastMedia, startTime?: number) => {
    if (!sessionRef.current || !window.chrome?.cast) {
      console.error('No active cast session');
      return;
    }

    console.log('🎬 Loading media on cast device:', media.contentId);
    console.log('🎬 Start time:', startTime || 0);

    const mediaInfo = new window.chrome.cast.media.MediaInfo(
      media.contentId,
      media.contentType
    );

    // Set metadata for better cast experience
    if (media.metadata) {
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = media.metadata.title;
      if (media.metadata.subtitle) {
        mediaInfo.metadata.subtitle = media.metadata.subtitle;
      }
      if (media.metadata.images) {
        mediaInfo.metadata.images = media.metadata.images.map((img: any) => ({
          url: img.url,
        }));
      }
    }

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = false; // Don't autoplay, we'll control it manually for better compatibility
    request.currentTime = 0; // Always start from beginning for better compatibility

    sessionRef.current.loadMedia(
      request,
      (loadedMedia: any) => {
        console.log('✅ Media loaded successfully on cast device:', loadedMedia);
        mediaRef.current = loadedMedia;
        setupMediaListeners(loadedMedia);

        // Update state immediately
        setCastState(prev => ({
          ...prev,
          playerState: loadedMedia.playerState || 'IDLE',
          currentTime: loadedMedia.currentTime || 0,
          duration: loadedMedia.media?.duration || 0
        }));

        console.log('✅ Media loaded, ready for playback commands');
      },
      (error: any) => {
        console.error('❌ Failed to load media on cast device:', error);
        // Don't reset connection state immediately, just log the error
        console.log('🎬 Cast media load failed, but keeping connection active');
      }
    );
  }, []);

  // Media control functions optimized for BRAVIA TV
  const play = useCallback(() => {
    if (mediaRef.current) {
      console.log('🎬 Playing cast media... Current state:', mediaRef.current.playerState);

      // BRAVIA TV specific: Always try to play regardless of state
      mediaRef.current.play(null, () => {
        console.log('✅ Cast media play success');
        setCastState(prev => ({ ...prev, playerState: 'PLAYING' }));
      }, (error: any) => {
        console.log('⚠️ Cast media play failed:', error?.message || 'Unknown error');

        // BRAVIA TV fallback: Try to reload the media if play fails
        if (mediaRef.current && sessionRef.current) {
          console.log('🎬 Trying to reload media for BRAVIA TV...');

          // Get the current media info
          const currentMedia = mediaRef.current.media;
          if (currentMedia) {
            // Create a new load request
            const reloadRequest = new window.chrome.cast.media.LoadRequest(currentMedia);
            reloadRequest.autoplay = true;
            reloadRequest.currentTime = 0;

            sessionRef.current.loadMedia(reloadRequest, (reloadedMedia: any) => {
              console.log('✅ Media reloaded successfully');
              mediaRef.current = reloadedMedia;
              setupMediaListeners(reloadedMedia);

              // Try to play the reloaded media
              setTimeout(() => {
                if (reloadedMedia) {
                  reloadedMedia.play(null,
                    () => {
                      console.log('✅ Cast media play success after reload');
                      setCastState(prev => ({ ...prev, playerState: 'PLAYING' }));
                    },
                    (reloadError: any) => {
                      console.log('⚠️ Cast media play failed even after reload');
                      // Update UI state anyway for consistency
                      setCastState(prev => ({ ...prev, playerState: 'PLAYING' }));
                    }
                  );
                }
              }, 1000);
            }, (reloadError: any) => {
              console.log('⚠️ Failed to reload media');
            });
          }
        }
      });
    } else {
      console.warn('⚠️ No media loaded on cast device for play');
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRef.current) {
      console.log('🎬 Pausing cast media...');
      mediaRef.current.pause(null, () => {
        console.log('✅ Cast media pause success');
        setCastState(prev => ({ ...prev, playerState: 'PAUSED' }));
      }, (error: any) => {
        console.log('⚠️ Cast media pause failed, but continuing...', error?.message || 'Unknown error');
        // Don't retry aggressively, just update state
        setCastState(prev => ({ ...prev, playerState: 'PAUSED' }));
      });
    } else {
      console.warn('⚠️ No media loaded on cast device for pause');
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (mediaRef.current && mediaRef.current.playerState) {
      // Only seek if media is in a seekable state
      if (mediaRef.current.playerState === 'PLAYING' ||
        mediaRef.current.playerState === 'PAUSED' ||
        mediaRef.current.playerState === 'BUFFERING') {

        console.log('🎬 Seeking cast media to:', time);
        const seekRequest = new window.chrome.cast.media.SeekRequest();
        seekRequest.currentTime = time;

        mediaRef.current.seek(seekRequest, () => {
          console.log('✅ Cast media seek success');
          setCastState(prev => ({ ...prev, currentTime: time }));
        }, (error: any) => {
          console.log('⚠️ Cast media seek failed, but continuing...', error?.message || 'Unknown error');
          // Update state anyway for UI consistency
          setCastState(prev => ({ ...prev, currentTime: time }));
        });
      } else {
        console.log('⚠️ Cannot seek, media state:', mediaRef.current.playerState);
        // Just update the UI state for consistency
        setCastState(prev => ({ ...prev, currentTime: time }));
      }
    } else {
      console.warn('⚠️ No media loaded on cast device for seek');
    }
  }, []);

  const setVolume = useCallback((level: number) => {
    if (sessionRef.current) {
      const volumeRequest = new window.chrome.cast.Volume(level, false);
      sessionRef.current.setReceiverVolumeLevel(volumeRequest, () => {
        console.log('✅ Cast volume set success');
        setCastState(prev => ({ ...prev, volumeLevel: level }));
      }, (error: any) => {
        console.log('⚠️ Cast volume set failed, but continuing...', error?.message || 'Unknown error');
        // Update state anyway for UI consistency
        setCastState(prev => ({ ...prev, volumeLevel: level }));
      });
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (sessionRef.current) {
      const volumeRequest = new window.chrome.cast.Volume(null, muted);
      sessionRef.current.setReceiverMuted(volumeRequest, () => {
        console.log('✅ Cast mute set success');
        setCastState(prev => ({ ...prev, isMuted: muted }));
      }, (error: any) => {
        console.log('⚠️ Cast mute set failed, but continuing...', error?.message || 'Unknown error');
        // Update state anyway for UI consistency
        setCastState(prev => ({ ...prev, isMuted: muted }));
      });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
    };
  }, []);

  return {
    castState,
    connect,
    disconnect,
    loadMedia: (media: CastMedia, startTime?: number) => loadMedia(media, startTime),
    play,
    pause,
    seek,
    setVolume,
    setMuted,
  };
};
