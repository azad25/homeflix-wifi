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
	TrailerURL  string   `json:"trailer_url"`
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
	TMDBID      int      `json:"tmdb_id"`
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
	GetSeriesByID(seriesID uint) (*models.Series, error)
	MediaExists(path string) (bool, error)
	CreateMedia(media *models.Media) error
	UpdateMedia(media *models.Media) error
	UpdateSeries(id uint, updates map[string]interface{}) (*models.Series, error)
	UpsertMedia(media *models.Media) error
	DeleteMedia(id uint) error
	FindOrCreateSeries(title string) (*models.Series, error)
	GetGenreIDsByNames(genreNames []string) ([]uint, error)
	AssignGenresToMedia(mediaID uint, genreIDs []uint) error
	CreateSubtitle(subtitle *models.Subtitle) error
	SearchMedia(query string) ([]models.Media, error)
	SaveSubtitleTracks(mediaID uint, tracks []models.SubtitleTrack) error
	SaveAudioTracks(mediaID uint, tracks []models.AudioTrack) error
	GetSubtitleTracks(mediaID uint) ([]models.SubtitleTrack, error)
	GetAudioTracks(mediaID uint) ([]models.AudioTrack, error)
	CreateSubtitleTrack(track *models.SubtitleTrack) error
	CreateAudioTrack(track *models.AudioTrack) error
}

// ThumbnailServiceInterface defines the interface for thumbnail operations
type ThumbnailServiceInterface interface {
	GenerateThumbnail(path string, mediaID uint, title string) (string, error)
	GeneratePreviewClip(path string, mediaID uint, title string) (string, error)
	GeneratePreviewClipWithEpisodeInfo(path string, mediaID uint, title string, season *int, episode *int) (string, error)
	GenerateThumbnailAsync(path string, mediaID uint, title string) (string, error)
	GeneratePreviewClipAsync(path string, mediaID uint, title string) (string, error)
	RegenerateThumbnailAsync(path string, mediaID uint, title string) (string, error)
	RegeneratePreviewClipAsync(path string, mediaID uint, title string) (string, error)
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
	DownloadPosterWithPath(title string, mediaID uint) (string, error)
	DownloadTVPosterWithPath(title string, seriesID uint) (string, error)
	GetPosterPath(mediaID uint, title string) string
	SetTMDBService(tmdbService TMDBServiceInterface)
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
	RemoveYearFromTitle(title string) string
	DownloadPoster(title string, mediaID uint, posterDir string) (string, error)
	DownloadTVPoster(title string, seriesID uint, posterDir string) (string, error)
	DownloadMovieLogo(tmdbID int, mediaID uint, logoDir string) (string, error)
	DownloadLogoByTitle(title string, mediaID uint, logoDir string) (string, error)
	DownloadMovieBackdrop(tmdbID int, mediaID uint, backdropDir string) (string, error)
	DownloadBackdropByTitle(title string, mediaID uint, backdropDir string) (string, error)
	DownloadTVLogo(tmdbID int, seriesID uint, seriesTitle, logoDir string) (string, error)
	DownloadTVLogoByTitle(title string, seriesID uint, logoDir string) (string, error)
	DownloadTVBackdrop(tmdbID int, seriesID uint, seriesTitle, backdropDir string) (string, error)
	DownloadTVBackdropByTitle(title string, seriesID uint, backdropDir string) (string, error)
	GetPosterURL(posterPath string, size string) string
	TestConnection() error
	// Episode-specific methods
	GetSeasonDetails(tvID int, seasonNumber int) (*TMDBSeason, error)
	GetEpisodeDetails(tvID int, seasonNumber int, episodeNumber int) (*TMDBEpisode, error)
	DownloadEpisodeStill(stillPath string, tvID int, seasonNumber int, episodeNumber int, stillDir string) (string, error)
}

// TMDBCrew represents crew member information from TMDB
type TMDBCrew struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Job         string `json:"job"`
	Department  string `json:"department"`
	ProfilePath string `json:"profile_path"`
}

// TMDBCast represents cast member information from TMDB
type TMDBCast struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Character   string `json:"character"`
	Order       int    `json:"order"`
	ProfilePath string `json:"profile_path"`
}

// TMDBSeason represents a TV season with episodes from TMDB
type TMDBSeason struct {
	ID           int           `json:"id"`
	Name         string        `json:"name"`
	Overview     string        `json:"overview"`
	PosterPath   string        `json:"poster_path"`
	SeasonNumber int           `json:"season_number"`
	EpisodeCount int           `json:"episode_count"`
	AirDate      string        `json:"air_date"`
	Episodes     []TMDBEpisode `json:"episodes,omitempty"`
}

// TMDBEpisode represents a TV episode with all details from TMDB
type TMDBEpisode struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	Overview       string     `json:"overview"`
	EpisodeNumber  int        `json:"episode_number"`
	SeasonNumber   int        `json:"season_number"`
	StillPath      string     `json:"still_path"`
	AirDate        string     `json:"air_date"`
	Runtime        int        `json:"runtime"`
	VoteAverage    float64    `json:"vote_average"`
	VoteCount      int        `json:"vote_count"`
	Crew           []TMDBCrew `json:"crew"`
	GuestStars     []TMDBCast `json:"guest_stars"`
	ShowID         int        `json:"show_id"`
	ProductionCode string     `json:"production_code"`
	EpisodeType    string     `json:"episode_type"`
}

// RecommendationServiceInterface defines the interface for recommendation operations
type RecommendationServiceInterface interface {
	RefreshRecommendations() error
}

// NotificationServiceInterface defines the interface for notification operations
type NotificationServiceInterface interface {
	CreateNewMoviesNotification(movieIDs []uint, count int) error
	CreateNewEpisodesNotification(seriesID uint, seriesName string, episodeIDs []uint, episodeCount int) error
	CreateDownloadCompleteNotification(title string, mediaID uint) error
}

// MediaProcessorInterface defines the interface for processing media files
type MediaProcessorInterface interface {
	ProcessSingleFile(path string, info os.FileInfo) error
}
