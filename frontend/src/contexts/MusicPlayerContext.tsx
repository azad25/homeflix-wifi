"use client";

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { Track, MusicPlayerState } from '@/types/music';
import { MusicAPI } from '@/lib/musicApi';

interface MusicPlayerContextType {
  state: MusicPlayerState;
  playTrack: (track: Track, queue?: Track[]) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
}

type MusicPlayerAction =
  | { type: 'PLAY_TRACK'; payload: { track: Track; queue?: Track[] } }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'NEXT_TRACK' }
  | { type: 'PREVIOUS_TRACK' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'TOGGLE_REPEAT' }
  | { type: 'ADD_TO_QUEUE'; payload: Track };

const initialState: MusicPlayerState = {
  currentTrack: null,
  isPlaying: false,
  volume: 0.7,
  currentTime: 0,
  duration: 0,
  queue: [],
  currentIndex: 0,
  shuffle: false,
  repeat: 'none',
};

function musicPlayerReducer(state: MusicPlayerState, action: MusicPlayerAction): MusicPlayerState {
  switch (action.type) {
    case 'PLAY_TRACK':
      return {
        ...state,
        currentTrack: action.payload.track,
        queue: action.payload.queue || [action.payload.track],
        currentIndex: 0,
        isPlaying: true,
        currentTime: 0,
      };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'RESUME':
      return { ...state, isPlaying: true };
    case 'NEXT_TRACK':
      const nextIndex = state.shuffle 
        ? Math.floor(Math.random() * state.queue.length)
        : (state.currentIndex + 1) % state.queue.length;
      
      if (nextIndex >= state.queue.length && state.repeat === 'none') {
        return { ...state, isPlaying: false };
      }
      
      const actualNextIndex = nextIndex >= state.queue.length ? 0 : nextIndex;
      return {
        ...state,
        currentIndex: actualNextIndex,
        currentTrack: state.queue[actualNextIndex],
        currentTime: 0,
        isPlaying: true,
      };
    case 'PREVIOUS_TRACK':
      const prevIndex = state.shuffle
        ? Math.floor(Math.random() * state.queue.length)
        : state.currentIndex - 1 < 0 ? state.queue.length - 1 : state.currentIndex - 1;
      
      return {
        ...state,
        currentIndex: prevIndex,
        currentTrack: state.queue[prevIndex],
        currentTime: 0,
        isPlaying: true,
      };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'TOGGLE_SHUFFLE':
      return { ...state, shuffle: !state.shuffle };
    case 'TOGGLE_REPEAT':
      const nextRepeat = state.repeat === 'none' ? 'all' : state.repeat === 'all' ? 'one' : 'none';
      return { ...state, repeat: nextRepeat };
    case 'ADD_TO_QUEUE':
      return {
        ...state,
        queue: [...state.queue, action.payload],
      };
    default:
      return state;
  }
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(musicPlayerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTrack = async (track: Track, queue?: Track[]) => {
    try {
      await MusicAPI.playTrack(track.id);
      dispatch({ type: 'PLAY_TRACK', payload: { track, queue } });
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  };

  const pauseTrack = () => {
    dispatch({ type: 'PAUSE' });
  };

  const resumeTrack = () => {
    dispatch({ type: 'RESUME' });
  };

  const nextTrack = () => {
    dispatch({ type: 'NEXT_TRACK' });
  };

  const previousTrack = () => {
    dispatch({ type: 'PREVIOUS_TRACK' });
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const seekTo = (time: number) => {
    dispatch({ type: 'SET_CURRENT_TIME', payload: time });
  };

  const toggleShuffle = () => {
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  };

  const toggleRepeat = () => {
    dispatch({ type: 'TOGGLE_REPEAT' });
  };

  const addToQueue = (track: Track) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: track });
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        state,
        playTrack,
        pauseTrack,
        resumeTrack,
        nextTrack,
        previousTrack,
        setVolume,
        seekTo,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerContextType {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
}