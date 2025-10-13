// HomeFlix gRPC Streaming Hooks
import { useEffect, useState, useCallback, useRef } from 'react';
import { createGrpcClient, grpcChannel } from '@/lib/grpc/client';

// Types for streaming
interface StreamingState {
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  progress: number;
  quality: string;
  buffering: boolean;
}

interface PreviewStreamingState extends StreamingState {
  previewUrl: string | null;
  isGenerating: boolean;
  generationProgress: number;
}

// Preview streaming hook
export function usePreviewStreaming(mediaUuid: string) {
  const [state, setState] = useState<PreviewStreamingState>({
    isLoading: false,
    isStreaming: false,
    error: null,
    progress: 0,
    quality: 'auto',
    buffering: false,
    previewUrl: null,
    isGenerating: false,
    generationProgress: 0,
  });

  const generatePreview = useCallback(async () => {
    if (!mediaUuid) return;

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      // For now, use HTTP fallback until gRPC client is fully implemented
      const response = await fetch(`/api/preview/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mediaUuid, 
          duration: 30,
          highPriority: true 
        }),
      });

      if (!response.ok) {
        throw new Error(`Preview generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        previewUrl: data.previewUrl || `/api/preview/${mediaUuid}`,
        generationProgress: 100,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Preview generation failed',
      }));
    }
  }, [mediaUuid]);

  const streamPreview = useCallback(async () => {
    if (!mediaUuid) return;

    setState(prev => ({ ...prev, isStreaming: true, error: null }));

    try {
      // Try to get existing preview first
      const previewUrl = `/api/preview/${mediaUuid}`;
      const response = await fetch(previewUrl, { method: 'HEAD' });
      
      if (response.ok) {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          previewUrl,
        }));
      } else {
        // Preview doesn't exist, generate it
        await generatePreview();
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Preview streaming failed',
      }));
    }
  }, [mediaUuid, generatePreview]);

  useEffect(() => {
    if (mediaUuid) {
      streamPreview();
    }
  }, [mediaUuid, streamPreview]);

  return {
    ...state,
    generatePreview,
    streamPreview,
    retry: streamPreview,
  };
}

// Main video streaming hook
export function useGRPCStreaming(mediaUuid: string, mediaType: 'movie' | 'episode' = 'movie') {
  const [state, setState] = useState<StreamingState>({
    isLoading: false,
    isStreaming: false,
    error: null,
    progress: 0,
    quality: 'auto',
    buffering: false,
  });

  const streamRef = useRef<ReadableStreamDefaultReader | null>(null);

  const startStream = useCallback(async (quality: string = 'auto') => {
    if (!mediaUuid) return;

    setState(prev => ({ ...prev, isLoading: true, error: null, quality }));

    try {
      // For now, use HTTP streaming until gRPC client is fully implemented
      const streamUrl = `/api/stream/${mediaType}/${mediaUuid}?quality=${quality}`;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: true,
        buffering: false,
      }));

      return streamUrl;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Streaming failed',
      }));
    }
  }, [mediaUuid, mediaType]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.cancel();
      streamRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
      buffering: false,
    }));
  }, []);

  const changeQuality = useCallback((newQuality: string) => {
    setState(prev => ({ ...prev, quality: newQuality }));
    if (state.isStreaming) {
      stopStream();
      startStream(newQuality);
    }
  }, [state.isStreaming, startStream, stopStream]);

  return {
    ...state,
    startStream,
    stopStream,
    changeQuality,
    streamUrl: state.isStreaming ? `/api/stream/${mediaType}/${mediaUuid}?quality=${state.quality}` : null,
  };
}

// Playback control hook
export function usePlaybackControl(sessionId: string) {
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    quality: 'auto',
  });

  const sendCommand = useCallback(async (command: string, params: Record<string, any> = {}) => {
    try {
      // For now, use HTTP API until gRPC client is fully implemented
      await fetch('/api/playback/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          command,
          ...params,
        }),
      });
    } catch (error) {
      console.error('Playback command failed:', error);
    }
  }, [sessionId]);

  const play = useCallback(() => {
    setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    sendCommand('play');
  }, [sendCommand]);

  const pause = useCallback(() => {
    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    sendCommand('pause');
  }, [sendCommand]);

  const seek = useCallback((time: number) => {
    setPlaybackState(prev => ({ ...prev, currentTime: time }));
    sendCommand('seek', { seekTo: time });
  }, [sendCommand]);

  const setVolume = useCallback((volume: number) => {
    setPlaybackState(prev => ({ ...prev, volume }));
    sendCommand('volume', { volume });
  }, [sendCommand]);

  const toggleMute = useCallback(() => {
    setPlaybackState(prev => ({ ...prev, muted: !prev.muted }));
    sendCommand('mute', { muted: !playbackState.muted });
  }, [sendCommand, playbackState.muted]);

  return {
    ...playbackState,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    sendCommand,
  };
}

// Real-time recommendations hook
export function useRecommendations(userId: string, category: string = 'trending') {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // For now, use HTTP API until gRPC client is fully implemented
      const response = await fetch(`/api/recommendations?userId=${userId}&category=${category}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }, [userId, category]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refresh: fetchRecommendations,
  };
}

// Connection health check hook
export function useGRPCHealth() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      // Simple health check - try to connect to gRPC-Web proxy on port 8253
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('http://localhost:8253/health', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setIsConnected(response.ok);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkConnection]);

  return {
    isConnected,
    isChecking,
    checkConnection,
  };
}