"use client";

import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Shuffle, 
  Repeat, 
  Heart, 
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Music,
  Clock,
  List
} from 'lucide-react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { MusicAPI } from '@/lib/musicApi';

interface MusicSidebarProps {
  className?: string;
}

export default function MusicSidebar({ className = '' }: MusicSidebarProps) {
  const { state, pauseTrack, resumeTrack, nextTrack, previousTrack, setVolume, toggleShuffle, toggleRepeat } = useMusicPlayer();
  const [isMuted, setIsMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const { currentTrack, isPlaying, volume, currentTime, duration, queue, shuffle, repeat } = state;

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(0.7);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleLikeTrack = async () => {
    if (!currentTrack) return;
    
    try {
      await MusicAPI.likeTrack(currentTrack.id);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Failed to like track:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className={`w-96 bg-gradient-to-b from-black via-red-950 to-black border-l border-red-800/30 flex flex-col ${className}`}>
        <div className="p-8 text-center">
          <Music size={80} className="mx-auto text-red-600/50 mb-6" />
          <h3 className="text-white font-semibold text-xl mb-3">No music playing</h3>
          <p className="text-red-300 text-sm">Select a song to start listening</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-96 bg-gradient-to-b from-black via-red-950 to-black border-l border-red-800/30 flex flex-col ${className} backdrop-blur-sm`}>
      {/* Now Playing Header */}
      <div className="p-6 border-b border-red-800/30">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-xl bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">Now Playing</h2>
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
          >
            <List size={24} />
          </button>
        </div>
      </div>

      {/* Album Art & Track Info */}
      <div className="p-8 text-center">
        <div className="relative mb-8">
          <div className="relative">
            <img
              src={currentTrack.thumbnail_url}
              alt={currentTrack.title}
              className="w-full aspect-square rounded-2xl object-cover shadow-2xl border border-red-800/20"
            />
            {isPlaying && (
              <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-red-600 rounded-full p-3 shadow-lg">
                <div className="flex gap-1">
                  <div className="w-1 h-3 bg-white rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                  <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '450ms' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <h3 className="text-white font-bold text-2xl leading-tight line-clamp-2">
            {currentTrack.title}
          </h3>
          <p className="text-red-300 text-lg font-medium">{currentTrack.artist}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-red-400">
            <span>{MusicAPI.formatNumber(currentTrack.view_count)} views</span>
            <span>•</span>
            <span>{MusicAPI.formatDuration(currentTrack.duration)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-8 mb-6">
        <div className="flex items-center gap-3 text-sm text-red-300 mb-3">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <div className="flex-1 bg-red-900/30 rounded-full h-2 cursor-pointer">
            <div
              className="bg-gradient-to-r from-red-500 to-red-600 rounded-full h-2 transition-all duration-300 shadow-sm"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="px-8 mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={toggleShuffle}
            className={`transition-all transform hover:scale-110 ${shuffle ? 'text-red-500' : 'text-red-300 hover:text-white'}`}
          >
            <Shuffle size={24} />
          </button>
          
          <button
            onClick={previousTrack}
            className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
          >
            <SkipBack size={32} />
          </button>
          
          <button
            onClick={handlePlayPause}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full p-4 transform hover:scale-110 transition-all duration-300 shadow-lg"
          >
            {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
          </button>
          
          <button
            onClick={nextTrack}
            className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
          >
            <SkipForward size={32} />
          </button>
          
          <button
            onClick={toggleRepeat}
            className={`transition-all transform hover:scale-110 ${repeat !== 'none' ? 'text-red-500' : 'text-red-300 hover:text-white'}`}
          >
            <Repeat size={24} />
          </button>
        </div>

        {/* Secondary Controls Row */}
        <div className="flex items-center justify-center gap-6 mb-6">
          {/* Like Button */}
          <button
            onClick={handleLikeTrack}
            className="text-red-300 hover:text-red-400 transition-colors transform hover:scale-110"
          >
            <Heart size={28} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
          </button>

          {/* More Options */}
          <button className="text-red-300 hover:text-white transition-colors transform hover:scale-110">
            <MoreHorizontal size={28} />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMute}
            className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
          >
            {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-red-900/30 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>

      {/* Queue Section */}
      {showQueue && (
        <div className="flex-1 border-t border-red-800/30 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-semibold text-lg">Queue</h3>
              <span className="text-red-300 text-sm bg-red-900/30 px-3 py-1 rounded-full">{queue.length} songs</span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className={`flex items-center gap-4 p-3 rounded-xl hover:bg-red-900/20 transition-all duration-300 ${
                    track.id === currentTrack.id ? 'bg-red-900/30 border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="w-12 h-12 relative">
                    <img
                      src={track.thumbnail_url}
                      alt={track.title}
                      className="w-full h-full rounded-lg object-cover"
                    />
                    {track.id === currentTrack.id && isPlaying && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="flex gap-1">
                          <div className="w-1 h-2 bg-red-500 rounded animate-pulse" />
                          <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-2 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold truncate ${
                      track.id === currentTrack.id ? 'text-red-400' : 'text-white'
                    }`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-red-300 truncate">{track.artist}</p>
                  </div>
                  
                  <div className="text-xs text-red-400 font-mono">
                    {MusicAPI.formatDuration(track.duration)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expand/Collapse Queue Button */}
      <div className="p-6 border-t border-red-800/30">
        <button
          onClick={() => setShowQueue(!showQueue)}
          className="w-full flex items-center justify-center gap-3 text-red-300 hover:text-white transition-colors py-2 rounded-lg hover:bg-red-900/20"
        >
          {showQueue ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          <span className="font-medium">{showQueue ? 'Hide Queue' : 'Show Queue'}</span>
        </button>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, #ef4444, #dc2626);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, #ef4444, #dc2626);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
        }

        .slider::-webkit-slider-track {
          background: rgba(153, 27, 27, 0.3);
          height: 8px;
          border-radius: 4px;
        }
        
        .slider::-moz-range-track {
          background: rgba(153, 27, 27, 0.3);
          height: 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}