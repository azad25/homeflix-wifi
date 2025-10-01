/**
 * Safari Video Playback Utilities
 * Handles Safari-specific video playback issues including autoplay restrictions,
 * video stalling, and audio playback problems on Mac Safari browsers.
 */

export interface SafariVideoOptions {
  autoplay?: boolean;
  muted?: boolean;
  volume?: number;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
}

export class SafariVideoManager {
  private video: HTMLVideoElement;
  private options: SafariVideoOptions;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private isInitialized: boolean = false;

  constructor(video: HTMLVideoElement, options: SafariVideoOptions = {}) {
    this.video = video;
    this.options = {
      autoplay: true,
      muted: true,
      volume: 0.8,
      loop: true,
      preload: 'metadata',
      ...options
    };
    this.setupVideo();
  }

  /**
   * Detect if running on Safari or Mac
   */
  static isSafariOrMac(): boolean {
    const ua = navigator.userAgent;
    return /^((?!chrome|android).)*safari/i.test(ua) || 
           /iPhone|iPad|iPod/i.test(ua) || 
           /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua);
  }

  /**
   * Setup video element with Safari-optimized attributes
   */
  private setupVideo(): void {
    // Safari-specific attributes
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('playsinline', 'true');
    this.video.setAttribute('disablePictureInPicture', 'true');
    this.video.setAttribute('disableRemotePlayback', 'true');
    
    // Set initial properties
    this.video.muted = this.options.muted || true;
    this.video.volume = this.options.volume || 0.8;
    this.video.loop = this.options.loop || true;
    this.video.preload = this.options.preload || 'metadata';
    
    // Add event listeners for Safari-specific issues
    this.addEventListeners();
  }

  /**
   * Add event listeners to handle Safari video issues
   */
  private addEventListeners(): void {
    // Handle stalled video
    this.video.addEventListener('stalled', this.handleStalled.bind(this));
    
    // Handle suspended video
    this.video.addEventListener('suspend', this.handleSuspended.bind(this));
    
    // Handle errors with retry logic
    this.video.addEventListener('error', this.handleError.bind(this));
    
    // Handle successful load
    this.video.addEventListener('canplay', this.handleCanPlay.bind(this));
    
    // Handle play interruption
    this.video.addEventListener('pause', this.handleUnexpectedPause.bind(this));
  }

  /**
   * Handle video stalling
   */
  private handleStalled(): void {
    console.log('Safari: Video stalled, attempting recovery');
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        this.video.load();
      }, 500 * this.retryCount);
    }
  }

  /**
   * Handle video suspension
   */
  private handleSuspended(): void {
    console.log('Safari: Video suspended, attempting recovery');
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        this.video.load();
      }, 1000 * this.retryCount);
    }
  }

  /**
   * Handle video errors with retry logic
   */
  private handleError(event: Event): void {
    console.error('Safari: Video error occurred', event);
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        console.log(`Safari: Retrying video load (attempt ${this.retryCount})`);
        this.video.load();
      }, 2000 * this.retryCount);
    }
  }

  /**
   * Handle successful video load and play
   */
  private async handleCanPlay(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Safari: Video can play');
    this.isInitialized = true;
    this.retryCount = 0; // Reset retry count on successful load

    if (this.options.autoplay) {
      await this.attemptAutoplay();
    }
  }

  /**
   * Handle unexpected pause (Safari sometimes pauses videos)
   */
  private handleUnexpectedPause(): void {
    // Only resume if it was supposed to be playing
    if (this.options.autoplay && !this.video.ended) {
      setTimeout(() => {
        if (this.video.paused && !this.video.ended) {
          console.log('Safari: Resuming unexpectedly paused video');
          this.video.play().catch(console.error);
        }
      }, 1000);
    }
  }

  /**
   * Attempt autoplay with Safari-specific strategies
   */
  private async attemptAutoplay(): Promise<boolean> {
    try {
      // Strategy 1: Try direct play (works in some Safari contexts)
      this.video.currentTime = 0;
      await this.video.play();
      console.log('Safari: Direct autoplay successful');
      return true;
    } catch (error) {
      console.log('Safari: Direct autoplay failed, trying muted play');
      
      try {
        // Strategy 2: Muted autoplay (more likely to work)
        this.video.muted = true;
        this.video.currentTime = 0;
        await this.video.play();
        console.log('Safari: Muted autoplay successful');
        
        // Setup user interaction to unmute
        this.setupUserInteractionUnmute();
        return true;
      } catch (mutedError) {
        console.error('Safari: Even muted autoplay failed', mutedError);
        return false;
      }
    }
  }

  /**
   * Setup user interaction listeners to unmute video
   */
  private setupUserInteractionUnmute(): void {
    const enableAudio = () => {
      if (this.video && !this.video.paused) {
        this.video.muted = false;
        this.video.volume = this.options.volume || 0.8;
        console.log('Safari: Audio enabled via user interaction');
      }
    };

    // Multiple interaction types for better coverage
    const events = ['click', 'touchstart', 'touchend', 'mousedown', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true, passive: true });
    });

    // Also try to enable audio after a delay
    setTimeout(() => {
      if (this.video && !this.video.paused && this.video.muted) {
        enableAudio();
      }
    }, 3000);
  }

  /**
   * Force reload and restart video (useful for stuck videos)
   */
  public forceRestart(): Promise<boolean> {
    console.log('Safari: Force restarting video');
    this.isInitialized = false;
    this.retryCount = 0;
    
    return new Promise((resolve) => {
      const handleRestart = () => {
        this.video.removeEventListener('canplay', handleRestart);
        this.attemptAutoplay().then(resolve);
      };
      
      this.video.addEventListener('canplay', handleRestart, { once: true });
      this.video.load();
    });
  }

  /**
   * Manually play video (for user-initiated playback)
   */
  public async play(): Promise<boolean> {
    try {
      // For user-initiated play, we can try unmuted first
      if (SafariVideoManager.isSafariOrMac()) {
        this.video.load(); // Force reload for Safari
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.video.muted = false;
      this.video.volume = this.options.volume || 0.8;
      await this.video.play();
      console.log('Safari: Manual play successful');
      return true;
    } catch (error) {
      console.log('Safari: Manual unmuted play failed, trying muted');
      try {
        this.video.muted = true;
        await this.video.play();
        console.log('Safari: Manual muted play successful');
        return true;
      } catch (mutedError) {
        console.error('Safari: Manual play completely failed', mutedError);
        return false;
      }
    }
  }

  /**
   * Pause video
   */
  public pause(): void {
    this.video.pause();
  }

  /**
   * Toggle mute state
   */
  public toggleMute(): boolean {
    this.video.muted = !this.video.muted;
    if (!this.video.muted) {
      this.video.volume = this.options.volume || 0.8;
    }
    return this.video.muted;
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    this.video.removeEventListener('stalled', this.handleStalled);
    this.video.removeEventListener('suspend', this.handleSuspended);
    this.video.removeEventListener('error', this.handleError);
    this.video.removeEventListener('canplay', this.handleCanPlay);
    this.video.removeEventListener('pause', this.handleUnexpectedPause);
  }
}

/**
 * Quick utility function to setup Safari video optimization
 */
export function optimizeVideoForSafari(
  video: HTMLVideoElement, 
  options?: SafariVideoOptions
): SafariVideoManager {
  return new SafariVideoManager(video, options);
}

/**
 * Check if current browser needs Safari video optimizations
 */
export function needsSafariOptimization(): boolean {
  return SafariVideoManager.isSafariOrMac();
}
