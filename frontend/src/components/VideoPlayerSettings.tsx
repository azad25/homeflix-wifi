"use client";

/**
 * NETFLIX-STYLE VIDEO PLAYER SETTINGS PANEL
 * 
 * Features:
 * - Subtitle track selection (internal and external)
 * - Audio track selection (multi-language support)
 * - Subtitle styling (size, color, background, font)
 * - Playback speed control
 * - Quality selection
 * - Accessibility options
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Subtitles, 
  Volume2, 
  Palette, 
  Play, 
  Monitor,
  ChevronRight,
  ChevronLeft,
  X,
  Check
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface SubtitleTrack {
  id: number;
  stream_index: number;
  language: string;
  title: string;
  codec_name: string;
  track_type: 'internal' | 'external';
  is_default: boolean;
  is_forced: boolean;
  is_hearing_impaired: boolean;
  file_path?: string;
}

interface AudioTrack {
  id: number;
  stream_index: number;
  language: string;
  title: string;
  codec_name: string;
  channels: number;
  sample_rate: number;
  bitrate: number;
  is_default: boolean;
}

interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  textShadow: boolean;
  textStroke: boolean;
  position: 'bottom' | 'top' | 'center';
}

interface VideoPlayerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: number;
  currentSubtitleTrack?: number | null;
  currentAudioTrack?: number | null;
  playbackRate: number;
  onSubtitleTrackChange: (trackId: number | null) => void;
  onAudioTrackChange: (trackId: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onSubtitleStyleChange: (style: SubtitleStyle) => void;
  subtitleStyle: SubtitleStyle;
}

const VideoPlayerSettings: React.FC<VideoPlayerSettingsProps> = ({
  isOpen,
  onClose,
  mediaId,
  currentSubtitleTrack,
  currentAudioTrack,
  playbackRate,
  onSubtitleTrackChange,
  onAudioTrackChange,
  onPlaybackRateChange,
  onSubtitleStyleChange,
  subtitleStyle
}) => {
  const [activePanel, setActivePanel] = useState<string>('main');
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(false);

  // Load tracks when component opens
  useEffect(() => {
    if (isOpen && mediaId) {
      loadTracks();
    }
  }, [isOpen, mediaId]);

  const loadTracks = async () => {
    setLoading(true);
    try {
      // Load subtitle tracks
      const subtitleResponse = await fetch(`${getApiUrl()}/api/media/${mediaId}/subtitles`);
      if (subtitleResponse.ok) {
        const subtitles = await subtitleResponse.json();
        setSubtitleTracks(subtitles || []);
      }

      // Load audio tracks
      const audioResponse = await fetch(`${getApiUrl()}/api/media/${mediaId}/audio`);
      if (audioResponse.ok) {
        const audio = await audioResponse.json();
        setAudioTracks(audio || []);
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  
  const fontFamilies = [
    { name: 'Default', value: 'Arial, sans-serif' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
  ];

  const colors = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Cyan', value: '#00FFFF' },
    { name: 'Red', value: '#FF0000' },
    { name: 'Magenta', value: '#FF00FF' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Black', value: '#000000' },
  ];

  const backgroundColors = [
    { name: 'None', value: 'transparent' },
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Red', value: '#FF0000' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Yellow', value: '#FFFF00' },
  ];

  const renderMainPanel = () => (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
      
      {/* Subtitle Settings */}
      <button
        onClick={() => setActivePanel('subtitles')}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Subtitles className="w-5 h-5 text-white" />
          <span className="text-white">Subtitles</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {currentSubtitleTrack ? 
              subtitleTracks.find(t => t.id === currentSubtitleTrack)?.language || 'On' : 
              'Off'
            }
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Audio Settings */}
      <button
        onClick={() => setActivePanel('audio')}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-white" />
          <span className="text-white">Audio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {audioTracks.find(t => t.id === currentAudioTrack)?.language || 'Default'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Subtitle Appearance */}
      <button
        onClick={() => setActivePanel('appearance')}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-white" />
          <span className="text-white">Subtitle Appearance</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>

      {/* Playback Speed */}
      <button
        onClick={() => setActivePanel('playback')}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Play className="w-5 h-5 text-white" />
          <span className="text-white">Playback Speed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">{playbackRate}x</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Quality (placeholder for future implementation) */}
      <button
        onClick={() => setActivePanel('quality')}
        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-white" />
          <span className="text-white">Quality</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Auto</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>
    </div>
  );

  const renderSubtitlePanel = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Subtitles</h3>
      </div>

      {/* Off Option */}
      <button
        onClick={() => onSubtitleTrackChange(null)}
        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
          currentSubtitleTrack === null 
            ? 'bg-red-600/50 border border-red-500' 
            : 'bg-gray-800/50 hover:bg-gray-700/50'
        }`}
      >
        <span className="text-white">Off</span>
        {currentSubtitleTrack === null && <Check className="w-4 h-4 text-red-500" />}
      </button>

      {/* Subtitle Tracks */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading tracks...</p>
        </div>
      ) : (
        subtitleTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => onSubtitleTrackChange(track.id)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              currentSubtitleTrack === track.id 
                ? 'bg-red-600/50 border border-red-500' 
                : 'bg-gray-800/50 hover:bg-gray-700/50'
            }`}
          >
            <div className="text-left">
              <div className="text-white font-medium">{track.language}</div>
              <div className="text-gray-400 text-sm">
                {track.title} • {track.track_type}
                {track.is_default && ' • Default'}
                {track.is_forced && ' • Forced'}
                {track.is_hearing_impaired && ' • CC'}
              </div>
            </div>
            {currentSubtitleTrack === track.id && <Check className="w-4 h-4 text-red-500" />}
          </button>
        ))
      )}

      {!loading && subtitleTracks.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-400">No subtitle tracks available</p>
        </div>
      )}
    </div>
  );

  const renderAudioPanel = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Audio</h3>
      </div>

      {/* Audio Tracks */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading tracks...</p>
        </div>
      ) : (
        audioTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => onAudioTrackChange(track.id)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              currentAudioTrack === track.id 
                ? 'bg-red-600/50 border border-red-500' 
                : 'bg-gray-800/50 hover:bg-gray-700/50'
            }`}
          >
            <div className="text-left">
              <div className="text-white font-medium">{track.language}</div>
              <div className="text-gray-400 text-sm">
                {track.title} • {track.codec_name.toUpperCase()}
                {track.channels && ` • ${track.channels}ch`}
                {track.is_default && ' • Default'}
              </div>
            </div>
            {currentAudioTrack === track.id && <Check className="w-4 h-4 text-red-500" />}
          </button>
        ))
      )}

      {!loading && audioTracks.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-400">No audio tracks available</p>
        </div>
      )}
    </div>
  );

  const renderAppearancePanel = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Subtitle Appearance</h3>
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div 
            className="inline-block px-3 py-1 rounded"
            style={{
              fontSize: `${subtitleStyle.fontSize}px`,
              fontFamily: subtitleStyle.fontFamily,
              color: subtitleStyle.color,
              backgroundColor: subtitleStyle.backgroundColor === 'transparent' ? 'transparent' : 
                `${subtitleStyle.backgroundColor}${Math.round(subtitleStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
              textShadow: subtitleStyle.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
              WebkitTextStroke: subtitleStyle.textStroke ? '1px black' : 'none',
            }}
          >
            Sample subtitle text
          </div>
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Font Size</label>
        <input
          type="range"
          min="12"
          max="32"
          value={subtitleStyle.fontSize}
          onChange={(e) => onSubtitleStyleChange({
            ...subtitleStyle,
            fontSize: parseInt(e.target.value)
          })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Small</span>
          <span>{subtitleStyle.fontSize}px</span>
          <span>Large</span>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Font Family</label>
        <div className="grid grid-cols-2 gap-2">
          {fontFamilies.map((font) => (
            <button
              key={font.value}
              onClick={() => onSubtitleStyleChange({
                ...subtitleStyle,
                fontFamily: font.value
              })}
              className={`p-2 rounded text-sm transition-colors ${
                subtitleStyle.fontFamily === font.value
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              style={{ fontFamily: font.value }}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Text Color</label>
        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => onSubtitleStyleChange({
                ...subtitleStyle,
                color: color.value
              })}
              className={`p-2 rounded text-xs transition-colors border-2 ${
                subtitleStyle.color === color.value
                  ? 'border-red-500'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              style={{ backgroundColor: color.value, color: color.value === '#FFFFFF' ? '#000' : '#FFF' }}
            >
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Background</label>
        <div className="grid grid-cols-4 gap-2">
          {backgroundColors.map((bg) => (
            <button
              key={bg.value}
              onClick={() => onSubtitleStyleChange({
                ...subtitleStyle,
                backgroundColor: bg.value
              })}
              className={`p-2 rounded text-xs transition-colors border-2 ${
                subtitleStyle.backgroundColor === bg.value
                  ? 'border-red-500'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              style={{ 
                backgroundColor: bg.value === 'transparent' ? 'transparent' : bg.value,
                color: bg.value === '#FFFFFF' ? '#000' : '#FFF',
                backgroundImage: bg.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none',
                backgroundSize: bg.value === 'transparent' ? '8px 8px' : 'auto',
                backgroundPosition: bg.value === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : 'auto'
              }}
            >
              {bg.name}
            </button>
          ))}
        </div>
      </div>

      {/* Background Opacity */}
      {subtitleStyle.backgroundColor !== 'transparent' && (
        <div>
          <label className="block text-white text-sm font-medium mb-2">Background Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={subtitleStyle.backgroundOpacity}
            onChange={(e) => onSubtitleStyleChange({
              ...subtitleStyle,
              backgroundOpacity: parseFloat(e.target.value)
            })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Transparent</span>
            <span>{Math.round(subtitleStyle.backgroundOpacity * 100)}%</span>
            <span>Opaque</span>
          </div>
        </div>
      )}

      {/* Text Effects */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Text Effects</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.textShadow}
              onChange={(e) => onSubtitleStyleChange({
                ...subtitleStyle,
                textShadow: e.target.checked
              })}
              className="rounded"
            />
            <span className="text-white text-sm">Drop Shadow</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.textStroke}
              onChange={(e) => onSubtitleStyleChange({
                ...subtitleStyle,
                textStroke: e.target.checked
              })}
              className="rounded"
            />
            <span className="text-white text-sm">Text Outline</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderPlaybackPanel = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Playback Speed</h3>
      </div>

      {playbackRates.map((rate) => (
        <button
          key={rate}
          onClick={() => onPlaybackRateChange(rate)}
          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
            playbackRate === rate 
              ? 'bg-red-600/50 border border-red-500' 
              : 'bg-gray-800/50 hover:bg-gray-700/50'
          }`}
        >
          <span className="text-white">{rate}x {rate === 1 ? '(Normal)' : ''}</span>
          {playbackRate === rate && <Check className="w-4 h-4 text-red-500" />}
        </button>
      ))}
    </div>
  );

  const renderQualityPanel = () => (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Quality</h3>
      </div>

      <div className="text-center py-8">
        <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Quality selection coming soon</p>
        <p className="text-gray-500 text-sm mt-2">Currently using automatic quality</p>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-white" />
                <h2 className="text-lg font-semibold text-white">Player Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-700/50 rounded transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePanel}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {activePanel === 'main' && renderMainPanel()}
                  {activePanel === 'subtitles' && renderSubtitlePanel()}
                  {activePanel === 'audio' && renderAudioPanel()}
                  {activePanel === 'appearance' && renderAppearancePanel()}
                  {activePanel === 'playback' && renderPlaybackPanel()}
                  {activePanel === 'quality' && renderQualityPanel()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayerSettings;