package grpc

import (
	"context"
	"io"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "homeflix-backend/proto"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

type PlaybackServiceServer struct {
	pb.UnimplementedPlaybackServiceServer
	playbackService *services.PlaybackService
	mediaService    *services.MediaService
}

func NewPlaybackServiceServer(
	playbackService *services.PlaybackService,
	mediaService *services.MediaService,
) *PlaybackServiceServer {
	return &PlaybackServiceServer{
		playbackService: playbackService,
		mediaService:    mediaService,
	}
}

func (s *PlaybackServiceServer) UpdateProgress(stream playbackpb.PlaybackService_UpdateProgressServer) error {
	for {
		update, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to receive progress update: %v", err)
		}

		// Convert progress percentage to seconds if needed
		currentTimeSeconds := update.CurrentTime
		if update.Duration > 0 && update.Progress > 0 {
			// If progress is a percentage (0-1), convert to seconds
			if update.Progress <= 1.0 {
				currentTimeSeconds = update.Progress * update.Duration
			}
		}

		// Update progress in database
		err = s.playbackService.UpdateProgress(
			update.UserId,
			update.MediaUuid,
			int(currentTimeSeconds),
			update.Completed,
		)

		response := &playbackpb.ProgressResponse{
			SessionId: update.SessionId,
			Success:   err == nil,
			Timestamp: timestamppb.Now(),
		}

		if err != nil {
			response.Message = err.Error()
		} else {
			response.Message = "Progress updated successfully"
		}

		if err := stream.Send(response); err != nil {
			return status.Errorf(codes.Internal, "failed to send progress response: %v", err)
		}
	}
}

func (s *PlaybackServiceServer) GetProgress(ctx context.Context, req *playbackpb.ProgressRequest) (*playbackpb.ProgressResponse, error) {
	if req.MediaUuid == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID and user ID are required")
	}

	// Get progress from service
	progress, err := s.playbackService.GetProgress(req.UserId, req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get progress: %v", err)
	}

	// Get media duration for percentage calculation
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	duration := float64(media.Duration)
	currentTime := float64(progress.Progress)
	progressPercentage := 0.0
	if duration > 0 {
		progressPercentage = currentTime / duration
	}

	response := &playbackpb.ProgressResponse{
		MediaUuid:    req.MediaUuid,
		UserId:       req.UserId,
		Progress:     progressPercentage,
		CurrentTime:  currentTime,
		Duration:     duration,
		Completed:    progress.Completed,
		Success:      true,
		Message:      "Progress retrieved successfully",
	}

	if progress.WatchedAt != nil {
		response.LastWatched = timestamppb.New(*progress.WatchedAt)
	}

	return response, nil
}

func (s *PlaybackServiceServer) InitializeProgress(ctx context.Context, req *playbackpb.InitializeProgressRequest) (*playbackpb.ProgressResponse, error) {
	if req.MediaUuid == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID and user ID are required")
	}

	// Initialize progress tracking
	err := s.playbackService.InitializeProgress(req.UserId, req.MediaUuid, req.SessionId)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to initialize progress: %v", err)
	}

	return &playbackpb.ProgressResponse{
		MediaUuid: req.MediaUuid,
		UserId:    req.UserId,
		Progress:  0.0,
		Success:   true,
		Message:   "Progress initialized successfully",
		Timestamp: timestamppb.Now(),
	}, nil
}

func (s *PlaybackServiceServer) TrackView(ctx context.Context, req *playbackpb.TrackViewRequest) (*playbackpb.TrackViewResponse, error) {
	if req.MediaUuid == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID and user ID are required")
	}

	// Track the view
	totalViews, err := s.playbackService.TrackView(req.UserId, req.MediaUuid, req.SessionId, req.WatchDuration)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to track view: %v", err)
	}

	return &playbackpb.TrackViewResponse{
		Success:    true,
		Message:    "View tracked successfully",
		TotalViews: int32(totalViews),
	}, nil
}

func (s *PlaybackServiceServer) GetViewHistory(ctx context.Context, req *playbackpb.ViewHistoryRequest) (*playbackpb.ViewHistoryResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	limit := int(req.Limit)
	if limit <= 0 {
		limit = 20
	}
	offset := int(req.Offset)

	// Get view history
	history, total, err := s.playbackService.GetViewHistory(req.UserId, limit, offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get view history: %v", err)
	}

	response := &playbackpb.ViewHistoryResponse{
		Total: int32(total),
	}

	// Convert to proto format
	for _, entry := range history {
		media, err := s.mediaService.GetMediaByID(entry.MediaID)
		if err != nil {
			continue // Skip if media not found
		}

		historyEntry := &playbackpb.ViewHistoryEntry{
			Media:         s.convertMediaToProto(media),
			WatchedAt:     timestamppb.New(entry.WatchedAt),
			Progress:      float64(entry.Progress) / float64(media.Duration), // Convert to percentage
			Completed:     entry.Completed,
			WatchDuration: float64(entry.Progress), // Duration watched in seconds
		}

		response.Entries = append(response.Entries, historyEntry)
	}

	return response, nil
}

func (s *PlaybackServiceServer) GetWatchStats(ctx context.Context, req *playbackpb.WatchStatsRequest) (*playbackpb.WatchStatsResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	// Get watch statistics
	stats, err := s.playbackService.GetWatchStats(req.UserId, req.TimePeriod)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get watch stats: %v", err)
	}

	response := &playbackpb.WatchStatsResponse{
		TotalWatchTimeMinutes: int32(stats.TotalWatchTime / 60), // Convert seconds to minutes
		MoviesWatched:         int32(stats.MoviesWatched),
		EpisodesWatched:       int32(stats.EpisodesWatched),
		FavoriteGenres:        stats.FavoriteGenres,
		WatchStreakDays:       int32(stats.WatchStreak),
		AvgSessionDuration:    stats.AvgSessionDuration,
	}

	// Convert genre breakdown
	for genre, count := range stats.GenreBreakdown {
		genreStats := &playbackpb.GenreStats{
			Genre:        genre,
			Count:        int32(count),
			TotalMinutes: int32(stats.GenreWatchTime[genre] / 60),
		}
		response.GenreBreakdown = append(response.GenreBreakdown, genreStats)
	}

	return response, nil
}

func (s *PlaybackServiceServer) GetContinueWatching(ctx context.Context, req *playbackpb.ContinueWatchingRequest) (*playbackpb.ContinueWatchingResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	limit := int(req.Limit)
	if limit <= 0 {
		limit = 10
	}

	// Get continue watching items
	items, err := s.playbackService.GetContinueWatching(req.UserId, limit)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get continue watching: %v", err)
	}

	response := &playbackpb.ContinueWatchingResponse{}

	for _, item := range items {
		media, err := s.mediaService.GetMediaByID(item.MediaID)
		if err != nil {
			continue
		}

		continueItem := &playbackpb.ContinueWatchingItem{
			Media:         s.convertMediaToProto(media),
			Progress:      float64(item.Progress) / float64(media.Duration),
			LastWatched:   timestamppb.New(item.LastWatched),
			RemainingTime: float64(media.Duration - item.Progress),
		}

		response.Items = append(response.Items, continueItem)
	}

	return response, nil
}

func (s *PlaybackServiceServer) GetRecentlyWatched(ctx context.Context, req *playbackpb.RecentlyWatchedRequest) (*playbackpb.RecentlyWatchedResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	limit := int(req.Limit)
	if limit <= 0 {
		limit = 20
	}

	// Get recently watched items
	items, err := s.playbackService.GetRecentlyWatched(req.UserId, limit)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get recently watched: %v", err)
	}

	response := &playbackpb.RecentlyWatchedResponse{}

	for _, item := range items {
		media, err := s.mediaService.GetMediaByID(item.MediaID)
		if err != nil {
			continue
		}

		recentItem := &playbackpb.RecentlyWatchedItem{
			Media:     s.convertMediaToProto(media),
			WatchedAt: timestamppb.New(item.WatchedAt),
			Completed: item.Completed,
		}

		response.Items = append(response.Items, recentItem)
	}

	return response, nil
}

func (s *PlaybackServiceServer) AddToMyList(ctx context.Context, req *playbackpb.MyListRequest) (*playbackpb.MyListResponse, error) {
	if req.UserId == "" || req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID and media UUID are required")
	}

	err := s.playbackService.AddToMyList(req.UserId, req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to add to my list: %v", err)
	}

	return &playbackpb.MyListResponse{
		Success: true,
		Message: "Added to my list successfully",
	}, nil
}

func (s *PlaybackServiceServer) RemoveFromMyList(ctx context.Context, req *playbackpb.MyListRequest) (*playbackpb.MyListResponse, error) {
	if req.UserId == "" || req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID and media UUID are required")
	}

	err := s.playbackService.RemoveFromMyList(req.UserId, req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to remove from my list: %v", err)
	}

	return &playbackpb.MyListResponse{
		Success: true,
		Message: "Removed from my list successfully",
	}, nil
}

func (s *PlaybackServiceServer) GetMyList(ctx context.Context, req *playbackpb.GetMyListRequest) (*playbackpb.GetMyListResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	limit := int(req.Limit)
	if limit <= 0 {
		limit = 50
	}
	offset := int(req.Offset)

	// Get my list items
	items, total, err := s.playbackService.GetMyList(req.UserId, limit, offset)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get my list: %v", err)
	}

	response := &playbackpb.GetMyListResponse{
		Total: int32(total),
	}

	for _, item := range items {
		media, err := s.mediaService.GetMediaByID(item.MediaID)
		if err != nil {
			continue
		}

		myListItem := &playbackpb.MyListItem{
			Media:   s.convertMediaToProto(media),
			AddedAt: timestamppb.New(item.CreatedAt),
		}

		response.Items = append(response.Items, myListItem)
	}

	return response, nil
}

func (s *PlaybackServiceServer) CheckMyList(ctx context.Context, req *playbackpb.MyListRequest) (*playbackpb.MyListCheckResponse, error) {
	if req.UserId == "" || req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID and media UUID are required")
	}

	inList, addedAt, err := s.playbackService.CheckMyList(req.UserId, req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check my list: %v", err)
	}

	response := &playbackpb.MyListCheckResponse{
		InList: inList,
	}

	if inList && addedAt != nil {
		response.AddedAt = timestamppb.New(*addedAt)
	}

	return response, nil
}

func (s *PlaybackServiceServer) SyncPlayback(stream playbackpb.PlaybackService_SyncPlaybackServer) error {
	for {
		sync, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to receive playback sync: %v", err)
		}

		// Process playback sync
		err = s.playbackService.SyncPlayback(sync.UserId, sync.MediaUuid, sync.CurrentTime, sync.Action)

		response := &playbackpb.PlaybackSyncResponse{
			SessionId:  sync.SessionId,
			Success:    err == nil,
			SyncedTime: sync.CurrentTime,
			Timestamp:  timestamppb.Now(),
		}

		if err != nil {
			response.Message = err.Error()
		} else {
			response.Message = "Playback synced successfully"
		}

		if err := stream.Send(response); err != nil {
			return status.Errorf(codes.Internal, "failed to send sync response: %v", err)
		}
	}
}

// Helper function to convert media model to proto (simplified version)
func (s *PlaybackServiceServer) convertMediaToProto(media *models.Media) *mediapb.Media {
	if media == nil {
		return nil
	}

	return &mediapb.Media{
		Id:            uint32(media.ID),
		Uuid:          media.UUID,
		Title:         media.Title,
		Type:          media.Type,
		Duration:      int32(media.Duration),
		ThumbnailPath: media.ThumbnailPath,
		PosterPath:    media.PosterPath,
		Rating:        media.Rating,
		Year:          int32(media.Year),
	}
}