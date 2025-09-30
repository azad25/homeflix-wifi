"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Headphones, Waves, Zap } from 'lucide-react';
import { useEnhancedAudio } from '../contexts/EnhancedAudioContext';

interface AudioQualityIndicatorProps {
  className?: string;
  showControls?: boolean;
  compact?: boolean;
}

export const AudioQualityIndicator: React.FC<AudioQualityIndicatorProps> = ({
  className = '',
  showControls = true,
  compact = false
}) => {
  const {
    audioQuality,
    spatialAudioEnabled,
    dolbyAtmosEnabled,
    isALACEnabled,
    isLosslessPlayback,
    setAudioQuality,
    toggleSpatialAudio,
    toggleDolbyAtmos,
    getMasterVolume,
    setMasterVolume,
    getAudioAnalysis
  } = useEnhancedAudio();

  const [volume, setVolume] = useState(getMasterVolume());
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [audioLevels, setAudioLevels] = useState<Float32Array>(new Float32Array(0));
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Update audio analysis visualization
  useEffect(() => {
    const interval = setInterval(() => {
      const analysis = getAudioAnalysis();
      if (analysis.length > 0) {
        setAudioLevels(analysis);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [getAudioAnalysis]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setMasterVolume(newVolume);
  };

  const getQualityBadgeColor = () => {
    switch (audioQuality) {
      case 'hi-res':
        return 'from-purple-500 to-pink-500';
      case 'lossless':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getQualityLabel = () => {
    if (!isALACEnabled) return 'Standard';
    
    switch (audioQuality) {
      case 'hi-res':
        return 'Hi-Res ALAC';
      case 'lossless':
        return 'ALAC Lossless';
      default:
        return 'Standard';
    }
  };

  const AudioVisualization = () => {
    if (audioLevels.length === 0) return null;

    // Take first 8 frequency bins for visualization
    const bars = Array.from(audioLevels.slice(0, 8)).map((level, index) => {
      const normalizedLevel = Math.max(0, (level + 100) / 100); // Normalize -100dB to 0dB range
      const height = Math.max(2, normalizedLevel * 20);
      
      return (
        <motion.div
          key={index}
          className="bg-gradient-to-t from-blue-400 to-cyan-300 rounded-sm"
          style={{
            width: '2px',
            height: `${height}px`,
            minHeight: '2px'
          }}
          animate={{
            height: `${height}px`,
            opacity: normalizedLevel > 0.1 ? 1 : 0.3
          }}
          transition={{
            duration: 0.1,
            ease: 'easeOut'
          }}
        />
      );
    });

    return (
      <div className="flex items-end gap-0.5 h-5">
        {bars}
      </div>
    );
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getQualityBadgeColor()} text-white`}>
          {getQualityLabel()}
        </div>
        {spatialAudioEnabled && (
          <Waves className="w-4 h-4 text-blue-400" />
        )}
        {dolbyAtmosEnabled && (
          <Zap className="w-4 h-4 text-purple-400" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Audio Quality Badge */}
      <div className="relative">
        <button
          onClick={() => setShowQualityMenu(!showQualityMenu)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r ${getQualityBadgeColor()} text-white hover:opacity-90 transition-opacity flex items-center gap-2`}
        >
          <span>{getQualityLabel()}</span>
          {isLosslessPlayback() && (
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          )}
        </button>

        {/* Quality Selection Menu */}
        <AnimatePresence>
          {showQualityMenu && showControls && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 left-0 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-700 p-2 min-w-[150px] z-50"
            >
              {['standard', 'lossless', 'hi-res'].map((quality) => (
                <button
                  key={quality}
                  onClick={() => {
                    setAudioQuality(quality as any);
                    setShowQualityMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors ${
                    audioQuality === quality ? 'text-blue-400 bg-blue-500/20' : 'text-white'
                  }`}
                >
                  {quality === 'hi-res' ? 'Hi-Res (192kHz)' : 
                   quality === 'lossless' ? 'Lossless (96kHz)' : 
                   'Standard (48kHz)'}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Audio Visualization */}
      <AudioVisualization />

      {/* Spatial Audio Indicators */}
      <div className="flex items-center gap-2">
        {spatialAudioEnabled && (
          <motion.button
            onClick={toggleSpatialAudio}
            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Spatial Audio Enabled"
          >
            <Waves className="w-4 h-4" />
          </motion.button>
        )}

        {dolbyAtmosEnabled && (
          <motion.button
            onClick={toggleDolbyAtmos}
            className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Dolby Atmos Enabled"
          >
            <Zap className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Volume Control */}
      {showControls && (
        <div className="relative">
          <button
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            className="p-1.5 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <AnimatePresence>
            {showVolumeSlider && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute top-full mt-2 left-0 bg-black/90 backdrop-blur-sm rounded-lg border border-gray-700 p-3 z-50"
              >
                <div className="flex items-center gap-3">
                  <VolumeX className="w-4 h-4 text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <Volume2 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-xs text-gray-400 mt-2 text-center">
                  {Math.round(volume * 100)}%
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Lossless Indicator */}
      {isLosslessPlayback() && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
          <Headphones className="w-3 h-3" />
          <span>Lossless</span>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
        
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #1e40af;
        }
      `}</style>
    </div>
  );
};

export default AudioQualityIndicator;
