package models

import (
	"time"
	"gorm.io/gorm"
)

type TorrentDownload struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	TorrentID   string    `json:"torrent_id" gorm:"uniqueIndex;not null"`
	Name        string    `json:"name" gorm:"not null"`
	MagnetURI   string    `json:"magnet_uri" gorm:"not null"`
	Status      string    `json:"status" gorm:"default:'downloading'"` // downloading, completed, paused, error
	Progress    float64   `json:"progress" gorm:"default:0"`
	Size        int64     `json:"size" gorm:"default:0"`
	Downloaded  int64     `json:"downloaded" gorm:"default:0"`
	SavePath    string    `json:"save_path"`
	MediaType   string    `json:"media_type"` // movie, tv
	TMDBId      int       `json:"tmdb_id"`
	Quality     string    `json:"quality"`
	AddedAt     time.Time `json:"added_at" gorm:"autoCreateTime"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TorrentConfig struct {
	ID              uint   `json:"id" gorm:"primaryKey"`
	JackettURL      string `json:"jackett_url" gorm:"default:'http://localhost:9117'"`
	JackettAPIKey   string `json:"jackett_api_key"`
	DownloadPath    string `json:"download_path" gorm:"default:'~/Downloads/homeflix'"`
	MinSeeders      int    `json:"min_seeders" gorm:"default:10"`
	MaxDownloads    int    `json:"max_downloads" gorm:"default:5"`
	AutoDownload    bool   `json:"auto_download" gorm:"default:false"`
	PreferredQuality string `json:"preferred_quality" gorm:"default:'1080p'"`
	EnabledSources  string `json:"enabled_sources" gorm:"default:'1337x,YTS,TPB,RARBG'"` // Comma-separated list
	UseProxy        bool   `json:"use_proxy" gorm:"default:false"`
	ProxyURL        string `json:"proxy_url"`
	
	// Performance settings for high-speed downloads
	MaxPeerConnections int `json:"max_peer_connections" gorm:"default:500"`  // Max peers to connect to
	MaxPeerAccepts     int `json:"max_peer_accepts" gorm:"default:200"`      // Max incoming peer connections
	PortRangeStart     int `json:"port_range_start" gorm:"default:50000"`    // Starting port for torrent client
	PortRangeEnd       int `json:"port_range_end" gorm:"default:50100"`      // Ending port for torrent client
	MaxOpenFiles       int `json:"max_open_files" gorm:"default:1024"`       // Max open file handles
	
	// Speed Limits (in KB/s) - Note: Rain library doesn't support runtime speed limits
	// These are stored for future use or external bandwidth management
	DownloadSpeedLimit int64 `json:"download_speed_limit" gorm:"default:0"` // 0 = unlimited
	UploadSpeedLimit   int64 `json:"upload_speed_limit" gorm:"default:0"`   // 0 = unlimited

	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func MigrateTorrentTables(db *gorm.DB) error {
	return db.AutoMigrate(&TorrentDownload{}, &TorrentConfig{})
}