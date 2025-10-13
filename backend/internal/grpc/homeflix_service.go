package grpc

import (
	"context"
	"fmt"
	"log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"homeflix-backend/internal/services"
	pb "homeflix-backend/proto"
)

// HomeflixServiceServer implements all services from homeflix.proto
type HomeflixServiceServer struct {
	pb.UnimplementedMediaServiceServer
	pb.UnimplementedStreamingServiceServer
	pb.UnimplementedPreviewServiceServer
	pb.UnimplementedUserServiceServer
	pb.UnimplementedRecommendationServiceServer
	pb.UnimplementedPlaybackServiceServer
	pb.UnimplementedAdminServiceServer

	mediaService          *services.MediaService
	streamService         *services.NetflixStreamService
	userService           *services.UserService
	recommendationService *services.RecommendationService
	playbackService       *services.PlaybackService
}

// NewHomeflixServiceServer creates a new HomeflixServiceServer
func NewHomeflixServiceServer(
	mediaService *services.MediaService,
	streamService *services.NetflixStreamService,
	userService *services.UserService,
	recommendationService *services.RecommendationService,
	playbackService *services.PlaybackService,
) *HomeflixServiceServer {
	return &HomeflixServiceServer{
		mediaService:          mediaService,
		streamService:         streamService,
		userService:           userService,
		recommendationService: recommendationService,
		playbackService:       playbackService,
	}
}

// ============================================================================
// Media Service Implementation
// ============================================================================

func (s *HomeflixServiceServer) GetMovies(ctx context.Context, req *pb.GetMoviesRequest) (*pb.GetMoviesResponse, error) {
	log.Printf("🎬 gRPC GetMovies - page: %d, limit: %d", req.Page, req.Limit)

	// Mock movies data
	movies := []*pb.Movie{
		{
			Id:          "movie-1",
			Title:       "Sample Action Movie",
			Description: "An exciting action-packed movie",
			PosterUrl:   "/posters/movie-1.jpg",
			BackdropUrl: "/backdrops/movie-1.jpg",
			Genres:      []string{"Action", "Adventure"},
			Year:        2024,
			Runtime:     120,
			Rating:      8.5,
			FilePath:    "/media/movies/action-movie.mp4",
			FileSize:    2 * 1024 * 1024 * 1024, // 2GB
			VideoCodec:  "h264",
			AudioCodec:  "aac",
			Resolution:  "1920x1080",
			CreatedAt:   timestamppb.Now(),
			UpdatedAt:   timestamppb.Now(),
			HasPreview:  true,
		},
		{
			Id:          "movie-2",
			Title:       "Sample Drama",
			Description: "A compelling drama",
			PosterUrl:   "/posters/movie-2.jpg",
			BackdropUrl: "/backdrops/movie-2.jpg",
			Genres:      []string{"Drama", "Romance"},
			Year:        2023,
			Runtime:     105,
			Rating:      7.8,
			FilePath:    "/media/movies/drama.mp4",
			FileSize:    1.5 * 1024 * 1024 * 1024, // 1.5GB
			VideoCodec:  "h264",
			AudioCodec:  "aac",
			Resolution:  "1920x1080",
			CreatedAt:   timestamppb.Now(),
			UpdatedAt:   timestamppb.Now(),
			HasPreview:  false,
		},
	}

	// Apply pagination
	start := int(req.Page * req.Limit)
	end := start + int(req.Limit)
	if start >= len(movies) {
		movies = []*pb.Movie{}
	} else if end > len(movies) {
		movies = movies[start:]
	} else {
		movies = movies[start:end]
	}

	response := &pb.GetMoviesResponse{
		Movies:     movies,
		TotalCount: int32(len(movies)),
		Page:       req.Page,
		Limit:      req.Limit,
		HasNext:    int(req.Page+1)*int(req.Limit) < len(movies),
		HasPrev:    req.Page > 0,
	}

	return response, nil
}

func (s *HomeflixServiceServer) GetMovie(ctx context.Context, req *pb.GetMovieRequest) (*pb.Movie, error) {
	log.Printf("🎬 gRPC GetMovie - ID: %s", req.Id)

	// Mock movie data
	movie := &pb.Movie{
		Id:          req.Id,
		Title:       "Sample Movie",
		Description: "A great movie with excellent cinematography and storytelling",
		PosterUrl:   "/posters/sample-movie.jpg",
		BackdropUrl: "/backdrops/sample-movie.jpg",
		TrailerUrl:  "/trailers/sample-movie.mp4",
		Genres:      []string{"Action", "Adventure", "Sci-Fi"},
		Year:        2024,
		Runtime:     142,
		Rating:      8.7,
		FilePath:    "/media/movies/sample-movie.mp4",
		FileSize:    3 * 1024 * 1024 * 1024, // 3GB
		VideoCodec:  "h264",
		AudioCodec:  "aac",
		Resolution:  "1920x1080",
		CreatedAt:   timestamppb.Now(),
		UpdatedAt:   timestamppb.Now(),
		HasPreview:  true,
		HasSubtitles: true,
		SubtitleLanguages: []string{"en", "es", "fr"},
	}

	return movie, nil
}

func (s *HomeflixServiceServer) GetSeries(ctx context.Context, req *pb.GetSeriesRequest) (*pb.GetSeriesResponse, error) {
	log.Printf("📺 gRPC GetSeries - page: %d, limit: %d", req.Page, req.Limit)

	// Mock series data
	series := []*pb.Series{
		{
			Id:          "series-1",
			Title:       "Sample TV Series",
			Description: "An amazing TV series with multiple seasons",
			PosterUrl:   "/posters/series-1.jpg",
			BackdropUrl: "/backdrops/series-1.jpg",
			Genres:      []string{"Drama", "Thriller"},
			Year:        2023,
			Rating:      9.1,
			Status:      "ongoing",
			TotalEpisodes: 24,
			CreatedAt:   timestamppb.Now(),
			UpdatedAt:   timestamppb.Now(),
		},
	}

	response := &pb.GetSeriesResponse{
		Series:     series,
		TotalCount: int32(len(series)),
		Page:       req.Page,
		Limit:      req.Limit,
		HasNext:    false,
		HasPrev:    false,
	}

	return response, nil
}

func (s *HomeflixServiceServer) GetSeriesDetails(ctx context.Context, req *pb.GetSeriesDetailsRequest) (*pb.Series, error) {
	log.Printf("📺 gRPC GetSeriesDetails - ID: %s", req.Id)

	// Mock series with seasons
	seasons := []*pb.Season{
		{
			Id:           "season-1",
			SeriesId:     req.Id,
			SeasonNumber: 1,
			Title:        "Season 1",
			Description:  "The first season",
			PosterUrl:    "/posters/season-1.jpg",
		},
		{
			Id:           "season-2",
			SeriesId:     req.Id,
			SeasonNumber: 2,
			Title:        "Season 2",
			Description:  "The second season",
			PosterUrl:    "/posters/season-2.jpg",
		},
	}

	series := &pb.Series{
		Id:          req.Id,
		Title:       "Sample TV Series",
		Description: "An amazing TV series with multiple seasons",
		PosterUrl:   "/posters/series.jpg",
		BackdropUrl: "/backdrops/series.jpg",
		Genres:      []string{"Drama", "Thriller"},
		Year:        2023,
		Rating:      9.1,
		Seasons:     seasons,
		Status:      "ongoing",
		TotalEpisodes: 24,
		CreatedAt:   timestamppb.Now(),
		UpdatedAt:   timestamppb.Now(),
	}

	return series, nil
}

func (s *HomeflixServiceServer) SearchMedia(ctx context.Context, req *pb.SearchRequest) (*pb.SearchResponse, error) {
	log.Printf("🔍 gRPC SearchMedia - query: %s, type: %s", req.Query, req.MediaType)

	// Mock search results
	movies := []*pb.Movie{
		{
			Id:          "search-movie-1",
			Title:       fmt.Sprintf("Movie matching '%s'", req.Query),
			Description: "A movie that matches your search",
			PosterUrl:   "/posters/search-movie.jpg",
			Genres:      []string{"Action"},
			Year:        2024,
			Rating:      8.0,
			CreatedAt:   timestamppb.Now(),
		},
	}

	series := []*pb.Series{
		{
			Id:          "search-series-1",
			Title:       fmt.Sprintf("Series matching '%s'", req.Query),
			Description: "A series that matches your search",
			PosterUrl:   "/posters/search-series.jpg",
			Genres:      []string{"Drama"},
			Year:        2023,
			Rating:      8.5,
			CreatedAt:   timestamppb.Now(),
		},
	}

	response := &pb.SearchResponse{
		Movies:       movies,
		Series:       series,
		TotalResults: int32(len(movies) + len(series)),
	}

	return response, nil
}

func (s *HomeflixServiceServer) GetMediaByGenre(ctx context.Context, req *pb.GetByGenreRequest) (*pb.MediaListResponse, error) {
	log.Printf("🎭 gRPC GetMediaByGenre - genre: %s, type: %s", req.Genre, req.MediaType)

	// Mock genre-filtered results
	movies := []*pb.Movie{
		{
			Id:          "genre-movie-1",
			Title:       fmt.Sprintf("%s Movie", req.Genre),
			Description: fmt.Sprintf("A great %s movie", req.Genre),
			PosterUrl:   "/posters/genre-movie.jpg",
			Genres:      []string{req.Genre},
			Year:        2024,
			Rating:      8.2,
			CreatedAt:   timestamppb.Now(),
		},
	}

	response := &pb.MediaListResponse{
		Movies:     movies,
		TotalCount: int32(len(movies)),
	}

	return response, nil
}

func (s *HomeflixServiceServer) GetRecentlyAdded(ctx context.Context, req *pb.GetRecentRequest) (*pb.MediaListResponse, error) {
	log.Printf("🆕 gRPC GetRecentlyAdded - limit: %d, type: %s", req.Limit, req.MediaType)

	// Mock recently added content
	movies := []*pb.Movie{
		{
			Id:          "recent-movie-1",
			Title:       "Recently Added Movie",
			Description: "A newly added movie",
			PosterUrl:   "/posters/recent-movie.jpg",
			Genres:      []string{"Action"},
			Year:        2024,
			Rating:      8.0,
			CreatedAt:   timestamppb.Now(),
		},
	}

	response := &pb.MediaListResponse{
		Movies:     movies,
		TotalCount: int32(len(movies)),
	}

	return response, nil
}

// ============================================================================
// Streaming Service Implementation
// ============================================================================

func (s *HomeflixServiceServer) StreamVideo(req *pb.StreamRequest, stream pb.StreamingService_StreamVideoServer) error {
	log.Printf("🎥 gRPC StreamVideo - media: %s, quality: %s", req.MediaId, req.Quality)

	// Mock video streaming
	// In a real implementation, this would stream actual video chunks
	for i := 0; i < 10; i++ {
		chunk := &pb.StreamChunk{
			Data:        []byte(fmt.Sprintf("Video chunk %d", i)),
			ChunkSize:   int64(len(fmt.Sprintf("Video chunk %d", i))),
			TotalSize:   1000,
			ContentType: "video/mp4",
		}

		if err := stream.Send(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send video chunk: %v", err)
		}
	}

	return nil
}

func (s *HomeflixServiceServer) StreamAudio(req *pb.StreamRequest, stream pb.StreamingService_StreamAudioServer) error {
	log.Printf("🎵 gRPC StreamAudio - media: %s, transcode: %t", req.MediaId, req.TranscodeAudio)

	// Mock audio streaming with transcoding support
	for i := 0; i < 5; i++ {
		chunk := &pb.StreamChunk{
			Data:        []byte(fmt.Sprintf("Audio chunk %d", i)),
			ChunkSize:   int64(len(fmt.Sprintf("Audio chunk %d", i))),
			TotalSize:   500,
			ContentType: "audio/aac",
		}

		if err := stream.Send(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send audio chunk: %v", err)
		}
	}

	return nil
}

func (s *HomeflixServiceServer) GetStreamInfo(ctx context.Context, req *pb.StreamInfoRequest) (*pb.StreamInfo, error) {
	log.Printf("ℹ️ gRPC GetStreamInfo - media: %s, type: %s", req.MediaId, req.MediaType)

	// Mock stream info
	streamInfo := &pb.StreamInfo{
		VideoCodec:        "h264",
		AudioCodec:        "aac",
		Resolution:        "1920x1080",
		Bitrate:           5000,
		Duration:          7200, // 2 hours
		NeedsTranscoding:  false,
		AvailableQualities: []string{"1080p", "720p", "480p"},
		AudioTracks: []*pb.AudioTrack{
			{
				Index:     0,
				Codec:     "aac",
				Language:  "en",
				Channels:  2,
				SampleRate: 48000,
				IsDefault: true,
			},
		},
		SubtitleTracks: []*pb.SubtitleTrack{
			{
				Index:     0,
				Language:  "en",
				Format:    "srt",
				IsDefault: true,
			},
		},
	}

	return streamInfo, nil
}

func (s *HomeflixServiceServer) StreamPreview(req *pb.PreviewRequest, stream pb.StreamingService_StreamPreviewServer) error {
	log.Printf("🎬 gRPC StreamPreview - media: %s, duration: %d", req.MediaId, req.Duration)

	// Mock preview streaming
	for i := 0; i < 3; i++ {
		chunk := &pb.StreamChunk{
			Data:        []byte(fmt.Sprintf("Preview chunk %d", i)),
			ChunkSize:   int64(len(fmt.Sprintf("Preview chunk %d", i))),
			TotalSize:   300,
			ContentType: "video/mp4",
		}

		if err := stream.Send(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send preview chunk: %v", err)
		}
	}

	return nil
}

// ============================================================================
// Preview Service Implementation
// ============================================================================

func (s *HomeflixServiceServer) GeneratePreview(ctx context.Context, req *pb.GeneratePreviewRequest) (*pb.GeneratePreviewResponse, error) {
	log.Printf("🎬 gRPC GeneratePreview - media: %s, duration: %d, priority: %t", req.MediaId, req.Duration, req.HighPriority)

	// Mock preview generation
	response := &pb.GeneratePreviewResponse{
		JobId:      fmt.Sprintf("preview-job-%s", req.MediaId),
		Status:     "queued",
		PreviewUrl: fmt.Sprintf("/api/preview/%s", req.MediaId),
	}

	return response, nil
}

func (s *HomeflixServiceServer) GetPreviewStatus(ctx context.Context, req *pb.PreviewStatusRequest) (*pb.PreviewStatus, error) {
	log.Printf("📊 gRPC GetPreviewStatus - job: %s", req.JobId)

	// Mock preview status
	status := &pb.PreviewStatus{
		JobId:           req.JobId,
		Status:          "completed",
		ProgressPercent: 100,
		PreviewUrl:      "/api/preview/sample-media",
		CreatedAt:       timestamppb.Now(),
		UpdatedAt:       timestamppb.Now(),
	}

	return status, nil
}

func (s *HomeflixServiceServer) StreamPreviewProgress(req *pb.PreviewProgressRequest, stream pb.PreviewService_StreamPreviewProgressServer) error {
	log.Printf("📈 gRPC StreamPreviewProgress - job: %s", req.JobId)

	// Mock progress streaming
	stages := []string{"extracting", "encoding", "uploading"}
	for i, stage := range stages {
		progress := &pb.PreviewProgress{
			JobId:           req.JobId,
			ProgressPercent: int32((i + 1) * 33),
			CurrentStage:    stage,
			Status:          "processing",
		}

		if err := stream.Send(progress); err != nil {
			return status.Errorf(codes.Internal, "failed to send progress: %v", err)
		}
	}

	// Final completion
	finalProgress := &pb.PreviewProgress{
		JobId:           req.JobId,
		ProgressPercent: 100,
		CurrentStage:    "completed",
		Status:          "completed",
	}

	return stream.Send(finalProgress)
}

func (s *HomeflixServiceServer) GetPreviewQueue(ctx context.Context, req *emptypb.Empty) (*pb.PreviewQueueStatus, error) {
	log.Printf("📋 gRPC GetPreviewQueue")

	// Mock queue status
	queueStatus := &pb.PreviewQueueStatus{
		QueueLength:     5,
		ProcessingCount: 2,
		CurrentJobs: []*pb.PreviewJob{
			{
				JobId:           "job-1",
				MediaId:         "media-1",
				MediaType:       "movie",
				Status:          "processing",
				ProgressPercent: 75,
				CreatedAt:       timestamppb.Now(),
				HighPriority:    true,
			},
		},
	}

	return queueStatus, nil
}

// ============================================================================
// Placeholder implementations for other services
// ============================================================================

func (s *HomeflixServiceServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Login not implemented")
}

func (s *HomeflixServiceServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Register not implemented")
}

func (s *HomeflixServiceServer) RefreshToken(ctx context.Context, req *pb.RefreshTokenRequest) (*pb.RefreshTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method RefreshToken not implemented")
}

func (s *HomeflixServiceServer) GetUserPreferences(ctx context.Context, req *pb.GetUserPreferencesRequest) (*pb.UserPreferences, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetUserPreferences not implemented")
}

func (s *HomeflixServiceServer) UpdateUserPreferences(ctx context.Context, req *pb.UpdateUserPreferencesRequest) (*pb.UserPreferences, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UpdateUserPreferences not implemented")
}

func (s *HomeflixServiceServer) UpdateWatchProgress(ctx context.Context, req *pb.UpdateWatchProgressRequest) (*pb.WatchProgress, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UpdateWatchProgress not implemented")
}

func (s *HomeflixServiceServer) GetWatchHistory(ctx context.Context, req *pb.GetWatchHistoryRequest) (*pb.GetWatchHistoryResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetWatchHistory not implemented")
}

func (s *HomeflixServiceServer) GetRecommendations(ctx context.Context, req *pb.RecommendationRequest) (*pb.RecommendationResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetRecommendations not implemented")
}

func (s *HomeflixServiceServer) StreamRecommendations(req *pb.RecommendationStreamRequest, stream pb.RecommendationService_StreamRecommendationsServer) error {
	return status.Errorf(codes.Unimplemented, "method StreamRecommendations not implemented")
}

func (s *HomeflixServiceServer) RateMedia(ctx context.Context, req *pb.RateMediaRequest) (*pb.RateMediaResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method RateMedia not implemented")
}

func (s *HomeflixServiceServer) GetSimilarMedia(ctx context.Context, req *pb.SimilarMediaRequest) (*pb.MediaListResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSimilarMedia not implemented")
}

func (s *HomeflixServiceServer) PlaybackControl(stream pb.PlaybackService_PlaybackControlServer) error {
	return status.Errorf(codes.Unimplemented, "method PlaybackControl not implemented")
}

func (s *HomeflixServiceServer) SyncPlayback(ctx context.Context, req *pb.SyncPlaybackRequest) (*pb.SyncPlaybackResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SyncPlayback not implemented")
}

func (s *HomeflixServiceServer) GetPlaybackState(ctx context.Context, req *pb.PlaybackStateRequest) (*pb.PlaybackState, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetPlaybackState not implemented")
}

func (s *HomeflixServiceServer) GetSystemHealth(ctx context.Context, req *emptypb.Empty) (*pb.SystemHealth, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSystemHealth not implemented")
}

func (s *HomeflixServiceServer) GetStreamingMetrics(ctx context.Context, req *emptypb.Empty) (*pb.StreamingMetrics, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetStreamingMetrics not implemented")
}

func (s *HomeflixServiceServer) ScanMediaLibrary(req *pb.ScanLibraryRequest, stream pb.AdminService_ScanMediaLibraryServer) error {
	return status.Errorf(codes.Unimplemented, "method ScanMediaLibrary not implemented")
}

func (s *HomeflixServiceServer) GetScanStatus(ctx context.Context, req *emptypb.Empty) (*pb.ScanStatus, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetScanStatus not implemented")
}

func (s *HomeflixServiceServer) GetPreviewQueueAdmin(ctx context.Context, req *emptypb.Empty) (*pb.AdminPreviewQueue, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetPreviewQueueAdmin not implemented")
}

func (s *HomeflixServiceServer) ClearPreviewQueue(ctx context.Context, req *emptypb.Empty) (*emptypb.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ClearPreviewQueue not implemented")
}

func (s *HomeflixServiceServer) GetAllUsers(ctx context.Context, req *pb.GetAllUsersRequest) (*pb.GetAllUsersResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetAllUsers not implemented")
}

func (s *HomeflixServiceServer) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*emptypb.Empty, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteUser not implemented")
}