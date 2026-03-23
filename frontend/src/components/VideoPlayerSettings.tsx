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
  Check,
  Waves,
  TrendingUp
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

// Cookie utility functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

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
  bold: boolean;
  italic: boolean;
  position: 'bottom' | 'top' | 'center';
  verticalOffset: number;
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
  settingsButtonRef?: React.RefObject<HTMLButtonElement | null>;
  stableVolumeEnabled?: boolean;
  volumeBoostEnabled?: boolean;
  volumeBoostLevel?: number;
  onStableVolumeChange?: (enabled: boolean) => void;
  onVolumeBoostChange?: (enabled: boolean, level: number) => void;
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
  subtitleStyle,
  settingsButtonRef,
  stableVolumeEnabled = false,
  volumeBoostEnabled = false,
  volumeBoostLevel = 1.0,
  onStableVolumeChange,
  onVolumeBoostChange
}) => {
  const [activePanel, setActivePanel] = useState<string>('main');
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ bottom: 60, right: 20 });

  // Load saved settings from cookies when settings opens
  useEffect(() => {
    const savedSubtitleStyle = getCookie('homeflix_subtitle_style');
    if (savedSubtitleStyle) {
      try {
        const parsed = JSON.parse(savedSubtitleStyle);
        onSubtitleStyleChange(parsed);
      } catch (e) {
        // Invalid cookie data, ignore
      }
    }

    const savedPlaybackRate = getCookie('homeflix_playback_rate');
    if (savedPlaybackRate) {
      const rate = parseFloat(savedPlaybackRate);
      if (!isNaN(rate) && rate >= 0.25 && rate <= 2) {
        onPlaybackRateChange(rate);
      }
    }
  }, [isOpen, onSubtitleStyleChange, onPlaybackRateChange]);

  // Save subtitle style to cookie whenever it changes
  useEffect(() => {
    if (subtitleStyle) {
      setCookie('homeflix_subtitle_style', JSON.stringify(subtitleStyle));
    }
  }, [subtitleStyle]);

  // Save playback rate to cookie whenever it changes
  useEffect(() => {
    if (playbackRate) {
      setCookie('homeflix_playback_rate', playbackRate.toString());
    }
  }, [playbackRate]);

  // Load tracks when component opens
  useEffect(() => {
    if (isOpen && mediaId) {
      loadTracks();
    }
  }, [isOpen, mediaId]);

  // Calculate position based on settings button
  useEffect(() => {
    if (isOpen && settingsButtonRef?.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect();
      const panelHeight = 500; // Approximate panel height
      setPosition({
        bottom: window.innerHeight - rect.top + rect.height + 20, // Add button height + 20px gap
        right: window.innerWidth - rect.right - 10 // Shift slightly to the left
      });
    }
  }, [isOpen, settingsButtonRef]);

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
      
      {/* Subtitle Settings */}
      <button
        onClick={() => setActivePanel('subtitles')}
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
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

      {/* Audio Track Settings */}
      <button
        onClick={() => setActivePanel('audio')}
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-white" />
          <span className="text-white">Audio Track</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {audioTracks.find(t => t.id === currentAudioTrack)?.language || 'Default'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Stable Volume */}
      <button
        onClick={() => {
          const newEnabled = !stableVolumeEnabled;
          onStableVolumeChange?.(newEnabled);
        }}
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Waves className="w-5 h-5 text-white" />
          <span className="text-white">Stable Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${stableVolumeEnabled ? 'text-red-400' : 'text-gray-400'}`}>
            {stableVolumeEnabled ? 'On' : 'Off'}
          </span>
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            stableVolumeEnabled ? 'bg-red-600' : 'bg-gray-600'
          }`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              stableVolumeEnabled ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </div>
        </div>
      </button>

      {/* Volume Boost */}
      <button
        onClick={() => setActivePanel('volumeBoost')}
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-white" />
          <span className="text-white">Volume Boost</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">
            {volumeBoostEnabled ? `${Math.round(volumeBoostLevel * 100)}%` : 'Off'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </button>

      {/* Subtitle Appearance */}
      <button
        onClick={() => setActivePanel('appearance')}
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
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
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
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
        className="w-full flex items-center justify-between p-3 bg-black/80 hover:bg-red-600/20 rounded-lg transition-colors"
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
            ? 'bg-red-600 border border-red-500' 
            : 'bg-black/80 hover:bg-red-900/30'
        }`}
      >
        <span className="text-white">Off</span>
        {currentSubtitleTrack === null && <Check className="w-4 h-4 text-white" />}
      </button>

      {/* Subtitle Tracks */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading tracks...</p>
        </div>
      ) : (
        subtitleTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => onSubtitleTrackChange(track.id)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              currentSubtitleTrack === track.id 
                ? 'bg-red-600 border border-red-500' 
                : 'bg-black/80 hover:bg-red-900/30'
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
            {currentSubtitleTrack === track.id && <Check className="w-4 h-4 text-white" />}
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading tracks...</p>
        </div>
      ) : (
        audioTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => onAudioTrackChange(track.id)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              currentAudioTrack === track.id 
                ? 'bg-red-600 border border-red-500' 
                : 'bg-black/80 hover:bg-red-900/30'
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
            {currentAudioTrack === track.id && <Check className="w-4 h-4 text-white" />}
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
      <div className="bg-black rounded-lg p-4 mb-4 border border-gray-800 h-48 flex flex-col justify-between">
        <div className="text-center opacity-30 text-gray-500 text-xs">Video Content</div>
        <div className="flex flex-col">
          {subtitleStyle.position === 'top' && (
            <div 
              className="inline-block px-3 py-1 rounded text-center mx-auto"
              style={{
                fontSize: `${subtitleStyle.fontSize}px`,
                fontFamily: subtitleStyle.fontFamily,
                color: subtitleStyle.color,
                backgroundColor: subtitleStyle.backgroundColor === 'transparent' ? 'transparent' : 
                  `${subtitleStyle.backgroundColor}${Math.round(subtitleStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                textShadow: subtitleStyle.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                WebkitTextStroke: subtitleStyle.textStroke ? '1px black' : 'none',
                fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
                marginTop: `${subtitleStyle.verticalOffset}px`,
              }}
            >
              Sample subtitle
            </div>
          )}
          {subtitleStyle.position === 'center' && (
            <div className="flex items-center justify-center flex-1">
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
                  fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                  fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
                  marginTop: `${subtitleStyle.verticalOffset}px`,
                }}
              >
                Sample subtitle
              </div>
            </div>
          )}
          {subtitleStyle.position === 'bottom' && (
            <div 
              className="inline-block px-3 py-1 rounded text-center mx-auto"
              style={{
                fontSize: `${subtitleStyle.fontSize}px`,
                fontFamily: subtitleStyle.fontFamily,
                color: subtitleStyle.color,
                backgroundColor: subtitleStyle.backgroundColor === 'transparent' ? 'transparent' : 
                  `${subtitleStyle.backgroundColor}${Math.round(subtitleStyle.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                textShadow: subtitleStyle.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                WebkitTextStroke: subtitleStyle.textStroke ? '1px black' : 'none',
                fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
                marginTop: `${subtitleStyle.verticalOffset}px`,
              }}
            >
              Sample subtitle
            </div>
          )}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Font Size</label>
        <input
          type="range"
          min="12"
          max="48"
          value={subtitleStyle.fontSize}
          onChange={(e) => {
            const newStyle = {
              ...subtitleStyle,
              fontSize: parseInt(e.target.value)
            };
            onSubtitleStyleChange(newStyle);
            setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
          }}
          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Small</span>
          <span>{subtitleStyle.fontSize}px</span>
          <span>Large</span>
        </div>
      </div>

      {/* Position */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Position</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {['top', 'center', 'bottom'].map((pos) => (
            <button
              key={pos}
              onClick={() => {
                const newStyle = {
                  ...subtitleStyle,
                  position: pos as 'bottom' | 'top' | 'center'
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
              className={`p-2 rounded text-sm transition-colors capitalize ${
                subtitleStyle.position === pos
                  ? 'bg-red-600 text-white'
                  : 'bg-black/80 text-gray-300 hover:bg-red-900/30'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
        <label className="block text-white text-xs font-medium mb-2">Vertical Offset</label>
        <input
          type="range"
          min="-100"
          max="100"
          value={subtitleStyle.verticalOffset}
          onChange={(e) => {
            const newStyle = {
              ...subtitleStyle,
              verticalOffset: parseInt(e.target.value)
            };
            onSubtitleStyleChange(newStyle);
            setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
          }}
          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Move Up</span>
          <span>{subtitleStyle.verticalOffset > 0 ? '+' : ''}{subtitleStyle.verticalOffset}px</span>
          <span>Move Down</span>
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Font Family</label>
        <div className="grid grid-cols-2 gap-2">
          {fontFamilies.map((font) => (
            <button
              key={font.value}
              onClick={() => {
                const newStyle = {
                  ...subtitleStyle,
                  fontFamily: font.value
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
              className={`p-2 rounded text-sm transition-colors ${
                subtitleStyle.fontFamily === font.value
                  ? 'bg-red-600 text-white'
                  : 'bg-black/80 text-gray-300 hover:bg-red-900/30'
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
              onClick={() => {
                const newStyle = {
                  ...subtitleStyle,
                  color: color.value
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
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
              onClick={() => {
                const newStyle = {
                  ...subtitleStyle,
                  backgroundColor: bg.value
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
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
            onChange={(e) => {
              const newStyle = {
                ...subtitleStyle,
                backgroundOpacity: parseFloat(e.target.value)
              };
              onSubtitleStyleChange(newStyle);
              setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
            }}
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Transparent</span>
            <span>{Math.round(subtitleStyle.backgroundOpacity * 100)}%</span>
            <span>Opaque</span>
          </div>
        </div>
      )}

      {/* Text Style */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Text Style</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.bold}
              onChange={(e) => {
                const newStyle = {
                  ...subtitleStyle,
                  bold: e.target.checked
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
              className="rounded"
            />
            <span className="text-white text-sm font-semibold">Bold</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.italic}
              onChange={(e) => {
                const newStyle = {
                  ...subtitleStyle,
                  italic: e.target.checked
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
              className="rounded"
            />
            <span className="text-white text-sm italic">Italic</span>
          </label>
        </div>
      </div>

      {/* Text Effects */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Text Effects</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.textShadow}
              onChange={(e) => {
                const newStyle = {
                  ...subtitleStyle,
                  textShadow: e.target.checked
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
              className="rounded"
            />
            <span className="text-white text-sm">Drop Shadow</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={subtitleStyle.textStroke}
              onChange={(e) => {
                const newStyle = {
                  ...subtitleStyle,
                  textStroke: e.target.checked
                };
                onSubtitleStyleChange(newStyle);
                setCookie('homeflix_subtitle_style', JSON.stringify(newStyle));
              }}
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
          onClick={() => {
            onPlaybackRateChange(rate);
            setCookie('homeflix_playback_rate', rate.toString());
          }}
          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
            playbackRate === rate 
              ? 'bg-red-600 border border-red-500' 
              : 'bg-black/80 hover:bg-red-900/30'
          }`}
        >
          <span className="text-white">{rate}x {rate === 1 ? '(Normal)' : ''}</span>
          {playbackRate === rate && <Check className="w-4 h-4 text-white" />}
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

  const renderVolumeBoostPanel = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActivePanel('main')}
          className="p-1 hover:bg-gray-700/50 rounded"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h3 className="text-lg font-semibold text-white">Volume Boost</h3>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-3 bg-black/80 rounded-lg">
        <div>
          <div className="text-white font-medium">Enable Volume Boost</div>
          <div className="text-gray-400 text-sm">Amplify audio with bass enhancement</div>
        </div>
        <button
          onClick={() => {
            const newEnabled = !volumeBoostEnabled;
            onVolumeBoostChange?.(newEnabled, volumeBoostLevel);
            // Save to cookie
            setCookie('homeflix_volume_boost', newEnabled.toString());
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            volumeBoostEnabled ? 'bg-red-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              volumeBoostEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Boost Level Slider */}
      {volumeBoostEnabled && (
        <div className="p-3 bg-black/80 rounded-lg">
          <label className="block text-white font-medium mb-3">Boost Level</label>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={volumeBoostLevel}
            onChange={(e) => {
              const newLevel = parseFloat(e.target.value);
              onVolumeBoostChange?.(true, newLevel);
              // Save to cookie
              setCookie('homeflix_volume_boost_level', newLevel.toString());
            }}
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between text-sm text-gray-400 mt-2">
            <span>100%</span>
            <span className="text-red-400 font-bold text-lg">{Math.round(volumeBoostLevel * 100)}%</span>
            <span>300%</span>
          </div>
          
          {/* Warning for high boost */}
          {volumeBoostLevel > 2.0 && (
            <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded text-yellow-400 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>High boost levels may cause audio distortion</span>
            </div>
          )}

          {/* Info */}
          <div className="mt-3 p-2 bg-red-900/10 border border-red-900/30 rounded text-gray-400 text-xs">
            <p>Volume boost combines gain amplification with bass enhancement for richer, louder audio.</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          
          {/* Settings Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              bottom: `${position.bottom}px`,
              right: `${position.right}px`,
              zIndex: 50
            }}
            className="bg-black/95 backdrop-blur-md rounded-lg border border-red-900/30 w-[380px] max-h-[70vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-red-900/30">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-white">Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-red-900/30 rounded transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-80px)] custom-scrollbar">
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
                  {activePanel === 'volumeBoost' && renderVolumeBoostPanel()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default VideoPlayerSettings;

// Add this to your global CSS or Tailwind config:
// .custom-scrollbar::-webkit-scrollbar { width: 8px; }
// .custom-scrollbar::-webkit-scrollbar-track { background: #1a1a1a; }
// .custom-scrollbar::-webkit-scrollbar-thumb { background: #dc2626; border-radius: 4px; }
// .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ef4444; }
