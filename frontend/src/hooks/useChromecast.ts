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

  const sessionRef = useRef<any>(null);
  const mediaRef = useRef<any>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Google Cast SDK
  useEffect(() => {
    const initializeCast = () => {
      if (!window.chrome?.cast?.isAvailable) {
        console.log('Google Cast SDK not available');
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
        }
      );
    };

    // Load Google Cast SDK if not already loaded
    if (!window.chrome?.cast) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) {
          console.log('Google Cast API loaded');
          initializeCast();
        } else {
          console.log('Google Cast API not available');
        }
      };

      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    } else {
      initializeCast();
    }
  }, []);

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

    setCastState(prev => ({ ...prev, isConnecting: true }));

    window.chrome.cast.requestSession(
      (session: any) => {
        console.log('Cast session requested successfully:', session);
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
        setCastState(prev => ({ ...prev, isConnecting: false }));
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

  // Load media on cast device
  const loadMedia = useCallback((media: CastMedia) => {
    if (!sessionRef.current || !window.chrome?.cast) {
      console.error('No active cast session');
      return;
    }

    const mediaInfo = new window.chrome.cast.media.MediaInfo(
      media.contentId,
      media.contentType
    );

    // Set metadata
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
    request.autoplay = true;

    sessionRef.current.loadMedia(
      request,
      (media: any) => {
        console.log('Media loaded successfully on cast device:', media);
        mediaRef.current = media;
        setupMediaListeners(media);
      },
      (error: any) => {
        console.error('Failed to load media on cast device:', error);
      }
    );
  }, []);

  // Media control functions
  const play = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.play(null, () => {
        console.log('Cast media play success');
      }, (error: any) => {
        console.error('Cast media play failed:', error);
      });
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.pause(null, () => {
        console.log('Cast media pause success');
      }, (error: any) => {
        console.error('Cast media pause failed:', error);
      });
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (mediaRef.current) {
      const seekRequest = new window.chrome.cast.media.SeekRequest();
      seekRequest.currentTime = time;
      
      mediaRef.current.seek(seekRequest, () => {
        console.log('Cast media seek success');
      }, (error: any) => {
        console.error('Cast media seek failed:', error);
      });
    }
  }, []);

  const setVolume = useCallback((level: number) => {
    if (sessionRef.current) {
      const volumeRequest = new window.chrome.cast.Volume(level, false);
      sessionRef.current.setReceiverVolumeLevel(volumeRequest, () => {
        console.log('Cast volume set success');
      }, (error: any) => {
        console.error('Cast volume set failed:', error);
      });
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (sessionRef.current) {
      const volumeRequest = new window.chrome.cast.Volume(null, muted);
      sessionRef.current.setReceiverMuted(volumeRequest, () => {
        console.log('Cast mute set success');
      }, (error: any) => {
        console.error('Cast mute set failed:', error);
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
    loadMedia,
    play,
    pause,
    seek,
    setVolume,
    setMuted,
  };
};
