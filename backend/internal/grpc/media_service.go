package grpc

import (
	"context"
	"fmt"
	"log"
	"strconv"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
	"homeflix-backend/internal/scanner"
	pb_media "homeflix-backend/proto"
)

// MediaServiceServer implements the gRPC MediaService
type MediaServiceServer struct {
	pb_media.UnimplementedMediaServiceServer
	mediaService *services.MediaService
	mediaScanner *scanner.MediaScanner
}

// NewMediaServiceServer creates a new MediaServiceServer
func NewMediaServiceServer(mediaService *services.MediaService, mediaScanner *scanner.MediaScanner) *MediaServiceServer {
	return &MediaServiceServer{
		mediaService: mediaService,
		mediaScanner: mediaScanner,
	}
}

// Helper function to convert models.Media to pb_media.Media
func (s *MediaServiceServer) convertMediaToProto(media *models.Media) *pb_media.Media {
	pbMedia := &pb_media.Media{
		Id:            uint32(media.ID),
		Uuid:          media.UUID,
		Title:         media.Title,
		OriginalTitle: media.OriginalTitle,
		Type:          media.Type,
		FilePath:      media.FilePath,
		FileSize:      media.FileSize,
		Duration:      int32(media.Duration),
		Tagline:       media.Tagline,
		ShortDesc:     media.ShortDesc,
		LongDesc:      media.LongDesc,
		Description:   media.Description,
		Year:          int32(media.Year),
		Rating:        media.Rating,
		Country:       media.Country,
		Language:      media.Language,
		Quality:       media.Quality,
		Stars:         media.Stars,
		Director:      media.Director,
		Cast:          media.Cast,
		Writers:       media.Writers,
		Producers:     media.Producers,
		Budget:        media.Budget,
		Revenue:       media.Revenue,
		BoxOffice:     media.BoxOffice,
		Status:        media.Status,
		ImdbId:        media.IMDBID,
		Homepage:      media.Homepage,
		Collection:    media.Collection,
		Awards:        media.Awards,
		Certification: media.Certification,
		Runtime:       int32(media.Runtime),
		Popularity:    media.Popularity,
		VoteCount:     int32(media.VoteCount),
		Adult:         media.Adult,
		GenreNames:    media.GenreNames,
		Resolution:    media.Resolution,
		Codec:         media.Codec,
		Bitrate:       int32(media.Bitrate),
		ThumbnailPath: media.ThumbnailPath,
		PreviewPath:   media.PreviewPath,
		PreviewClipPath: media.PreviewClipPath,
		PosterPath:    media.PosterPath,
		BannerPath:    media.BannerPath,
		TrailerPath:   media.TrailerPath,
		ViewCount:     int32(media.ViewCount),
		CreatedAt:     timestamppb.New(media.CreatedAt),
		UpdatedAt:     timestamppb.New(media.UpdatedAt),
		LastUpdated:   media.LastUpdated,
	}

	// Handle release date
	if !media.ReleaseDate.IsZero() {
		pbMedia.ReleaseDate = timestamppb.New(media.ReleaseDate)
	}

	// Handle last viewed
	if media.LastViewed != nil {
		pbMedia.LastViewed = timestamppb.New(*media.LastViewed)
	}

	// Handle series info for episodes
	if media.SeriesID != nil {
		pbMedia.SeriesId = uint32(*media.SeriesID)
	}
	if media.SeasonID != nil {
		pbMedia.SeasonId = uint32(*media.SeasonID)
	}
	if media.SeasonNumber != nil {
		pbMedia.SeasonNumber = int32(*media.SeasonNumber)
	}
	if media.EpisodeNumber != nil {
		pbMedia.EpisodeNumber = int32(*media.EpisodeNumber)
	}

	// Convert genres
	for _, genre := range media.Genres {
		pbGenre := &pb_media.Genre{
			Id:          uint32(genre.ID),
			Name:        genre.Name,
			Description: genre.Description,
			CreatedAt:   timestamppb.New(genre.CreatedAt),
			UpdatedAt:   timestamppb.New(genre.UpdatedAt),
		}
		pbMedia.Genres = append(pbMedia.Genres, pbGenre)
	}

	// Convert subtitles
	for _, subtitle := range media.Subtitles {
		pbSubtitle := &pb_media.Subtitle{
			Id:        uint32(subtitle.ID),
			MediaId:   uint32(subtitle.MediaID),
			Language:  subtitle.Language,
			FilePath:  subtitle.FilePath,
			Format:    subtitle.Format,
			CreatedAt: timestamppb.New(subtitle.CreatedAt),
			UpdatedAt: timestamppb.New(subtitle.UpdatedAt),
		}
		pbMedia.Subtitles = append(pbMedia.Subtitles, pbSubtitle)
	}

	// Convert series if present
	if media.Series != nil {
		pbMedia.Series = s.convertSeriesToProto(media.Series)
	}

	return pbMedia
}

// Helper function to convert models.Series to pb_media.Series
func (s *MediaServiceServer) convertSeriesToProto(series *models.Series) *pb_media.Series {
	pbSeries := &pb_media.Series{
		Id:            uint32(series.ID),
		Uuid:          series.UUID,
		Title:         series.Title,
		Description:   series.Description,
		Rating:        float64(series.Rating),
		Status:        series.Status,
		TotalSeasons:  int32(series.TotalSeasons),
		TotalEpisodes: int32(series.TotalEpisodes),
		PosterPath:    series.PosterPath,
		BackdropPath:  series.BackdropPath,
		CreatedAt:     timestamppb.New(series.CreatedAt),
		UpdatedAt:     timestamppb.New(series.UpdatedAt),
	}

	// Handle release date
	if !series.ReleaseDate.IsZero() {
		pbSeries.ReleaseDate = timestamppb.New(series.ReleaseDate)
	}

	// Convert episodes
	for _, episode := range series.Episodes {
		pbSeries.Episodes = append(pbSeries.Episodes, s.convertMediaToProto(&episode))
	}

	// Convert seasons
	for _, season := range series.Seasons {
		pbSeason := s.convertSeasonToProto(&season)
		pbSeries.Seasons = append(pbSeries.Seasons, pbSeason)
	}

	// Convert genres
	for _, genre := range series.Genres {
		pbGenre := &pb_media.Genre{
			Id:          uint32(genre.ID),
			Name:        genre.Name,
			Description: genre.Description,
			CreatedAt:   timestamppb.New(genre.CreatedAt),
			UpdatedAt:   timestamppb.New(genre.UpdatedAt),
		}
		pbSeries.Genres = append(pbSeries.Genres, pbGenre)
	}

	return pbSeries
}

// Helper function to convert models.Season to pb_media.Season
func (s *MediaServiceServer) convertSeasonToProto(season *models.Season) *pb_media.Season {
	pbSeason := &pb_media.Season{
		Id:           uint32(season.ID),
		SeriesId:     uint32(season.SeriesID),
		SeasonNumber: int32(season.SeasonNumber),
		Title:        season.Title,
		Description:  season.Description,
		PosterPath:   season.PosterPath,
		EpisodeCount: int32(season.EpisodeCount),
		CreatedAt:    timestamppb.New(season.CreatedAt),
		UpdatedAt:    timestamppb.New(season.UpdatedAt),
	}

	// Handle release date
	if !season.ReleaseDate.IsZero() {
		pbSeason.ReleaseDate = timestamppb.New(season.ReleaseDate)
	}

	// Convert episodes
	for _, episode := range season.Episodes {
		pbSeason.Episodes = append(pbSeason.Episodes, s.convertMediaToProto(&episode))
	}

	// Convert series if present
	if season.Series != nil {
		pbSeason.Series = s.convertSeriesToProto(season.Series)
	}

	return pbSeason
}

// GetMedia retrieves a single media item by UUID
func (s *MediaServiceServer) GetMedia(ctx context.Context, req *pb_media.GetMediaRequest) (*pb_media.Media, error) {
	log.Printf("🎬 gRPC GetMedia request for UUID: %s", req.Uuid)

	// First try to find by UUID
	allMedia, err := s.mediaService.GetAllMedia()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get media: %v", err)
	}

	for _, media := range allMedia {
		if media.UUID == req.Uuid {
			return s.convertMediaToProto(&media), nil
		}
	}

	// If not found by UUID, try to parse as ID
	if id, err := strconv.ParseUint(req.Uuid, 10, 32); err == nil {
		media, err := s.mediaService.GetMediaByID(uint(id))
		if err != nil {
			return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
		}
		return s.convertMediaToProto(media), nil
	}

	return nil, status.Errorf(codes.NotFound, "media with UUID %s not found", req.Uuid)
}

// GetAllMedia retrieves all media with pagination
func (s *MediaServiceServer) GetAllMedia(ctx context.Context, req *pb_media.GetAllMediaRequest) (*pb_media.GetAllMediaResponse, error) {
	log.Printf("🎬 gRPC GetAllMedia request - limit: %d, offset: %d", req.Limit, req.Offset)

	// Get all media from the service
	allMedia, err := s.mediaService.GetAllMedia()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get all media: %v", err)
	}

	// Apply filters if specified
	var filteredMedia []models.Media
	for _, media := range allMedia {
		// Filter by genre if specified
		if req.Genre != "" {
			hasGenre := false
			for _, genreName := range media.GenreNames {
				if genreName == req.Genre {
					hasGenre = true
					break
				}
			}
			if !hasGenre {
				continue
			}
		}

		// Filter by type if specified
		if req.Type != "" && media.Type != req.Type {
			continue
		}

		filteredMedia = append(filteredMedia, media)
	}

	// Apply pagination
	total := len(filteredMedia)
	start := int(req.Offset)
	end := start + int(req.Limit)

	if start >= total {
		filteredMedia = []models.Media{}
	} else if end > total {
		filteredMedia = filteredMedia[start:]
	} else if req.Limit > 0 {
		filteredMedia = filteredMedia[start:end]
	}

	// Convert to protobuf
	var pbMedia []*pb_media.Media
	for _, media := range filteredMedia {
		pbMedia = append(pbMedia, s.convertMediaToProto(&media))
	}

	response := &pb_media.GetAllMediaResponse{
		Media:  pbMedia,
		Total:  int32(total),
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	return response, nil
}

// GetMovies retrieves all movies with pagination
func (s *MediaServiceServer) GetMovies(ctx context.Context, req *pb_media.GetAllMediaRequest) (*pb_media.GetAllMediaResponse, error) {
	log.Printf("🎬 gRPC GetMovies request - limit: %d, offset: %d", req.Limit, req.Offset)

	// Get movies from the service
	movies, err := s.mediaService.GetMovies()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get movies: %v", err)
	}

	// Apply filters if specified
	var filteredMovies []models.Media
	for _, movie := range movies {
		// Filter by genre if specified
		if req.Genre != "" {
			hasGenre := false
			for _, genreName := range movie.GenreNames {
				if genreName == req.Genre {
					hasGenre = true
					break
				}
			}
			if !hasGenre {
				continue
			}
		}

		filteredMovies = append(filteredMovies, movie)
	}

	// Apply pagination
	total := len(filteredMovies)
	start := int(req.Offset)
	end := start + int(req.Limit)

	if start >= total {
		filteredMovies = []models.Media{}
	} else if end > total {
		filteredMovies = filteredMovies[start:]
	} else if req.Limit > 0 {
		filteredMovies = filteredMovies[start:end]
	}

	// Convert to protobuf
	var pbMovies []*pb_media.Media
	for _, movie := range filteredMovies {
		pbMovies = append(pbMovies, s.convertMediaToProto(&movie))
	}

	response := &pb_media.GetAllMediaResponse{
		Media:  pbMovies,
		Total:  int32(total),
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	return response, nil
}

// GetTVShows retrieves all TV shows with pagination
func (s *MediaServiceServer) GetTVShows(ctx context.Context, req *pb_media.GetAllMediaRequest) (*pb_media.GetAllMediaResponse, error) {
	log.Printf("📺 gRPC GetTVShows request - limit: %d, offset: %d", req.Limit, req.Offset)

	// Get TV shows (episodes) from the service
	tvShows, err := s.mediaService.GetTVShows()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get TV shows: %v", err)
	}

	// Apply filters if specified
	var filteredShows []models.Media
	for _, show := range tvShows {
		// Filter by genre if specified
		if req.Genre != "" {
			hasGenre := false
			for _, genreName := range show.GenreNames {
				if genreName == req.Genre {
					hasGenre = true
					break
				}
			}
			if !hasGenre {
				continue
			}
		}

		filteredShows = append(filteredShows, show)
	}

	// Apply pagination
	total := len(filteredShows)
	start := int(req.Offset)
	end := start + int(req.Limit)

	if start >= total {
		filteredShows = []models.Media{}
	} else if end > total {
		filteredShows = filteredShows[start:]
	} else if req.Limit > 0 {
		filteredShows = filteredShows[start:end]
	}

	// Convert to protobuf
	var pbShows []*pb_media.Media
	for _, show := range filteredShows {
		pbShows = append(pbShows, s.convertMediaToProto(&show))
	}

	response := &pb_media.GetAllMediaResponse{
		Media:  pbShows,
		Total:  int32(total),
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	return response, nil
}

// SearchMedia searches for media by query
func (s *MediaServiceServer) SearchMedia(ctx context.Context, req *pb_media.SearchMediaRequest) (*pb_media.SearchMediaResponse, error) {
	log.Printf("🔍 gRPC SearchMedia request - query: %s, type: %s", req.Query, req.Type)

	// Use the actual search functionality
	results, err := s.mediaService.SearchMedia(req.Query)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search media: %v", err)
	}

	// Filter by type if specified
	var filteredResults []models.Media
	for _, media := range results {
		if req.Type != "" && media.Type != req.Type {
			continue
		}
		filteredResults = append(filteredResults, media)
	}

	// Apply limit if specified
	if req.Limit > 0 && len(filteredResults) > int(req.Limit) {
		filteredResults = filteredResults[:req.Limit]
	}

	// Convert to protobuf
	var pbResults []*pb_media.Media
	for _, media := range filteredResults {
		pbResults = append(pbResults, s.convertMediaToProto(&media))
	}

	response := &pb_media.SearchMediaResponse{
		Results: pbResults,
		Total:   int32(len(results)), // Total before filtering
		Query:   req.Query,
	}

	return response, nil
}

// GetMediaByGenre retrieves media filtered by genre
func (s *MediaServiceServer) GetMediaByGenre(ctx context.Context, req *pb_media.GetMediaByGenreRequest) (*pb_media.GetAllMediaResponse, error) {
	log.Printf("🎭 gRPC GetMediaByGenre request - genre: %s", req.Genre)

	// Use the actual genre filtering functionality
	media, err := s.mediaService.GetMediaByGenreSimple(req.Genre)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get media by genre: %v", err)
	}

	// Apply pagination
	total := len(media)
	start := int(req.Offset)
	end := start + int(req.Limit)

	if start >= total {
		media = []models.Media{}
	} else if end > total {
		media = media[start:]
	} else if req.Limit > 0 {
		media = media[start:end]
	}

	// Convert to protobuf
	var pbMedia []*pb_media.Media
	for _, m := range media {
		pbMedia = append(pbMedia, s.convertMediaToProto(&m))
	}

	response := &pb_media.GetAllMediaResponse{
		Media:  pbMedia,
		Total:  int32(total),
		Limit:  req.Limit,
		Offset: req.Offset,
	}

	return response, nil
}

// GetAllSeries streams all TV series
func (s *MediaServiceServer) GetAllSeries(req *emptypb.Empty, stream pb_media.MediaService_GetAllSeriesServer) error {
	log.Printf("📺 gRPC GetAllSeries streaming request")

	// Get all series from the service
	series, err := s.mediaService.GetAllSeries()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get all series: %v", err)
	}

	// Stream each series
	for _, s := range series {
		pbSeries := s.convertSeriesToProto(&s)
		if err := stream.Send(pbSeries); err != nil {
			return status.Errorf(codes.Internal, "failed to send series: %v", err)
		}
	}

	return nil
}

// GetSeries retrieves a specific series by UUID
func (s *MediaServiceServer) GetSeries(ctx context.Context, req *pb_media.GetSeriesRequest) (*pb_media.Series, error) {
	log.Printf("📺 gRPC GetSeries request for UUID: %s", req.Uuid)

	// First try to find by UUID
	allSeries, err := s.mediaService.GetAllSeries()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get series: %v", err)
	}

	for _, series := range allSeries {
		if series.UUID == req.Uuid {
			return s.convertSeriesToProto(&series), nil
		}
	}

	// If not found by UUID, try to parse as ID
	if id, err := strconv.ParseUint(req.Uuid, 10, 32); err == nil {
		series, err := s.mediaService.GetSeriesByID(uint(id))
		if err != nil {
			return nil, status.Errorf(codes.NotFound, "series not found: %v", err)
		}
		return s.convertSeriesToProto(series), nil
	}

	return nil, status.Errorf(codes.NotFound, "series with UUID %s not found", req.Uuid)
}

// GetSeasonsBySeries streams seasons for a specific series
func (s *MediaServiceServer) GetSeasonsBySeries(req *pb_media.GetSeasonsBySeriesRequest, stream pb_media.MediaService_GetSeasonsBySeriesServer) error {
	log.Printf("📺 gRPC GetSeasonsBySeries streaming request for series: %s", req.SeriesUuid)

	// Find series by UUID first
	allSeries, err := s.mediaService.GetAllSeries()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get series: %v", err)
	}

	var seriesID uint
	found := false
	for _, series := range allSeries {
		if series.UUID == req.SeriesUuid {
			seriesID = series.ID
			found = true
			break
		}
	}

	if !found {
		// Try to parse as ID
		if id, err := strconv.ParseUint(req.SeriesUuid, 10, 32); err == nil {
			seriesID = uint(id)
		} else {
			return status.Errorf(codes.NotFound, "series with UUID %s not found", req.SeriesUuid)
		}
	}

	// Get seasons for the series
	seasonsData, err := s.mediaService.GetSeasonsBySeriesID(seriesID)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get seasons: %v", err)
	}

	// Convert and stream each season
	for _, seasonData := range seasonsData {
		// Convert map to Season struct
		season := &pb_media.Season{
			Id:           uint32(seasonData["season_number"].(int)),
			SeriesId:     uint32(seriesID),
			SeasonNumber: int32(seasonData["season_number"].(int)),
			Title:        fmt.Sprintf("Season %d", seasonData["season_number"].(int)),
			EpisodeCount: int32(seasonData["episode_count"].(int)),
		}

		if err := stream.Send(season); err != nil {
			return status.Errorf(codes.Internal, "failed to send season: %v", err)
		}
	}

	return nil
}

// GetEpisodesBySeriesAndSeason streams episodes for a specific series and season
func (s *MediaServiceServer) GetEpisodesBySeriesAndSeason(req *pb_media.GetEpisodesBySeriesAndSeasonRequest, stream pb_media.MediaService_GetEpisodesBySeriesAndSeasonServer) error {
	log.Printf("📺 gRPC GetEpisodesBySeriesAndSeason streaming request for series: %s, season: %d", req.SeriesUuid, req.SeasonNumber)

	// Find series by UUID first
	allSeries, err := s.mediaService.GetAllSeries()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get series: %v", err)
	}

	var seriesID uint
	found := false
	for _, series := range allSeries {
		if series.UUID == req.SeriesUuid {
			seriesID = series.ID
			found = true
			break
		}
	}

	if !found {
		// Try to parse as ID
		if id, err := strconv.ParseUint(req.SeriesUuid, 10, 32); err == nil {
			seriesID = uint(id)
		} else {
			return status.Errorf(codes.NotFound, "series with UUID %s not found", req.SeriesUuid)
		}
	}

	// Get episodes for the series and season
	episodes, err := s.mediaService.GetEpisodesBySeriesAndSeason(seriesID, int(req.SeasonNumber))
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get episodes: %v", err)
	}

	// Stream each episode
	for _, episode := range episodes {
		pbEpisode := s.convertMediaToProto(&episode)
		if err := stream.Send(pbEpisode); err != nil {
			return status.Errorf(codes.Internal, "failed to send episode: %v", err)
		}
	}

	return nil
}

// WatchMediaUpdates streams real-time media updates
func (s *MediaServiceServer) WatchMediaUpdates(req *emptypb.Empty, stream pb_media.MediaService_WatchMediaUpdatesServer) error {
	log.Printf("👀 gRPC WatchMediaUpdates streaming started")

	// This would typically connect to a real-time update system
	// For now, we'll send periodic mock updates
	// TODO: Integrate with actual real-time update system

	// Keep the stream alive and send updates
	// In a real implementation, this would listen to database changes, file system events, etc.
	
	return nil
}

// WatchLibraryChanges streams real-time library change notifications
func (s *MediaServiceServer) WatchLibraryChanges(req *emptypb.Empty, stream pb_media.MediaService_WatchLibraryChangesServer) error {
	log.Printf("📚 gRPC WatchLibraryChanges streaming started")

	// This would typically connect to file system watcher or database change streams
	// TODO: Integrate with actual library change detection

	return nil
}