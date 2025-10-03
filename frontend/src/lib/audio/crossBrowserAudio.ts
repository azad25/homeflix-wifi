/**
 * Cross-browser compatible audio autoplay with ALAC integration
 * Handles Chrome, Chromium, Safari, and other browsers
 */

interface AudioCapabilities {
  canAutoplay: boolean;
  requiresUserInteraction: boolean;
  supportsALAC: boolean;
  supportsSpatialAudio: boolean;
  browserType: 'chrome' | 'safari' | 'firefox' | 'edge' | 'unknown';
}

interface CrossBrowserAudioOptions {
  enableALAC?: boolean;
  fallbackToAAC?: boolean;
  spatialAudio?: boolean;
  quality?: 'standard' | 'lossless' | 'hi-res';
  maxRetries?: number;
  retryDelay?: number;
}

export class CrossBrowserAudioManager {
  private audioCapabilities: AudioCapabilities;
  private userInteracted: boolean = false;
  private audioContext: AudioContext | null = null;
  private alacSupported: boolean = false;
  private pendingElements: Set<HTMLVideoElement | HTMLAudioElement> = new Set();

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.audioCapabilities = this.detectAudioCapabilities();
      this.setupUserInteractionListeners();
      this.testALACSupport();
    } else {
      // Default capabilities for SSR
      this.audioCapabilities = {
        canAutoplay: false,
        requiresUserInteraction: true,
        supportsALAC: false,
        supportsSpatialAudio: false,
        browserType: 'unknown'
      };
    }
  }

  private detectAudioCapabilities(): AudioCapabilities {
    const userAgent = navigator.userAgent.toLowerCase();
    let browserType: AudioCapabilities['browserType'] = 'unknown';
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      browserType = 'chrome';
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      browserType = 'safari';
    } else if (userAgent.includes('firefox')) {
      browserType = 'firefox';
    } else if (userAgent.includes('edg')) {
      browserType = 'edge';
    }

    // Safari requires user interaction for autoplay with audio
    const requiresUserInteraction = browserType === 'safari' || 
      (browserType === 'chrome' && this.isIOSChrome());

    return {
      canAutoplay: !requiresUserInteraction,
      requiresUserInteraction,
      supportsALAC: browserType === 'safari' || this.canPlayALAC(),
      supportsSpatialAudio: this.supportsSpatialAudio(),
      browserType
    };
  }

  private isIOSChrome(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /CriOS/.test(navigator.userAgent);
  }

  private canPlayALAC(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const audio = document.createElement('audio');
      return audio.canPlayType('audio/mp4; codecs="alac"') !== '';
    } catch {
      return false;
    }
  }

  private supportsSpatialAudio(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const panner = audioContext.createPanner();
      return panner.panningModel !== undefined;
    } catch {
      return false;
    }
  }

  private async testALACSupport(): Promise<void> {
    if (typeof fetch === 'undefined') {
      this.alacSupported = false;
      return;
    }
    
    try {
      const response = await fetch('/api/audio/formats');
      const data = await response.json();
      this.alacSupported = data.alac_supported || false;
    } catch (error) {
      console.warn('Could not test ALAC support:', error);
      this.alacSupported = false;
    }
  }

  private setupUserInteractionListeners(): void {
    if (typeof document === 'undefined') return;
    
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    
    const handleInteraction = () => {
      if (!this.userInteracted) {
        this.userInteracted = true;
        console.log('🎵 User interaction detected - enabling audio autoplay');
        
        // Process pending elements
        this.processPendingElements();
        
        // Remove listeners after first interaction
        events.forEach(event => {
          document.removeEventListener(event, handleInteraction);
        });
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true, once: true });
    });
  }

  private async processPendingElements(): Promise<void> {
    for (const element of this.pendingElements) {
      try {
        await this.enableAudioForElement(element);
      } catch (error) {
        console.warn('Failed to enable audio for pending element:', error);
      }
    }
    this.pendingElements.clear();
  }

  public async setupVideoAudio(
    element: HTMLVideoElement | HTMLAudioElement,
    mediaUUID: string,
    options: CrossBrowserAudioOptions = {}
  ): Promise<boolean> {
    const {
      enableALAC = true,
      fallbackToAAC = true,
      spatialAudio = false,
      quality = 'lossless',
      maxRetries = 3,
      retryDelay = 1000
    } = options;

    try {
      // Set cross-browser compatible attributes
      this.setCrossBrowserAttributes(element);

      // Try ALAC audio if supported and enabled
      if (enableALAC && this.alacSupported && this.audioCapabilities.supportsALAC) {
        const alacSuccess = await this.setupALACAudio(element, mediaUUID, quality);
        if (alacSuccess) {
          console.log('🎵 ALAC audio setup successful');
          return await this.attemptAutoplay(element, maxRetries, retryDelay);
        }
      }

      // Fallback to standard audio
      if (fallbackToAAC) {
        console.log('🎵 Falling back to standard audio');
        return await this.attemptAutoplay(element, maxRetries, retryDelay);
      }

      return false;
    } catch (error) {
      console.error('Failed to setup video audio:', error);
      return false;
    }
  }

  private setCrossBrowserAttributes(element: HTMLVideoElement | HTMLAudioElement): void {
    // Set attributes for cross-browser compatibility
    element.setAttribute('playsinline', '');
    element.setAttribute('webkit-playsinline', '');
    element.setAttribute('muted', 'false');
    element.crossOrigin = 'anonymous';
    
    // Safari-specific attributes
    if (this.audioCapabilities.browserType === 'safari') {
      element.setAttribute('disablePictureInPicture', '');
      element.setAttribute('disableRemotePlayback', '');
    }

    // Chrome-specific optimizations
    if (this.audioCapabilities.browserType === 'chrome') {
      element.preload = 'metadata';
    }
  }

  private async setupALACAudio(
    element: HTMLVideoElement | HTMLAudioElement,
    mediaUUID: string,
    quality: string
  ): Promise<boolean> {
    try {
      // Check if ALAC audio exists for this media
      const alacResponse = await fetch(`/api/audio/alac/${mediaUUID}/metadata`);
      if (!alacResponse.ok) {
        // Extract ALAC audio if it doesn't exist
        const extractResponse = await fetch(`/api/audio/alac/${mediaUUID}/extract`, {
          method: 'POST'
        });
        if (!extractResponse.ok) {
          throw new Error('Failed to extract ALAC audio');
        }
      }

      // Create dual audio setup: video + separate ALAC audio
      const alacAudioElement = document.createElement('audio');
      alacAudioElement.src = `/api/audio/alac/${mediaUUID}`;
      alacAudioElement.crossOrigin = 'anonymous';
      alacAudioElement.preload = 'metadata';
      
      // Sync ALAC audio with video
      this.syncAudioWithVideo(element as HTMLVideoElement, alacAudioElement);
      
      return true;
    } catch (error) {
      console.warn('ALAC audio setup failed:', error);
      return false;
    }
  }

  private syncAudioWithVideo(video: HTMLVideoElement, audio: HTMLAudioElement): void {
    // Mute video's original audio track
    video.muted = true;
    
    // Sync playback
    video.addEventListener('play', () => {
      audio.currentTime = video.currentTime;
      audio.play().catch(console.warn);
    });
    
    video.addEventListener('pause', () => {
      audio.pause();
    });
    
    video.addEventListener('seeked', () => {
      audio.currentTime = video.currentTime;
    });
    
    video.addEventListener('volumechange', () => {
      audio.volume = video.volume;
    });

    // Handle video end
    video.addEventListener('ended', () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  private async attemptAutoplay(
    element: HTMLVideoElement | HTMLAudioElement,
    maxRetries: number,
    retryDelay: number
  ): Promise<boolean> {
    // For Safari and browsers requiring user interaction
    if (this.audioCapabilities.requiresUserInteraction && !this.userInteracted) {
      console.log('🎵 Waiting for user interaction before enabling audio');
      this.pendingElements.add(element);
      
      // Start muted autoplay for Safari
      if (this.audioCapabilities.browserType === 'safari') {
        element.muted = true;
        try {
          await element.play();
          console.log('🎵 Safari: Video started muted, waiting for interaction to unmute');
          return true;
        } catch (error) {
          console.warn('Safari muted autoplay failed:', error);
          return false;
        }
      }
      
      return false;
    }

    // Attempt autoplay with audio for other browsers
    return await this.retryAutoplay(element, maxRetries, retryDelay);
  }

  private async retryAutoplay(
    element: HTMLVideoElement | HTMLAudioElement,
    maxRetries: number,
    retryDelay: number
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        element.muted = false;
        element.volume = 1.0;
        
        await element.play();
        console.log(`🎵 Autoplay successful on attempt ${attempt}`);
        return true;
      } catch (error) {
        console.warn(`Autoplay attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Final fallback: muted autoplay
    try {
      element.muted = true;
      await element.play();
      console.log('🎵 Fallback: Started with muted autoplay');
      this.pendingElements.add(element);
      return true;
    } catch (error) {
      console.error('All autoplay attempts failed:', error);
      return false;
    }
  }

  private async enableAudioForElement(element: HTMLVideoElement | HTMLAudioElement): Promise<void> {
    if (element.muted) {
      element.muted = false;
      element.volume = 1.0;
      
      if (element.paused) {
        await element.play();
      }
      
      console.log('🎵 Audio enabled for element after user interaction');
    }
  }

  public async enableAudioOnInteraction(): Promise<void> {
    if (!this.userInteracted) {
      this.userInteracted = true;
      await this.processPendingElements();
    }
  }

  public getCapabilities(): AudioCapabilities {
    return { ...this.audioCapabilities };
  }

  public isUserInteracted(): boolean {
    return this.userInteracted;
  }

  public async createSpatialAudioContext(element: HTMLVideoElement | HTMLAudioElement): Promise<AudioContext | null> {
    if (!this.audioCapabilities.supportsSpatialAudio) {
      return null;
    }

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    } catch (error) {
      console.error('Failed to create spatial audio context:', error);
      return null;
    }
  }
}

// Global instance
export const crossBrowserAudio = new CrossBrowserAudioManager();

// Utility functions
export const setupCrossBrowserVideo = async (
  element: HTMLVideoElement,
  mediaUUID: string,
  options?: CrossBrowserAudioOptions
): Promise<boolean> => {
  return crossBrowserAudio.setupVideoAudio(element, mediaUUID, options);
};

export const enableAudioOnUserInteraction = async (): Promise<void> => {
  return crossBrowserAudio.enableAudioOnInteraction();
};

export const getAudioCapabilities = (): AudioCapabilities => {
  return crossBrowserAudio.getCapabilities();
};
