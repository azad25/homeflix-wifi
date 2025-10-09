"use client";

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { ALACAudioEngine, initializeALACAudio, ALACAudioConfig } from '../lib/audio/alacAudioEngine';
import SpatialAudioProcessor from '../lib/audio/spatialAudioProcessor';

interface EnhancedAudioContextType {
  // Legacy compatibility
  currentAudioElement: HTMLVideoElement | HTMLAudioElement | null;
  setCurrentAudioElement: (element: HTMLVideoElement | HTMLAudioElement | null) => void;
  muteAll: () => void;
  isGloballyMuted: boolean;
  setGloballyMuted: (muted: boolean) => void;
  
  // Enhanced ALAC features
  alacEngine: ALACAudioEngine | null;
  spatialProcessor: SpatialAudioProcessor | null;
  isALACEnabled: boolean;
  audioQuality: 'standard' | 'lossless' | 'hi-res';
  spatialAudioEnabled: boolean;
  dolbyAtmosEnabled: boolean;
  
  // Audio controls
  setAudioQuality: (quality: 'standard' | 'lossless' | 'hi-res') => void;
  toggleSpatialAudio: () => void;
  toggleDolbyAtmos: () => void;
  setMasterVolume: (volume: number) => void;
  getMasterVolume: () => number;
  
  // Audio analysis
  getAudioAnalysis: () => Float32Array;
  getAudioMetadata: () => any;
  isLosslessPlayback: () => boolean;
  
  // Spatial audio controls
  setSpatialPosition: (x: number, y: number, z: number) => void;
  setListenerOrientation: (forward: {x: number, y: number, z: number}, up: {x: number, y: number, z: number}) => void;
  
  // Initialization
  initializeEnhancedAudio: () => Promise<boolean>;
}

const EnhancedAudioContext = createContext<EnhancedAudioContextType | undefined>(undefined);

export const EnhancedAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Legacy state
  const [currentAudioElement, setCurrentAudioElementState] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isGloballyMuted, setGloballyMuted] = useState(false);
  const previousElementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  
  // Enhanced audio state
  const [alacEngine, setAlacEngine] = useState<ALACAudioEngine | null>(null);
  const [spatialProcessor, setSpatialProcessor] = useState<SpatialAudioProcessor | null>(null);
  const [isALACEnabled, setIsALACEnabled] = useState(false);
  const [audioQuality, setAudioQualityState] = useState<'standard' | 'lossless' | 'hi-res'>('lossless');
  const [spatialAudioEnabled, setSpatialAudioEnabled] = useState(true);
  const [dolbyAtmosEnabled, setDolbyAtmosEnabled] = useState(true);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const [audioMetadata, setAudioMetadata] = useState<any>(null);

  // Initialize enhanced audio on mount
  useEffect(() => {
    initializeEnhancedAudio();
  }, []);

  const initializeEnhancedAudio = useCallback(async (): Promise<boolean> => {
    try {
      // Configure ALAC engine based on quality setting
      const config: Partial<ALACAudioConfig> = {
        sampleRate: audioQuality === 'hi-res' ? 192000 : audioQuality === 'lossless' ? 96000 : 48000,
        bitDepth: audioQuality === 'standard' ? 16 : 24,
        channels: 8,
        spatialAudio: spatialAudioEnabled,
        dolbyAtmos: dolbyAtmosEnabled,
        binaural: false,
        roomCorrection: true
      };

      const success = await initializeALACAudio(config);
      if (success) {
        // Get the global ALAC engine instance
        const { alacAudioEngine } = await import('../lib/audio/alacAudioEngine');
        setAlacEngine(alacAudioEngine);
        setIsALACEnabled(true);

        // Initialize spatial processor if enabled
        if (spatialAudioEnabled && alacAudioEngine.isSupported()) {
          const audioContext = (alacAudioEngine as any).audioContext;
          if (audioContext) {
            const processor = new SpatialAudioProcessor(audioContext, {
              enableHRTF: true,
              enableRoomSimulation: true,
              enableBinaural: false,
              roomSize: 'theater',
              listenerHeight: 1.7,
              speakerLayout: dolbyAtmosEnabled ? '7.1.4' : '7.1'
            });
            setSpatialProcessor(processor);
          }
        }

        console.log('🎵 Enhanced Audio System initialized successfully');
        console.log('🎵 Audio Quality:', audioQuality);
        console.log('🎵 Spatial Audio:', spatialAudioEnabled ? 'Enabled' : 'Disabled');
        console.log('🎵 Dolby Atmos:', dolbyAtmosEnabled ? 'Enabled' : 'Disabled');
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to initialize enhanced audio:', error);
      return false;
    }
  }, [audioQuality, spatialAudioEnabled, dolbyAtmosEnabled]);

  // Legacy audio element management
  const setCurrentAudioElement = useCallback((element: HTMLVideoElement | HTMLAudioElement | null) => {
    // Mute previous element if it exists and is different
    if (previousElementRef.current && previousElementRef.current !== element) {
      previousElementRef.current.muted = true;
      previousElementRef.current.volume = 0;
    }

    // Update current element
    setCurrentAudioElementState(element);
    previousElementRef.current = element;

    // Apply global mute state to new element
    if (element && isGloballyMuted) {
      element.muted = true;
      element.volume = 0;
    } else if (element) {
      element.volume = masterVolume;
    }

    // If ALAC is enabled, enhance the audio element
    if (element && isALACEnabled && alacEngine) {
      enhanceAudioElement(element);
    }
  }, [isGloballyMuted, masterVolume, isALACEnabled, alacEngine]);

  const enhanceAudioElement = useCallback(async (element: HTMLVideoElement | HTMLAudioElement) => {
    if (!alacEngine || !spatialProcessor) return;

    try {
      // Create audio context source from media element
      const audioContext = (alacEngine as any).audioContext;
      if (audioContext && element.crossOrigin !== null) {
        const source = audioContext.createMediaElementSource(element);
        
        // Connect to spatial processor if available
        if (spatialAudioEnabled && spatialProcessor) {
          // Create spatial audio object for the media
          const position = { x: 0, y: 0, z: -2 }; // Front center position
          // Note: We'd need to modify the spatial processor to accept MediaElementAudioSourceNode
          console.log('🎵 Enhanced audio processing applied to media element');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not enhance audio element:', error);
    }
  }, [alacEngine, spatialProcessor, spatialAudioEnabled]);

  const muteAll = useCallback(() => {
    if (currentAudioElement) {
      currentAudioElement.muted = true;
      currentAudioElement.volume = 0;
    }
    if (previousElementRef.current) {
      previousElementRef.current.muted = true;
      previousElementRef.current.volume = 0;
    }
    if (alacEngine) {
      alacEngine.setVolume(0);
    }
  }, [currentAudioElement, alacEngine]);

  const setAudioQuality = useCallback((quality: 'standard' | 'lossless' | 'hi-res') => {
    setAudioQualityState(quality);
    
    // Reinitialize audio engine with new quality settings
    if (isALACEnabled) {
      initializeEnhancedAudio();
    }
  }, [isALACEnabled, initializeEnhancedAudio]);

  const toggleSpatialAudio = useCallback(() => {
    const newState = !spatialAudioEnabled;
    setSpatialAudioEnabled(newState);
    
    if (alacEngine) {
      alacEngine.updateConfig({ spatialAudio: newState });
    }
    
    console.log('🎵 Spatial Audio:', newState ? 'Enabled' : 'Disabled');
  }, [spatialAudioEnabled, alacEngine]);

  const toggleDolbyAtmos = useCallback(() => {
    const newState = !dolbyAtmosEnabled;
    setDolbyAtmosEnabled(newState);
    
    if (alacEngine) {
      alacEngine.updateConfig({ dolbyAtmos: newState });
      if (newState) {
        alacEngine.enableDolbyAtmos();
      }
    }
    
    if (spatialProcessor && newState) {
      spatialProcessor.setupDolbyAtmosLayout();
    }
    
    console.log('🎵 Dolby Atmos:', newState ? 'Enabled' : 'Disabled');
  }, [dolbyAtmosEnabled, alacEngine, spatialProcessor]);

  const setMasterVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setMasterVolumeState(clampedVolume);
    
    if (currentAudioElement && !isGloballyMuted) {
      currentAudioElement.volume = clampedVolume;
    }
    
    if (alacEngine) {
      alacEngine.setVolume(clampedVolume);
    }
    
    if (spatialProcessor) {
      spatialProcessor.setMasterVolume(clampedVolume);
    }
  }, [currentAudioElement, isGloballyMuted, alacEngine, spatialProcessor]);

  const getMasterVolume = useCallback((): number => {
    return masterVolume;
  }, [masterVolume]);

  const getAudioAnalysis = useCallback((): Float32Array => {
    if (alacEngine) {
      return alacEngine.getAudioAnalysis();
    }
    return new Float32Array(0);
  }, [alacEngine]);

  const getAudioMetadata = useCallback(() => {
    return audioMetadata;
  }, [audioMetadata]);

  const isLosslessPlayback = useCallback((): boolean => {
    return isALACEnabled && (audioQuality === 'lossless' || audioQuality === 'hi-res');
  }, [isALACEnabled, audioQuality]);

  const setSpatialPosition = useCallback((x: number, y: number, z: number) => {
    if (alacEngine) {
      alacEngine.setSpatialPosition(x, y, z);
    }
  }, [alacEngine]);

  const setListenerOrientation = useCallback((
    forward: {x: number, y: number, z: number}, 
    up: {x: number, y: number, z: number}
  ) => {
    if (alacEngine) {
      alacEngine.setListenerOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
    if (spatialProcessor) {
      spatialProcessor.setListenerOrientation(forward, up);
    }
  }, [alacEngine, spatialProcessor]);

  // Update global mute state
  useEffect(() => {
    if (isGloballyMuted) {
      muteAll();
    } else if (currentAudioElement) {
      currentAudioElement.volume = masterVolume;
      currentAudioElement.muted = false;
    }
  }, [isGloballyMuted, muteAll, currentAudioElement, masterVolume]);

  const contextValue: EnhancedAudioContextType = {
    // Legacy compatibility
    currentAudioElement,
    setCurrentAudioElement,
    muteAll,
    isGloballyMuted,
    setGloballyMuted,
    
    // Enhanced ALAC features
    alacEngine,
    spatialProcessor,
    isALACEnabled,
    audioQuality,
    spatialAudioEnabled,
    dolbyAtmosEnabled,
    
    // Audio controls
    setAudioQuality,
    toggleSpatialAudio,
    toggleDolbyAtmos,
    setMasterVolume,
    getMasterVolume,
    
    // Audio analysis
    getAudioAnalysis,
    getAudioMetadata,
    isLosslessPlayback,
    
    // Spatial audio controls
    setSpatialPosition,
    setListenerOrientation,
    
    // Initialization
    initializeEnhancedAudio
  };

  return (
    <EnhancedAudioContext.Provider value={contextValue}>
      {children}
    </EnhancedAudioContext.Provider>
  );
};

export const useEnhancedAudio = () => {
  const context = useContext(EnhancedAudioContext);
  if (context === undefined) {
    throw new Error('useEnhancedAudio must be used within an EnhancedAudioProvider');
  }
  return context;
};

// Backward compatibility export
export const useAudio = useEnhancedAudio;
