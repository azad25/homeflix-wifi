/**
 * Spatial Audio Processor for Dolby Atmos-like 3D Audio Experience
 * Provides immersive spatial audio processing with HRTF and room simulation
 */

export interface SpatialAudioConfig {
  enableHRTF: boolean;
  enableRoomSimulation: boolean;
  enableBinaural: boolean;
  roomSize: 'small' | 'medium' | 'large' | 'theater';
  listenerHeight: number;
  speakerLayout: '2.0' | '5.1' | '7.1' | '7.1.4' | 'atmos';
}

export interface AudioObject {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  gain: number;
  source: AudioBufferSourceNode;
  panner: PannerNode;
}

export class SpatialAudioProcessor {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private roomSimulator: ConvolverNode | null = null;
  private binauralProcessor: ConvolverNode | null = null;
  private audioObjects: Map<string, AudioObject> = new Map();
  private config: SpatialAudioConfig;
  private impulseResponses: Map<string, AudioBuffer> = new Map();

  constructor(audioContext: AudioContext, config: Partial<SpatialAudioConfig> = {}) {
    this.audioContext = audioContext;
    this.config = {
      enableHRTF: true,
      enableRoomSimulation: true,
      enableBinaural: false,
      roomSize: 'medium',
      listenerHeight: 1.7, // Average human height in meters
      speakerLayout: '7.1.4',
      ...config
    };

    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupRoomSimulation();
    await this.setupBinauralProcessing();
    this.setupListenerPosition();
    
    console.log('🎵 Spatial Audio Processor initialized with layout:', this.config.speakerLayout);
  }

  private async setupRoomSimulation(): Promise<void> {
    if (!this.config.enableRoomSimulation) return;

    this.roomSimulator = this.audioContext.createConvolver();
    
    // Generate room impulse response based on room size
    const impulseBuffer = await this.generateRoomImpulse(this.config.roomSize);
    this.roomSimulator.buffer = impulseBuffer;
    
    this.roomSimulator.connect(this.masterGain);
  }

  private async generateRoomImpulse(roomSize: string): Promise<AudioBuffer> {
    const sampleRate = this.audioContext.sampleRate;
    let duration: number;
    let reverbTime: number;
    
    switch (roomSize) {
      case 'small':
        duration = 1.0;
        reverbTime = 0.3;
        break;
      case 'medium':
        duration = 2.0;
        reverbTime = 0.8;
        break;
      case 'large':
        duration = 3.5;
        reverbTime = 1.5;
        break;
      case 'theater':
        duration = 4.0;
        reverbTime = 2.2;
        break;
      default:
        duration = 2.0;
        reverbTime = 0.8;
    }

    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        const decay = Math.exp(-time / reverbTime);
        
        // Add early reflections
        let sample = 0;
        if (i < sampleRate * 0.05) { // First 50ms - early reflections
          sample = (Math.random() * 2 - 1) * decay * 0.3;
        } else { // Late reverberation
          sample = (Math.random() * 2 - 1) * decay * 0.1;
        }
        
        channelData[i] = sample;
      }
    }

    return impulse;
  }

  private async setupBinauralProcessing(): Promise<void> {
    if (!this.config.enableBinaural) return;

    this.binauralProcessor = this.audioContext.createConvolver();
    
    // Generate HRTF-based binaural impulse response
    const binauralImpulse = await this.generateBinauralImpulse();
    this.binauralProcessor.buffer = binauralImpulse;
    
    this.binauralProcessor.connect(this.masterGain);
  }

  private async generateBinauralImpulse(): Promise<AudioBuffer> {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * 0.01); // 10ms HRTF
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    // Simplified HRTF simulation
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      const delay = channel === 0 ? 0 : Math.floor(length * 0.1); // ITD simulation
      
      for (let i = 0; i < length; i++) {
        if (i >= delay && i < delay + 10) {
          channelData[i] = Math.sin((i - delay) * Math.PI / 10) * 0.5;
        }
      }
    }

    return impulse;
  }

  private setupListenerPosition(): void {
    if (this.audioContext.listener.positionX) {
      // Modern Web Audio API
      this.audioContext.listener.positionX.value = 0;
      this.audioContext.listener.positionY.value = this.config.listenerHeight;
      this.audioContext.listener.positionZ.value = 0;
      
      // Forward vector (looking towards negative Z)
      this.audioContext.listener.forwardX.value = 0;
      this.audioContext.listener.forwardY.value = 0;
      this.audioContext.listener.forwardZ.value = -1;
      
      // Up vector
      this.audioContext.listener.upX.value = 0;
      this.audioContext.listener.upY.value = 1;
      this.audioContext.listener.upZ.value = 0;
    } else {
      // Legacy Web Audio API
      (this.audioContext.listener as any).setPosition(0, this.config.listenerHeight, 0);
      (this.audioContext.listener as any).setOrientation(0, 0, -1, 0, 1, 0);
    }
  }

  createAudioObject(id: string, audioBuffer: AudioBuffer, position: { x: number; y: number; z: number }): AudioObject {
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    const panner = this.audioContext.createPanner();
    this.configurePanner(panner, position);
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;
    
    // Connect audio graph
    source.connect(panner);
    panner.connect(gainNode);
    
    if (this.config.enableRoomSimulation && this.roomSimulator) {
      gainNode.connect(this.roomSimulator);
    } else {
      gainNode.connect(this.masterGain);
    }

    const audioObject: AudioObject = {
      id,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      gain: 1.0,
      source,
      panner
    };

    this.audioObjects.set(id, audioObject);
    return audioObject;
  }

  private configurePanner(panner: PannerNode, position: { x: number; y: number; z: number }): void {
    // Configure panner for optimal spatial audio
    panner.panningModel = this.config.enableHRTF ? 'HRTF' : 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;

    // Set position
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      (panner as any).setPosition(position.x, position.y, position.z);
    }
  }

  updateAudioObjectPosition(id: string, position: { x: number; y: number; z: number }, velocity?: { x: number; y: number; z: number }): void {
    const audioObject = this.audioObjects.get(id);
    if (!audioObject) return;

    audioObject.position = position;
    if (velocity) {
      audioObject.velocity = velocity;
    }

    const panner = audioObject.panner;
    
    // Update position
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      (panner as any).setPosition(position.x, position.y, position.z);
    }

    // Update velocity for Doppler effect (legacy Web Audio API)
    if (velocity && (panner as any).setVelocity) {
      (panner as any).setVelocity(velocity.x, velocity.y, velocity.z);
    }
  }

  setupDolbyAtmosLayout(): { [key: string]: { x: number; y: number; z: number } } {
    // Configure speaker positions for Dolby Atmos 7.1.4 layout
    const speakerPositions = {
      // Bed layer (7.1)
      'front-left': { x: -1, y: 0, z: -1 },
      'front-right': { x: 1, y: 0, z: -1 },
      'center': { x: 0, y: 0, z: -1 },
      'lfe': { x: 0, y: -0.5, z: -1 },
      'surround-left': { x: -1, y: 0, z: 1 },
      'surround-right': { x: 1, y: 0, z: 1 },
      'back-left': { x: -0.5, y: 0, z: 1.5 },
      'back-right': { x: 0.5, y: 0, z: 1.5 },
      
      // Height layer (4 ceiling speakers)
      'top-front-left': { x: -1, y: 2, z: -1 },
      'top-front-right': { x: 1, y: 2, z: -1 },
      'top-back-left': { x: -1, y: 2, z: 1 },
      'top-back-right': { x: 1, y: 2, z: 1 }
    };

    console.log('🎵 Dolby Atmos 7.1.4 speaker layout configured');
    return speakerPositions;
  }

  processAtmosMetadata(metadata: any): void {
    // Process Dolby Atmos object metadata
    if (metadata.objects) {
      metadata.objects.forEach((obj: any) => {
        this.updateAudioObjectPosition(obj.id, obj.position, obj.velocity);
      });
    }
  }

  setListenerOrientation(forward: { x: number; y: number; z: number }, up: { x: number; y: number; z: number }): void {
    if (this.audioContext.listener.forwardX) {
      this.audioContext.listener.forwardX.value = forward.x;
      this.audioContext.listener.forwardY.value = forward.y;
      this.audioContext.listener.forwardZ.value = forward.z;
      this.audioContext.listener.upX.value = up.x;
      this.audioContext.listener.upY.value = up.y;
      this.audioContext.listener.upZ.value = up.z;
    } else {
      (this.audioContext.listener as any).setOrientation(
        forward.x, forward.y, forward.z,
        up.x, up.y, up.z
      );
    }
  }

  setMasterVolume(volume: number): void {
    const currentTime = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(currentTime);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currentTime);
    this.masterGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), currentTime + 0.1);
  }

  enableHeadTracking(callback: (orientation: { yaw: number; pitch: number; roll: number }) => void): void {
    // Enable device orientation for head tracking
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', (event) => {
        const orientation = {
          yaw: event.alpha || 0,
          pitch: event.beta || 0,
          roll: event.gamma || 0
        };
        
        callback(orientation);
        
        // Update listener orientation based on head movement
        const radYaw = (orientation.yaw * Math.PI) / 180;
        const radPitch = (orientation.pitch * Math.PI) / 180;
        
        const forward = {
          x: Math.sin(radYaw) * Math.cos(radPitch),
          y: -Math.sin(radPitch),
          z: -Math.cos(radYaw) * Math.cos(radPitch)
        };
        
        const up = { x: 0, y: 1, z: 0 };
        this.setListenerOrientation(forward, up);
      });
    }
  }

  analyzeAudioQuality(audioBuffer: AudioBuffer): {
    dynamicRange: number;
    peakLevel: number;
    rmsLevel: number;
    isLossless: boolean;
    spatialComplexity: number;
  } {
    const channelData = audioBuffer.getChannelData(0);
    let peak = 0;
    let rms = 0;
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      peak = Math.max(peak, sample);
      rms += sample * sample;
    }
    
    rms = Math.sqrt(rms / channelData.length);
    const dynamicRange = 20 * Math.log10(peak / (rms + 1e-10));
    
    return {
      dynamicRange,
      peakLevel: 20 * Math.log10(peak + 1e-10),
      rmsLevel: 20 * Math.log10(rms + 1e-10),
      isLossless: audioBuffer.sampleRate >= 44100 && dynamicRange > 60,
      spatialComplexity: audioBuffer.numberOfChannels > 2 ? audioBuffer.numberOfChannels / 8 : 0
    };
  }

  destroy(): void {
    // Clean up all audio objects
    this.audioObjects.forEach(obj => {
      obj.source.stop();
      obj.source.disconnect();
      obj.panner.disconnect();
    });
    
    this.audioObjects.clear();
    
    if (this.roomSimulator) {
      this.roomSimulator.disconnect();
    }
    
    if (this.binauralProcessor) {
      this.binauralProcessor.disconnect();
    }
    
    this.masterGain.disconnect();
  }
}

export default SpatialAudioProcessor;
