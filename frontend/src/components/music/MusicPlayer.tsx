"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Heart, MoreHorizontal } from 'lucide-react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { MusicAPI } from '@/lib/musicApi';

export default function MusicPlayer() {
  const { state, pauseTrack, resumeTrack, nextTrack, previousTrack, setVolume, toggleShuffle, toggleRepeat } = useMusicPlayer();
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const audioRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const { currentTrack, isPlaying, volume, currentTime, duration, shuffle, repeat } = state;

  // Simulated audio visualizer with better performance
  const drawSimulatedVisualizer = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isPlaying) {
      // Draw static bars when not playing
      const barCount = 20;
      const barWidth = canvas.width / barCount;
      
      ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
      for (let i = 0; i < barCount; i++) {
        const staticHeight = 2;
        ctx.fillRect(i * barWidth, canvas.height - staticHeight, barWidth - 1, staticHeight);
      }
      return;
    }

    // Generate realistic frequency data simulation
    const barCount = 20;
    const barWidth = canvas.width / barCount;
    const time = Date.now() * 0.002;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, '#dc2626');
    gradient.addColorStop(0.5, '#ef4444');
    gradient.addColorStop(1, '#f87171');

    for (let i = 0; i < barCount; i++) {
      // Simulate different frequency ranges
      const frequency = i / barCount;
      
      // Bass emphasis for lower frequencies
      const bassBoost = frequency < 0.3 ? 1.5 : 1;
      const midBoost = frequency >= 0.3 && frequency < 0.7 ? 1.2 : 1;
      const trebleBoost = frequency >= 0.7 ? 0.8 : 1;
      
      const baseHeight = Math.sin(time * 3 + i * 0.5) * 0.3 + 0.4;
      const randomVariation = Math.sin(time * 5 + i * 0.8) * 0.2;
      const pulseEffect = Math.sin(time * 2) * 0.1 + 0.9;
      
      let barHeight = (baseHeight + randomVariation) * bassBoost * midBoost * trebleBoost * pulseEffect;
      barHeight = Math.max(0.1, Math.min(1, barHeight)) * canvas.height * 0.8;
      
      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(drawSimulatedVisualizer);
    }
  }, [isPlaying]);

  // Start/stop visualizer based on playing state
  useEffect(() => {
    if (isPlaying) {
      drawSimulatedVisualizer();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, drawSimulatedVisualizer]);

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

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-black via-red-950 to-black border-t border-red-800/30 px-4 py-3 z-50 backdrop-blur-lg overflow-hidden">
      <div className="flex items-center justify-between w-full max-w-none">
        {/* Track Info - Fixed width */}
        <div className="flex items-center gap-3 w-80 min-w-0 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <img
              src={currentTrack.thumbnail_url}
              alt={currentTrack.title}
              className="w-14 h-14 rounded-lg object-cover shadow-lg"
            />
            {isPlaying && (
              <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-semibold text-sm truncate">{currentTrack.title}</h3>
            <p className="text-red-300 text-xs truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Player Controls - Center section */}
        <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl mx-8">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleShuffle}
              className={`transition-colors transform hover:scale-110 ${
                shuffle ? 'text-red-500' : 'text-red-300 hover:text-white'
              }`}
            >
              <Shuffle size={16} />
            </button>
            
            <button
              onClick={previousTrack}
              className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
            >
              <SkipBack size={20} />
            </button>
            
            <button
              onClick={handlePlayPause}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-full p-2.5 transform hover:scale-110 transition-all duration-300 shadow-lg"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            
            <button
              onClick={nextTrack}
              className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
            >
              <SkipForward size={20} />
            </button>
            
            <button
              onClick={toggleRepeat}
              className={`transition-colors transform hover:scale-110 ${
                repeat !== 'none' ? 'text-red-500' : 'text-red-300 hover:text-white'
              }`}
            >
              <Repeat size={16} />
            </button>

            <button
              onClick={handleLikeTrack}
              className="text-red-300 hover:text-red-400 transition-colors transform hover:scale-110"
            >
              <Heart size={16} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-red-300 w-8 text-right font-mono">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 bg-red-900/30 rounded-full h-1.5 cursor-pointer">
              <div
                className="bg-gradient-to-r from-red-500 to-red-600 rounded-full h-1.5 transition-all duration-300 shadow-sm"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-red-300 w-8 font-mono">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Section - Visualizer & Volume */}
        <div className="flex items-center gap-3 w-80 justify-end flex-shrink-0">
          {/* Live Audio Visualizer */}
          <div className="flex items-center bg-black/30 rounded-lg p-2">
            <canvas
              ref={canvasRef}
              width={80}
              height={32}
              className="rounded"
              style={{ 
                filter: isPlaying ? 'none' : 'grayscale(100%) opacity(30%)',
                transition: 'filter 0.3s ease'
              }}
            />
          </div>
          
          <button className="text-red-300 hover:text-white transition-colors transform hover:scale-110">
            <MoreHorizontal size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-red-300 hover:text-white transition-colors transform hover:scale-110"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            
            <div className="w-16">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-red-900/30 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden YouTube iframe for audio */}
      {currentTrack && (
        <iframe
          ref={audioRef}
          src={`https://www.youtube.com/embed/${currentTrack.youtube_id}?autoplay=${isPlaying ? 1 : 0}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1`}
          className="hidden"
          allow="autoplay"
        />
      )}

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

        canvas {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}