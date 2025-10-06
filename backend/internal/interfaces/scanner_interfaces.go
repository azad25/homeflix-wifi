package interfaces

import (
	"os"
	"time"

	"homeflix-backend/internal/models"
)

// MediaMetadata represents metadata for media files
type MediaMetadata struct {
	Title       string   `json:"title"`
	Tagline     string   `json:"tagline"`
	ShortDesc   string   `json:"short_desc"`
	LongDesc    string   `json:"long_desc"`
	Description string   `json:"description"`
	Year        int      `json:"year"`
	Stars       []string `json:"stars"`
	Directors   []string `json:"directors"`
	Country     string   `json:"country"`
	Language    string   `json:"language"`
	Quality     string   `json:"quality"`
	Genres      []string `json:"genres"`
	Rating      float64  `json:"rating"`
	PosterURL   string   `json:"poster_url"`
	BackdropURL string   `json:"backdrop_url"`
	Runtime     int      `json:"runtime"`
	Budget      int64    `json:"budget"`
	Revenue     int64    `json:"revenue"`
	BoxOffice   string   `json:"box_office"`
	Cast        []string `json:"cast"`
	// Enhanced metadata fields
	Status      string   `json:"status"`
	IMDBID      string   `json:"imdb_id"`
	Homepage    string   `json:"homepage"`
	Collection  string   `json:"collection"`
	Crew        []string `json:"crew"`
	Writers     []string `json:"writers"`
	Producers   []string `json:"producers"`
	// Additional fields
	Popularity  float64  `json:"popularity"`
	VoteCount   int      `json:"vote_count"`
	Adult       bool     `json:"adult"`
	Awards      []string `json:"awards"`
	Certification string `json:"certification"`
}

// JobStatus represents the status of a processing job
type JobStatus struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Progress  float64   `json:"progress"`
	StartTime time.Time `json:"start_time"`
	Error     error     `json:"error,omitempty"`
}

// MediaServiceInterface defines the interface for media operations
type MediaServiceInterface interface {
	GetMediaByPath(path string) (*models.Media, error)
	GetAllMedia() ([]models.Media, error)
	MediaExists(path string) (bool, error)
	CreateMedia(media *models.Media) error
	UpdateMedia(media *models.Media) error
	DeleteMedia(id uint) error
	FindOrCreateSeries(title string) (*models.Series, error)
	GetGenreIDsByNames(genreNames []string) ([]uint, error)
	AssignGenresToMedia(mediaID uint, genreIDs []uint) error
	CreateSubtitle(subtitle *models.Subtitle) error
	SearchMedia(query string) ([]models.Media, error)
}

// ThumbnailServiceInterface defines the interface for thumbnail operations
type ThumbnailServiceInterface interface {
	GenerateThumbnail(path string, mediaID uint, title string) (string, error)
	GeneratePreviewClip(path string, mediaID uint, title string) (string, error)
	GenerateThumbnailAsync(path string, mediaID uint, title string) (string, error)
	GeneratePreviewClipAsync(path string, mediaID uint, title string) (string, error)
	ThumbnailExists(mediaID uint, title string) bool
	PreviewExists(mediaID uint, title string) bool
	GetThumbnailPath(mediaID uint, title string) string
	GetPreviewPath(mediaID uint, title string) string
	GetWorkerPoolStats() map[string]interface{}
	GetJobStatus(jobID string) (*JobStatus, bool)
	GetActiveJobs() map[string]*JobStatus
	IsQueueHealthy() bool
	Shutdown()
}

// PosterServiceInterface defines the interface for poster operations
type PosterServiceInterface interface {
	DownloadPoster(title string, mediaID uint) error
	GetPosterPath(mediaID uint, title string) string
}

// GeminiServiceInterface defines the interface for AI metadata operations
type GeminiServiceInterface interface {
	GenerateMediaMetadata(path, title string) (*MediaMetadata, error)
}

// CeleryServiceInterface defines the interface for task queue operations
type CeleryServiceInterface interface {
	QueueThumbnailGeneration(mediaID uint, path string) error
	QueuePreviewGeneration(mediaID uint, path string) error
}

// ALACAudioServiceInterface defines the interface for ALAC audio operations
type ALACAudioServiceInterface interface {
	ExtractALACAudio(path string, mediaID int) (string, error)
	AutoExtractALACForMedia(videoPath string, mediaID int)
	ManualExtractALAC(videoPath string, mediaID int) (string, error)
	SetBatchMode(enabled bool)
	GetAudioPath(mediaID int) string
	CleanupOversizedFiles() error
}

// TMDBServiceInterface defines the interface for TMDB operations
type TMDBServiceInterface interface {
	GenerateMediaMetadata(path, title string) (*MediaMetadata, error)
	CleanTitle(title string) string
}

// RecommendationServiceInterface defines the interface for recommendation operations
type RecommendationServiceInterface interface {
	RefreshRecommendations() error
}

// MediaProcessorInterface defines the interface for processing media files
type MediaProcessorInterface interface {
	ProcessSingleFile(path string, info os.FileInfo) error
}
