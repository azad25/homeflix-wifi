package models

import (
	"time"

	"gorm.io/gorm"
)

// Media represents a media file (movie or TV episode)
type Media struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
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
	Genres     []Genre  `json:"genres" gorm:"many2many:media_genres;"`
	GenreNames []string `json:"genre_names" gorm:"serializer:json"` // For JSON compatibility
	
	// Video info
	Resolution string `json:"resolution"`
	Codec      string `json:"codec"`
	Bitrate    int    `json:"bitrate"`
	
	// Thumbnails and previews
	ThumbnailPath   string `json:"thumbnail_path"`
	PreviewPath     string `json:"preview_path"`
	PreviewClipPath string `json:"preview_clip_path"` // Short video clip for hover preview
	PosterPath      string `json:"poster_path"`       // HD movie poster
	BannerPath      string `json:"banner_path"`       // HD banner for hero section
	TrailerPath     string `json:"trailer_path"`      // Trailer video file
	
	// Series info (for episodes)
	SeriesID      *uint   `json:"series_id,omitempty"`
	Series        *Series `json:"series,omitempty"`
	Season        *int    `json:"season,omitempty"`
	Episode       *int    `json:"episode,omitempty"`
	SeasonNumber  *int    `json:"season_number,omitempty"`
	EpisodeNumber *int    `json:"episode_number,omitempty"`
	
	// Subtitles
	Subtitles []Subtitle `json:"subtitles"`
	
	// View tracking
	ViewCount  int        `json:"view_count"`
	LastViewed *time.Time `json:"last_viewed,omitempty"`
	
	// Metadata tracking
	LastUpdated string `json:"last_updated"`
}

// Series represents a TV series
type Series struct {
	ID          uint           `json:"id" gorm:"primarykey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	
	Title       string    `json:"title" gorm:"not null"`
	Description string    `json:"description"`
	ReleaseDate time.Time `json:"release_date"`
	Rating      float32   `json:"rating"`
	Status      string    `json:"status"` // "ongoing", "completed", "cancelled"
	
	// Relationships
	Episodes []Media `json:"episodes" gorm:"foreignKey:SeriesID"`
	Genres   []Genre `json:"genres" gorm:"many2many:series_genres;"`
	
	// Metadata
	TotalSeasons int    `json:"total_seasons"`
	TotalEpisodes int   `json:"total_episodes"`
	PosterPath    string `json:"poster_path"`
	BackdropPath  string `json:"backdrop_path"`
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

