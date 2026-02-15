package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Media represents a media file (movie or TV episode)
type Media struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	// UUID field for API compatibility
	UUID string `json:"uuid" gorm:"unique"`
	
	// Basic info - matching media.json structure
	Title         string `json:"title" gorm:"not null"`
	OriginalTitle string `json:"original_title"`
	Type          string `json:"type" gorm:"not null"` // "movie" or "episode"
	FilePath      string `json:"file_path" gorm:"unique;not null"`
	FileSize      int64  `json:"file_size"`
	Duration      int    `json:"duration"` // in seconds
	
	// Metadata - matching media.json structure
	Tagline     string    `json:"tagline"`
	ShortDesc   string    `json:"short_desc"`
	LongDesc    string    `json:"long_desc"`
	Description string    `json:"description"`
	Year        int       `json:"year,omitempty"`
	ReleaseDate time.Time `json:"release_date"`
	Rating      float64   `json:"rating"`
	Country     string    `json:"country"`
	Language    string    `json:"language"`
	Quality     string    `json:"quality"` // HD, 4K, SD, HDR
	
	// Cast and crew - matching media.json structure
	Stars     []string `json:"stars" gorm:"serializer:json"`
	Director  []string `json:"director" gorm:"serializer:json"`
	Cast      []string `json:"cast" gorm:"serializer:json"`      // Full cast list
	Writers   []string `json:"writers" gorm:"serializer:json"`   // Writers/Screenplay
	Producers []string `json:"producers" gorm:"serializer:json"` // Producers
	
	// Box office and additional metadata
	Budget     int64  `json:"budget"`      // Production budget
	Revenue    int64  `json:"revenue"`     // Box office revenue
	BoxOffice  string `json:"box_office"`  // Formatted box office string
	Status     string `json:"status"`      // Released, Post Production, etc.
	IMDBID     string `json:"imdb_id"`     // IMDB identifier
	Homepage   string `json:"homepage"`    // Official website
	Collection string `json:"collection"`  // Movie collection/franchise
	
	// Enhanced metadata
	Awards       []string `json:"awards" gorm:"serializer:json"`       // Awards and nominations
	Certification string  `json:"certification"`                       // Rating (PG, PG-13, R, etc.)
	Runtime      int      `json:"runtime"`                             // Runtime in minutes
	Popularity   float64  `json:"popularity"`                          // TMDB popularity score
	VoteCount    int      `json:"vote_count"`                          // Number of votes
	Adult        bool     `json:"adult"`                               // Adult content flag
	
	// Genres - keeping both relationship and JSON for flexibility
	Genres     []Genre  `json:"genres" gorm:"many2many:media_genres;"` // Include in JSON for frontend
	GenreNames []string `json:"genre_names" gorm:"serializer:json"` // For JSON compatibility
	
	// Video info
	Resolution string `json:"resolution"`
	Codec      string `json:"codec"`
	Bitrate    int    `json:"bitrate"`
	
	// Quality tags extracted from filename (HDR, Dolby, UHD, etc.)
	QualityTags []string `json:"quality_tags" gorm:"serializer:json"`
	
	// Thumbnails and previews
	ThumbnailPath   string `json:"thumbnail_path"`
	PreviewPath     string `json:"preview_path"`
	PreviewClipPath string `json:"preview_clip_path"` // Short video clip for hover preview
	PosterPath      string `json:"poster_path"`       // HD movie poster
	BannerPath      string `json:"banner_path"`       // HD banner for hero section
	BackdropPath    string `json:"backdrop_path"`     // Local path to backdrop image
	TrailerPath     string `json:"trailer_path"`      // Trailer video file
	
	// TMDB Integration fields for local media
	TMDBBackdropURL string `json:"tmdb_backdrop_url"` // TMDB backdrop image URL
	TMDBTrailerURL  string `json:"tmdb_trailer_url"`  // TMDB trailer video URL
	TMDBID          int    `json:"tmdb_id"`           // TMDB movie/TV ID for reference
	LogoPath        string `json:"logo_path"`         // Local path to movie logo image
	
	// Series info (for episodes)
	SeriesID      *uint   `json:"series_id,omitempty"`
	Series        *Series `json:"-" gorm:"foreignKey:SeriesID"` // Exclude from JSON to prevent circular references
	SeasonID      *uint   `json:"season_id,omitempty"`
	SeasonRef     *Season `json:"-" gorm:"foreignKey:SeasonID"` // Exclude from JSON to prevent circular references
	Season        *int    `json:"season_number_legacy,omitempty"`
	Episode       *int    `json:"episode,omitempty"`
	SeasonNumber  *int    `json:"season_number,omitempty"`
	EpisodeNumber *int    `json:"episode_number,omitempty"`
	
	// Episode-specific metadata from TMDB
	EpisodeTitle     string   `json:"episode_title,omitempty"`      // Episode name/title
	EpisodeStillPath string   `json:"episode_still_path,omitempty"` // Episode thumbnail/still
	GuestStars       []string `json:"guest_stars,omitempty" gorm:"serializer:json"` // Guest stars for this episode
	
	// Subtitles
	Subtitles []Subtitle `json:"-"` // Exclude from JSON to prevent object rendering errors
	
	// View tracking
	ViewCount  int        `json:"view_count"`
	LastViewed *time.Time `json:"last_viewed,omitempty"`
	
	// Metadata tracking
	LastUpdated string `json:"last_updated"`
}

// BeforeCreate hook to generate UUID for Media
func (m *Media) BeforeCreate(tx *gorm.DB) error {
	if m.UUID == "" {
		m.UUID = uuid.New().String()
	}
	return nil
}

// AfterFind hook to populate GenreNames from Genres relationship
func (m *Media) AfterFind(tx *gorm.DB) error {
	if len(m.Genres) > 0 {
		m.GenreNames = make([]string, len(m.Genres))
		for i, genre := range m.Genres {
			m.GenreNames[i] = genre.Name
		}
	}
	return nil
}

// Series represents a TV series
type Series struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	UUID        string         `json:"uuid" gorm:"unique"`
	
	Title       string    `json:"title" gorm:"not null"`
	Description string    `json:"description"`
	Tagline     string    `json:"tagline"`
	ReleaseDate time.Time `json:"release_date"`
	Year        int       `json:"year"`
	Rating      float32   `json:"rating"`
	Status      string    `json:"status"` // "ongoing", "completed", "cancelled"
	Country     string    `json:"country"`
	Language    string    `json:"language"`
	Network     string    `json:"network"` // Original network/channel
	Quality     string    `json:"quality"` // HD, 4K, etc.
	Certification string  `json:"certification"` // TV-G, TV-PG, TV-14, TV-MA, etc.
	
	// Relationships
	Episodes []Media  `json:"-" gorm:"foreignKey:SeriesID"` // Exclude from JSON to prevent circular references
	Seasons  []Season `json:"-" gorm:"foreignKey:SeriesID"` // Exclude from JSON to prevent circular references
	Genres   []Genre  `json:"-" gorm:"many2many:series_genres;"` // Exclude from JSON to prevent object rendering errors
	GenreNames []string `json:"genre_names" gorm:"serializer:json"` // For JSON compatibility
	
	// Metadata
	TotalSeasons int    `json:"total_seasons"`
	TotalEpisodes int   `json:"total_episodes"`
	PosterPath    string `json:"poster_path"`
	BackdropPath  string `json:"backdrop_path"`
	TrailerURL    string `json:"trailer_url"` // Local or YouTube trailer URL
	
	// TMDB Integration fields
	TMDBBackdropURL string `json:"tmdb_backdrop_url"` // TMDB backdrop image URL
	TMDBPosterURL   string `json:"tmdb_poster_url"`   // TMDB poster image URL
	TMDBTrailerURL  string `json:"tmdb_trailer_url"`  // TMDB YouTube trailer URL
	LogoPath        string `json:"logo_path"`         // Local path to TV series logo image
	TMDBID          int    `json:"tmdb_id"`           // TMDB TV series ID for reference
}

// AfterFind hook to populate GenreNames from Genres relationship
func (s *Series) AfterFind(tx *gorm.DB) error {
	if len(s.Genres) > 0 {
		s.GenreNames = make([]string, len(s.Genres))
		for i, genre := range s.Genres {
			s.GenreNames[i] = genre.Name
		}
	}
	return nil
}

// Season represents a season within a TV series
type Season struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	SeriesID     uint      `json:"series_id" gorm:"not null"`
	Series       *Series   `json:"series,omitempty"`
	SeasonNumber int       `json:"season_number" gorm:"not null"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Overview     string    `json:"overview"`      // TMDB overview
	ReleaseDate  time.Time `json:"release_date"`
	AirDate      string    `json:"air_date"`      // TMDB air date string
	PosterPath   string    `json:"poster_path"`
	
	// Relationships
	Episodes []Media `json:"episodes" gorm:"foreignKey:SeasonID"`
	
	// Metadata
	EpisodeCount int `json:"episode_count"`
	TMDBID       int `json:"tmdb_id"` // TMDB season ID
}

// BeforeCreate hook to generate UUID for Series
func (s *Series) BeforeCreate(tx *gorm.DB) error {
	if s.UUID == "" {
		s.UUID = uuid.New().String()
	}
	return nil
}

// Genre represents a media genre
type Genre struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	Name        string `json:"name" gorm:"unique;not null"`
	Description string `json:"description"`
}

// Subtitle represents subtitle files
type Subtitle struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	MediaID  uint   `json:"media_id"`
	Language string `json:"language"`
	FilePath string `json:"file_path"`
	Format   string `json:"format"` // "srt", "vtt", "ass", etc.
}

// User represents a user profile
type User struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	Username string `json:"username" gorm:"unique;not null"`
	Email    string `json:"email" gorm:"unique"`
	Avatar   string `json:"avatar"`
	
	// Preferences
	PreferredLanguage string `json:"preferred_language"`
	PreferredQuality  string `json:"preferred_quality"`
	
	// Relationships
	Watchlist []WatchlistItem `json:"watchlist"`
	ViewHistory []ViewHistory `json:"view_history"`
}

// WatchlistItem represents items in a user's watchlist
type WatchlistItem struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	UserID  uint  `json:"user_id"`
	MediaID uint  `json:"media_id"`
	Media   Media `json:"media"`
}

// ViewHistory tracks user viewing history
type ViewHistory struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	UserID     uint  `json:"user_id"`
	MediaID    uint  `json:"media_id"`
	Media      Media `json:"media"`
	Progress   int   `json:"progress"` // in seconds
	Completed  bool  `json:"completed"`
	WatchedAt  time.Time `json:"watched_at"`
}

// UserRating represents user ratings for media
type UserRating struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	UserID  uint    `json:"user_id"`
	MediaID uint    `json:"media_id"`
	Media   Media   `json:"media"`
	Rating  float32 `json:"rating" gorm:"check:rating >= 0 AND rating <= 10"` // 0-10 scale
	Review  string  `json:"review"`
}

// MediaPath represents a media directory that HomeFlix should scan
type MediaPath struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	Path        string `json:"path" gorm:"unique;not null"`
	Name        string `json:"name" gorm:"not null"`        // User-friendly name
	Description string `json:"description"`                 // Optional description
	PathType    string `json:"path_type" gorm:"not null"`   // "primary", "torrent", "external"
	IsActive    bool   `json:"is_active" gorm:"default:true"` // Whether to scan this path
	Priority    int    `json:"priority" gorm:"default:0"`   // Scan priority (higher = first)
}

// Recommendation represents AI-generated recommendations
type Recommendation struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	
	UserID      uint    `json:"user_id"`
	MediaID     uint    `json:"media_id"`
	Media       Media   `json:"media"`
	Score       float32 `json:"score"`       // recommendation confidence score
	Reason      string  `json:"reason"`      // why this was recommended
	Category    string  `json:"category"`    // "trending", "similar", "genre_match", "continue_watching"
	Clicked     bool    `json:"clicked"`     // track if user clicked on recommendation
	ClickedAt   *time.Time `json:"clicked_at,omitempty"`
}

// SubtitleTrack represents subtitle tracks (internal and external)
type SubtitleTrack struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	MediaID     uint   `json:"media_id" gorm:"not null"`
	StreamIndex int    `json:"stream_index"` // For internal tracks
	Language    string `json:"language" gorm:"not null"`
	Title       string `json:"title"`
	CodecName   string `json:"codec_name"`   // "subrip", "ass", "webvtt", etc.
	FilePath    string `json:"file_path"`    // For external subtitle files
	Format      string `json:"format"`       // "srt", "vtt", "ass", etc.
	TrackType   string `json:"track_type"`   // "internal" or "external"
	IsDefault   bool   `json:"is_default"`
	IsForced    bool   `json:"is_forced"`
	IsHearing   bool   `json:"is_hearing_impaired"`
}

// AudioTrack represents audio tracks in media files
type AudioTrack struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	MediaID     uint   `json:"media_id" gorm:"not null"`
	StreamIndex int    `json:"stream_index" gorm:"not null"`
	Language    string `json:"language" gorm:"not null"`
	Title       string `json:"title"`
	CodecName   string `json:"codec_name"`   // "aac", "ac3", "dts", etc.
	Channels    int    `json:"channels"`     // Number of audio channels
	SampleRate  int    `json:"sample_rate"`  // Sample rate in Hz
	Bitrate     int    `json:"bitrate"`      // Bitrate in bps
	TrackType   string `json:"track_type"`   // "internal" (always for audio)
	IsDefault   bool   `json:"is_default"`
}

