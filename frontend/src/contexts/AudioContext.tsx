"use client";

import React, { createContext, useContext, useRef, useState } from 'react';

interface AudioContextType {
  currentAudioElement: HTMLVideoElement | HTMLAudioElement | null;
  setCurrentAudioElement: (element: HTMLVideoElement | HTMLAudioElement | null) => void;
  muteAll: () => void;
  isGloballyMuted: boolean;
  setGloballyMuted: (muted: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAudioElement, setCurrentAudioElementState] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isGloballyMuted, setGloballyMuted] = useState(false);
  const previousElementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const setCurrentAudioElement = (element: HTMLVideoElement | HTMLAudioElement | null) => {
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
    }
  };

  const muteAll = () => {
    if (currentAudioElement) {
      currentAudioElement.muted = true;
      currentAudioElement.volume = 0;
    }
    if (previousElementRef.current) {
      previousElementRef.current.muted = true;
      previousElementRef.current.volume = 0;
    }
  };

  return (
    <AudioContext.Provider value={{
      currentAudioElement,
      setCurrentAudioElement,
      muteAll,
      isGloballyMuted,
      setGloballyMuted
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
