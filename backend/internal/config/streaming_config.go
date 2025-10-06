package config

import (
	"runtime"
	"time"
)

// StreamingConfig holds ultra-fast streaming configuration
type StreamingConfig struct {
	// Core streaming settings
	ChunkSize         int64         `json:"chunk_size"`
	MaxBufferSize     int64         `json:"max_buffer_size"`
	CacheSize         int           `json:"cache_size"`
	MaxWorkers        int           `json:"max_workers"`
	
	// Performance settings
	PreloadChunks     int           `json:"preload_chunks"`
	CacheTimeout      time.Duration `json:"cache_timeout"`
	FlushInterval     time.Duration `json:"flush_interval"`
	
	// Quality settings
	DefaultQuality    string        `json:"default_quality"`
	MaxQuality        string        `json:"max_quality"`
	AdaptiveStreaming bool          `json:"adaptive_streaming"`
	
	// Network optimization
	LocalNetworkBoost bool          `json:"local_network_boost"`
	BandwidthDetection bool         `json:"bandwidth_detection"`
	
	// Device optimization
	HardwareAcceleration bool       `json:"hardware_acceleration"`
	DeviceSpecificOptimization bool `json:"device_specific_optimization"`
}

// GetOptimalStreamingConfig returns the optimal streaming configuration
func GetOptimalStreamingConfig() *StreamingConfig {
	return &StreamingConfig{
		// Ultra-fast core settings
		ChunkSize:         2 * 1024 * 1024, // 2MB chunks for ultra-fast streaming
		MaxBufferSize:     128 * 1024 * 1024, // 128MB max buffer
		CacheSize:         1000, // Cache up to 1000 entries
		MaxWorkers:        runtime.NumCPU() * 16, // 16x CPU cores
		
		// Performance optimization
		PreloadChunks:     8, // Preload first 8 chunks (16MB)
		CacheTimeout:      2 * time.Hour, // 2 hour cache timeout
		FlushInterval:     10 * time.Millisecond, // Ultra-low latency flushing
		
		// Quality settings
		DefaultQuality:    "high",
		MaxQuality:        "4k-ultra",
		AdaptiveStreaming: true,
		
		// Network optimization
		LocalNetworkBoost: true,
		BandwidthDetection: true,
		
		// Device optimization
		HardwareAcceleration: true,
		DeviceSpecificOptimization: true,
	}
}

// GetPreviewStreamingConfig returns optimized config for preview clips
func GetPreviewStreamingConfig() *StreamingConfig {
	config := GetOptimalStreamingConfig()
	
	// Preview-specific optimizations
	config.ChunkSize = 256 * 1024 // 256KB chunks for instant startup
	config.PreloadChunks = 4 // Preload first 4 chunks (1MB)
	config.FlushInterval = 5 * time.Millisecond // Even lower latency for previews
	config.DefaultQuality = "medium" // Medium quality for instant loading
	config.CacheTimeout = 4 * time.Hour // Longer cache for previews
	
	return config
}

// QualitySettings defines video quality parameters
type QualitySettings struct {
	Name        string `json:"name"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	Bitrate     string `json:"bitrate"`
	BufferSize  int64  `json:"buffer_size"`
	ChunkSize   int64  `json:"chunk_size"`
}

// GetQualitySettings returns quality settings for different levels
func GetQualitySettings() map[string]*QualitySettings {
	return map[string]*QualitySettings{
		"4k-ultra": {
			Name:       "4K Ultra",
			Width:      3840,
			Height:     2160,
			Bitrate:    "25000k",
			BufferSize: 64 * 1024 * 1024, // 64MB buffer
			ChunkSize:  4 * 1024 * 1024,   // 4MB chunks
		},
		"4k": {
			Name:       "4K",
			Width:      3840,
			Height:     2160,
			Bitrate:    "15000k",
			BufferSize: 32 * 1024 * 1024, // 32MB buffer
			ChunkSize:  2 * 1024 * 1024,   // 2MB chunks
		},
		"high": {
			Name:       "1080p High",
			Width:      1920,
			Height:     1080,
			Bitrate:    "8000k",
			BufferSize: 16 * 1024 * 1024, // 16MB buffer
			ChunkSize:  1 * 1024 * 1024,   // 1MB chunks
		},
		"medium": {
			Name:       "720p",
			Width:      1280,
			Height:     720,
			Bitrate:    "4000k",
			BufferSize: 8 * 1024 * 1024,  // 8MB buffer
			ChunkSize:  512 * 1024,       // 512KB chunks
		},
		"low": {
			Name:       "480p",
			Width:      854,
			Height:     480,
			Bitrate:    "2000k",
			BufferSize: 4 * 1024 * 1024,  // 4MB buffer
			ChunkSize:  256 * 1024,       // 256KB chunks
		},
	}
}

// DeviceOptimization defines device-specific optimizations
type DeviceOptimization struct {
	UserAgentPattern string        `json:"user_agent_pattern"`
	PreferredFormat  string        `json:"preferred_format"`
	MaxQuality       string        `json:"max_quality"`
	BufferMultiplier float64       `json:"buffer_multiplier"`
	ChunkMultiplier  float64       `json:"chunk_multiplier"`
	HardwareAccel    string        `json:"hardware_accel"`
	FlushInterval    time.Duration `json:"flush_interval"`
}

// GetDeviceOptimizations returns device-specific optimizations
func GetDeviceOptimizations() map[string]*DeviceOptimization {
	return map[string]*DeviceOptimization{
		"mac": {
			UserAgentPattern: "mac",
			PreferredFormat:  "mp4",
			MaxQuality:       "4k-ultra",
			BufferMultiplier: 2.0,
			ChunkMultiplier:  2.0,
			HardwareAccel:    "videotoolbox",
			FlushInterval:    5 * time.Millisecond,
		},
		"windows": {
			UserAgentPattern: "windows",
			PreferredFormat:  "mp4",
			MaxQuality:       "4k",
			BufferMultiplier: 1.5,
			ChunkMultiplier:  1.5,
			HardwareAccel:    "dxva",
			FlushInterval:    10 * time.Millisecond,
		},
		"linux": {
			UserAgentPattern: "linux",
			PreferredFormat:  "webm",
			MaxQuality:       "4k",
			BufferMultiplier: 1.5,
			ChunkMultiplier:  1.5,
			HardwareAccel:    "vaapi",
			FlushInterval:    10 * time.Millisecond,
		},
		"ios": {
			UserAgentPattern: "iphone|ipad",
			PreferredFormat:  "mp4",
			MaxQuality:       "high",
			BufferMultiplier: 1.0,
			ChunkMultiplier:  0.5,
			HardwareAccel:    "metal",
			FlushInterval:    15 * time.Millisecond,
		},
		"android": {
			UserAgentPattern: "android",
			PreferredFormat:  "mp4",
			MaxQuality:       "high",
			BufferMultiplier: 0.8,
			ChunkMultiplier:  0.5,
			HardwareAccel:    "mediacodec",
			FlushInterval:    20 * time.Millisecond,
		},
		"mobile": {
			UserAgentPattern: "mobile",
			PreferredFormat:  "mp4",
			MaxQuality:       "medium",
			BufferMultiplier: 0.5,
			ChunkMultiplier:  0.25,
			HardwareAccel:    "auto",
			FlushInterval:    25 * time.Millisecond,
		},
	}
}