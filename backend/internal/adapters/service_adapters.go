package adapters

import (
	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// GeminiServiceAdapter adapts services.GeminiService to interfaces.GeminiServiceInterface
type GeminiServiceAdapter struct {
	service *services.GeminiService
}

func NewGeminiServiceAdapter(service *services.GeminiService) *GeminiServiceAdapter {
	return &GeminiServiceAdapter{service: service}
}

func (a *GeminiServiceAdapter) GenerateMediaMetadata(path, title string) (*interfaces.MediaMetadata, error) {
	metadata, err := a.service.GenerateMediaMetadata(path, title)
	if err != nil {
		return nil, err
	}
	
	// Convert services.MediaMetadata to interfaces.MediaMetadata
	return &interfaces.MediaMetadata{
		Title:       metadata.Title,
		Tagline:     metadata.Tagline,
		ShortDesc:   metadata.ShortDesc,
		LongDesc:    metadata.LongDesc,
		Description: metadata.Description,
		Year:        metadata.Year,
		Stars:       metadata.Stars,
		Directors:   metadata.Directors,
		Country:     metadata.Country,
		Language:    metadata.Language,
		Quality:     metadata.Quality,
		Genres:      metadata.Genres,
		Rating:      metadata.Rating,
		PosterURL:   metadata.PosterURL,
		BackdropURL: metadata.BackdropURL,
		Runtime:     metadata.Runtime,
		Budget:      metadata.Budget,
		Revenue:     metadata.Revenue,
		BoxOffice:   metadata.BoxOffice,
		Cast:        metadata.Cast,
	}, nil
}

// TMDBServiceAdapter adapts services.TMDBService to interfaces.TMDBServiceInterface
type TMDBServiceAdapter struct {
	service *services.TMDBService
}

func NewTMDBServiceAdapter(service *services.TMDBService) *TMDBServiceAdapter {
	return &TMDBServiceAdapter{service: service}
}

func (a *TMDBServiceAdapter) GenerateMediaMetadata(path, title string) (*interfaces.MediaMetadata, error) {
	metadata, err := a.service.GenerateMediaMetadata(path, title)
	if err != nil {
		return nil, err
	}
	
	// Convert services.MediaMetadata to interfaces.MediaMetadata
	return &interfaces.MediaMetadata{
		Title:       metadata.Title,
		Tagline:     metadata.Tagline,
		ShortDesc:   metadata.ShortDesc,
		LongDesc:    metadata.LongDesc,
		Description: metadata.Description,
		Year:        metadata.Year,
		Stars:       metadata.Stars,
		Directors:   metadata.Directors,
		Country:     metadata.Country,
		Language:    metadata.Language,
		Quality:     metadata.Quality,
		Genres:      metadata.Genres,
		Rating:      metadata.Rating,
		PosterURL:   metadata.PosterURL,
		BackdropURL: metadata.BackdropURL,
		Runtime:     metadata.Runtime,
		Budget:      metadata.Budget,
		Revenue:     metadata.Revenue,
		BoxOffice:   metadata.BoxOffice,
		Cast:        metadata.Cast,
	}, nil
}

func (a *TMDBServiceAdapter) CleanTitle(title string) string {
	return a.service.CleanTitle(title)
}

func (a *TMDBServiceAdapter) DownloadPoster(title string, mediaID uint, posterDir string) (string, error) {
	return a.service.DownloadPoster(title, mediaID, posterDir)
}

func (a *TMDBServiceAdapter) DownloadTVPoster(title string, seriesID uint, posterDir string) (string, error) {
	return a.service.DownloadTVPoster(title, seriesID, posterDir)
}

func (a *TMDBServiceAdapter) GetPosterURL(posterPath string, size string) string {
	return a.service.GetPosterURL(posterPath, size)
}

func (a *TMDBServiceAdapter) TestConnection() error {
	return a.service.TestConnection()
}

// MediaServiceAdapter adapts services.MediaService to interfaces.MediaServiceInterface
type MediaServiceAdapter struct {
	service *services.MediaService
}

func NewMediaServiceAdapter(service *services.MediaService) *MediaServiceAdapter {
	return &MediaServiceAdapter{service: service}
}

func (a *MediaServiceAdapter) GetMediaByPath(path string) (*models.Media, error) {
	return a.service.GetMediaByPath(path)
}

func (a *MediaServiceAdapter) MediaExists(path string) (bool, error) {
	return a.service.MediaExists(path)
}

func (a *MediaServiceAdapter) CreateMedia(media *models.Media) error {
	return a.service.CreateMedia(media)
}

func (a *MediaServiceAdapter) UpdateMedia(media *models.Media) error {
	return a.service.UpdateMedia(media)
}

func (a *MediaServiceAdapter) UpsertMedia(media *models.Media) error {
	return a.service.UpsertMedia(media)
}

func (a *MediaServiceAdapter) DeleteMedia(id uint) error {
	return a.service.DeleteMedia(id)
}

func (a *MediaServiceAdapter) FindOrCreateSeries(title string) (*models.Series, error) {
	return a.service.FindOrCreateSeries(title)
}

func (a *MediaServiceAdapter) GetGenreIDsByNames(genreNames []string) ([]uint, error) {
	return a.service.GetGenreIDsByNames(genreNames)
}

func (a *MediaServiceAdapter) AssignGenresToMedia(mediaID uint, genreIDs []uint) error {
	return a.service.AssignGenresToMedia(mediaID, genreIDs)
}

func (a *MediaServiceAdapter) CreateSubtitle(subtitle *models.Subtitle) error {
	return a.service.CreateSubtitle(subtitle)
}

func (a *MediaServiceAdapter) GetAllMedia() ([]models.Media, error) {
	return a.service.GetAllMedia()
}

func (a *MediaServiceAdapter) SearchMedia(query string) ([]models.Media, error) {
	return a.service.SearchMedia(query)
}

func (a *MediaServiceAdapter) SaveSubtitleTracks(mediaID uint, tracks []models.SubtitleTrack) error {
	return a.service.SaveSubtitleTracks(mediaID, tracks)
}

func (a *MediaServiceAdapter) SaveAudioTracks(mediaID uint, tracks []models.AudioTrack) error {
	return a.service.SaveAudioTracks(mediaID, tracks)
}

func (a *MediaServiceAdapter) GetSubtitleTracks(mediaID uint) ([]models.SubtitleTrack, error) {
	return a.service.GetSubtitleTracks(mediaID)
}

func (a *MediaServiceAdapter) GetAudioTracks(mediaID uint) ([]models.AudioTrack, error) {
	return a.service.GetAudioTracks(mediaID)
}

func (a *MediaServiceAdapter) CreateSubtitleTrack(track *models.SubtitleTrack) error {
	return a.service.CreateSubtitleTrack(track)
}

func (a *MediaServiceAdapter) CreateAudioTrack(track *models.AudioTrack) error {
	return a.service.CreateAudioTrack(track)
}

// ThumbnailServiceAdapter adapts services.ThumbnailService to interfaces.ThumbnailServiceInterface
type ThumbnailServiceAdapter struct {
	service *services.ThumbnailService
}

func NewThumbnailServiceAdapter(service *services.ThumbnailService) *ThumbnailServiceAdapter {
	return &ThumbnailServiceAdapter{service: service}
}

func (a *ThumbnailServiceAdapter) GenerateThumbnail(path string, mediaID uint, title string) (string, error) {
	return a.service.GenerateThumbnail(path, mediaID, title)
}

func (a *ThumbnailServiceAdapter) GeneratePreviewClip(path string, mediaID uint, title string) (string, error) {
	return a.service.GeneratePreviewClip(path, mediaID, title)
}

func (a *ThumbnailServiceAdapter) GeneratePreviewClipWithEpisodeInfo(path string, mediaID uint, title string, season *int, episode *int) (string, error) {
	return a.service.GeneratePreviewClipWithEpisodeInfo(path, mediaID, title, season, episode)
}

func (a *ThumbnailServiceAdapter) ThumbnailExists(mediaID uint, title string) bool {
	return a.service.ThumbnailExists(mediaID, title)
}

func (a *ThumbnailServiceAdapter) PreviewExists(mediaID uint, title string) bool {
	return a.service.PreviewExists(mediaID, title)
}

func (a *ThumbnailServiceAdapter) GenerateThumbnailAsync(path string, mediaID uint, title string) (string, error) {
	return a.service.GenerateThumbnailAsync(path, mediaID, title)
}

func (a *ThumbnailServiceAdapter) GeneratePreviewClipAsync(path string, mediaID uint, title string) (string, error) {
	return a.service.GeneratePreviewClipAsync(path, mediaID, title)
}

func (a *ThumbnailServiceAdapter) GetThumbnailPath(mediaID uint, title string) string {
	return a.service.GetThumbnailPath(mediaID, title)
}

func (a *ThumbnailServiceAdapter) GetPreviewPath(mediaID uint, title string) string {
	return a.service.GetPreviewPath(mediaID, title)
}

func (a *ThumbnailServiceAdapter) GetWorkerPoolStats() map[string]interface{} {
	return a.service.GetWorkerPoolStats()
}

func (a *ThumbnailServiceAdapter) GetJobStatus(jobID string) (*interfaces.JobStatus, bool) {
	// Convert service JobStatus to interface JobStatus
	job, exists := a.service.GetJobStatus(jobID)
	if !exists {
		return nil, false
	}
	
	interfaceJob := &interfaces.JobStatus{
		ID:        job.ID,
		Type:      job.Type,
		Status:    job.Status,
		Progress:  job.Progress,
		StartTime: job.StartTime,
		Error:     job.Error,
	}
	
	return interfaceJob, true
}

func (a *ThumbnailServiceAdapter) GetActiveJobs() map[string]*interfaces.JobStatus {
	serviceJobs := a.service.GetActiveJobs()
	interfaceJobs := make(map[string]*interfaces.JobStatus)
	
	for id, job := range serviceJobs {
		interfaceJobs[id] = &interfaces.JobStatus{
			ID:        job.ID,
			Type:      job.Type,
			Status:    job.Status,
			Progress:  job.Progress,
			StartTime: job.StartTime,
			Error:     job.Error,
		}
	}
	
	return interfaceJobs
}

func (a *ThumbnailServiceAdapter) IsQueueHealthy() bool {
	return a.service.IsQueueHealthy()
}

func (a *ThumbnailServiceAdapter) Shutdown() {
	a.service.Shutdown()
}

// PosterServiceAdapter adapts services.PosterService to interfaces.PosterServiceInterface
type PosterServiceAdapter struct {
	service *services.PosterService
}

func NewPosterServiceAdapter(service *services.PosterService) *PosterServiceAdapter {
	return &PosterServiceAdapter{service: service}
}

func (a *PosterServiceAdapter) DownloadPoster(title string, mediaID uint) error {
	return a.service.DownloadPoster(title, mediaID)
}

func (a *PosterServiceAdapter) DownloadPosterWithPath(title string, mediaID uint) (string, error) {
	return a.service.DownloadPosterWithPath(title, mediaID)
}

func (a *PosterServiceAdapter) DownloadTVPosterWithPath(title string, seriesID uint) (string, error) {
	return a.service.DownloadTVPosterWithPath(title, seriesID)
}

func (a *PosterServiceAdapter) GetPosterPath(mediaID uint, title string) string {
	return a.service.GetPosterPath(mediaID, title)
}

func (a *PosterServiceAdapter) SetTMDBService(tmdbService interfaces.TMDBServiceInterface) {
	a.service.SetTMDBService(tmdbService)
}

// CeleryServiceAdapter adapts services.CeleryService to interfaces.CeleryServiceInterface
type CeleryServiceAdapter struct {
	service *services.CeleryService
}

func NewCeleryServiceAdapter(service *services.CeleryService) *CeleryServiceAdapter {
	return &CeleryServiceAdapter{service: service}
}

func (a *CeleryServiceAdapter) QueueThumbnailGeneration(mediaID uint, path string) error {
	return a.service.QueueThumbnailGeneration(mediaID, path)
}

func (a *CeleryServiceAdapter) QueuePreviewGeneration(mediaID uint, path string) error {
	return a.service.QueuePreviewGeneration(mediaID, path)
}

// ALACAudioServiceAdapter adapts services.ALACAudioService to interfaces.ALACAudioServiceInterface
type ALACAudioServiceAdapter struct {
	service *services.ALACAudioService
}

func NewALACAudioServiceAdapter(service *services.ALACAudioService) *ALACAudioServiceAdapter {
	return &ALACAudioServiceAdapter{service: service}
}

func (a *ALACAudioServiceAdapter) ExtractALACAudio(path string, mediaID int) (string, error) {
	return a.service.ExtractALACAudio(path, mediaID)
}

func (a *ALACAudioServiceAdapter) AutoExtractALACForMedia(videoPath string, mediaID int) {
	a.service.AutoExtractALACForMedia(videoPath, mediaID)
}

func (a *ALACAudioServiceAdapter) ManualExtractALAC(videoPath string, mediaID int) (string, error) {
	return a.service.ManualExtractALAC(videoPath, mediaID)
}

func (a *ALACAudioServiceAdapter) SetBatchMode(enabled bool) {
	a.service.SetBatchMode(enabled)
}

func (a *ALACAudioServiceAdapter) GetAudioPath(mediaID int) string {
	return a.service.GetAudioPath(mediaID)
}

func (a *ALACAudioServiceAdapter) CleanupOversizedFiles() error {
	return a.service.CleanupOversizedFiles()
}

// RecommendationServiceAdapter adapts services.RecommendationService to interfaces.RecommendationServiceInterface
type RecommendationServiceAdapter struct {
	service *services.RecommendationService
}

func NewRecommendationServiceAdapter(service *services.RecommendationService) *RecommendationServiceAdapter {
	return &RecommendationServiceAdapter{service: service}
}

func (a *RecommendationServiceAdapter) RefreshRecommendations() error {
	return a.service.RefreshRecommendations()
}
