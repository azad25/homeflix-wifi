package grpc

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "homeflix-backend/proto"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

type RecommendationServiceServer struct {
	pb.UnimplementedRecommendationServiceServer
	recommendationService *services.RecommendationService
	mediaService          *services.MediaService
}

func NewRecommendationServiceServer(
	recommendationService *services.RecommendationService,
	mediaService *services.MediaService,
) *RecommendationServiceServer {
	return &RecommendationServiceServer{
		recommendationService: recommendationService,
		mediaService:          mediaService,
	}
}

func (s *RecommendationServiceServer) GetRecommendations(ctx context.Context, req *recommendationspb.RecommendationRequest) (*recommendationspb.RecommendationResponse, error) {
	if req.Limit <= 0 {
		req.Limit = 20
	}

	// Get recommendations from service
	recommendations, err := s.recommendationService.GetRecommendationsByCategory(req.Category, req.UserId, int(req.Limit))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get recommendations: %v", err)
	}

	response := &recommendationspb.RecommendationResponse{
		Category:    req.Category,
		Total:       int32(len(recommendations)),
		GeneratedAt: timestamppb.Now(),
	}

	// Convert recommendations to proto format
	for _, rec := range recommendations {
		// Get media details
		media, err := s.mediaService.GetMediaByID(rec.MediaID)
		if err != nil {
			continue // Skip if media not found
		}

		scoredMedia := &recommendationspb.ScoredMedia{
			Media:    s.convertMediaToProto(media),
			Score:    float64(rec.Score),
			Reason:   rec.Reason,
			Category: rec.Category,
		}

		response.Recommendations = append(response.Recommendations, scoredMedia)
	}

	return response, nil
}

func (s *RecommendationServiceServer) WatchRecommendations(req *recommendationspb.RecommendationRequest, stream recommendationspb.RecommendationService_WatchRecommendationsServer) error {
	// This would typically connect to a real-time recommendation system
	// For now, we'll implement a simple polling mechanism
	
	// Send initial recommendations
	initialResp, err := s.GetRecommendations(stream.Context(), req)
	if err != nil {
		return err
	}

	update := &recommendationspb.RecommendationUpdate{
		Type:            recommendationspb.RecommendationUpdate_NEW_RECOMMENDATIONS,
		Recommendations: initialResp.Recommendations,
		Category:        req.Category,
		Timestamp:       timestamppb.Now(),
	}

	if err := stream.Send(update); err != nil {
		return status.Errorf(codes.Internal, "failed to send recommendation update: %v", err)
	}

	// Keep connection alive and send updates periodically
	// In a real implementation, this would listen to a message queue or event stream
	<-stream.Context().Done()
	return stream.Context().Err()
}

func (s *RecommendationServiceServer) GetTrendingRecommendations(ctx context.Context, req *recommendationspb.TrendingRequest) (*recommendationspb.RecommendationResponse, error) {
	if req.Limit <= 0 {
		req.Limit = 20
	}

	// Get trending content
	trending, err := s.recommendationService.GetTrendingContent(int(req.Limit), req.TimeWindow)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get trending recommendations: %v", err)
	}

	response := &recommendationspb.RecommendationResponse{
		Category:    "trending",
		Total:       int32(len(trending)),
		GeneratedAt: timestamppb.Now(),
	}

	for _, media := range trending {
		scoredMedia := &recommendationspb.ScoredMedia{
			Media:    s.convertMediaToProto(media),
			Score:    0.9, // High score for trending content
			Reason:   "Currently trending",
			Category: "trending",
		}
		response.Recommendations = append(response.Recommendations, scoredMedia)
	}

	return response, nil
}

func (s *RecommendationServiceServer) GetPersonalizedRecommendations(ctx context.Context, req *recommendationspb.PersonalizedRequest) (*recommendationspb.RecommendationResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	if req.Limit <= 0 {
		req.Limit = 20
	}

	// Get personalized recommendations
	recommendations, err := s.recommendationService.GetPersonalizedRecommendations(req.UserId, int(req.Limit))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get personalized recommendations: %v", err)
	}

	response := &recommendationspb.RecommendationResponse{
		Category:    "personalized",
		Total:       int32(len(recommendations)),
		GeneratedAt: timestamppb.Now(),
	}

	for _, rec := range recommendations {
		media, err := s.mediaService.GetMediaByID(rec.MediaID)
		if err != nil {
			continue
		}

		scoredMedia := &recommendationspb.ScoredMedia{
			Media:    s.convertMediaToProto(media),
			Score:    float64(rec.Score),
			Reason:   rec.Reason,
			Category: "personalized",
		}
		response.Recommendations = append(response.Recommendations, scoredMedia)
	}

	return response, nil
}

func (s *RecommendationServiceServer) GetSimilarContent(ctx context.Context, req *recommendationspb.SimilarContentRequest) (*recommendationspb.RecommendationResponse, error) {
	if req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID is required")
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	// Get media by UUID first
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Get similar content
	similar, err := s.recommendationService.GetSimilarContent(media.ID, int(req.Limit))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get similar content: %v", err)
	}

	response := &recommendationspb.RecommendationResponse{
		Category:    "similar",
		Total:       int32(len(similar)),
		GeneratedAt: timestamppb.Now(),
	}

	for _, similarMedia := range similar {
		scoredMedia := &recommendationspb.ScoredMedia{
			Media:    s.convertMediaToProto(similarMedia),
			Score:    0.8, // High similarity score
			Reason:   fmt.Sprintf("Similar to %s", media.Title),
			Category: "similar",
		}
		response.Recommendations = append(response.Recommendations, scoredMedia)
	}

	return response, nil
}

func (s *RecommendationServiceServer) GetContinueWatching(ctx context.Context, req *recommendationspb.ContinueWatchingRequest) (*recommendationspb.RecommendationResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	// Get continue watching content
	continueWatching, err := s.recommendationService.GetContinueWatching(req.UserId, int(req.Limit))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get continue watching: %v", err)
	}

	response := &recommendationspb.RecommendationResponse{
		Category:    "continue_watching",
		Total:       int32(len(continueWatching)),
		GeneratedAt: timestamppb.Now(),
	}

	for _, media := range continueWatching {
		scoredMedia := &recommendationspb.ScoredMedia{
			Media:    s.convertMediaToProto(media),
			Score:    1.0, // Highest priority for continue watching
			Reason:   "Continue watching",
			Category: "continue_watching",
		}
		response.Recommendations = append(response.Recommendations, scoredMedia)
	}

	return response, nil
}

func (s *RecommendationServiceServer) TrackRecommendationClick(ctx context.Context, req *recommendationspb.TrackClickRequest) (*recommendationspb.TrackClickResponse, error) {
	if req.MediaUuid == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID and user ID are required")
	}

	// Track the click
	err := s.recommendationService.TrackRecommendationClick(req.UserId, req.MediaUuid, req.Category)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to track click: %v", err)
	}

	return &recommendationspb.TrackClickResponse{
		Success: true,
		Message: "Click tracked successfully",
	}, nil
}

func (s *RecommendationServiceServer) TrackRecommendationView(ctx context.Context, req *recommendationspb.TrackViewRequest) (*recommendationspb.TrackViewResponse, error) {
	if req.MediaUuid == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID and user ID are required")
	}

	// Track the view
	err := s.recommendationService.TrackView(req.UserId, req.MediaUuid, req.ViewDuration)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to track view: %v", err)
	}

	return &recommendationspb.TrackViewResponse{
		Success: true,
		Message: "View tracked successfully",
	}, nil
}

func (s *RecommendationServiceServer) RefreshRecommendations(ctx context.Context, req *emptypb.Empty) (*recommendationspb.RefreshResponse, error) {
	// Refresh recommendation cache
	count, err := s.recommendationService.RefreshAllRecommendations()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to refresh recommendations: %v", err)
	}

	return &recommendationspb.RefreshResponse{
		Success:                true,
		Message:                "Recommendations refreshed successfully",
		RecommendationsUpdated: int32(count),
	}, nil
}

func (s *RecommendationServiceServer) GenerateRecommendations(ctx context.Context, req *recommendationspb.GenerateRequest) (*recommendationspb.GenerateResponse, error) {
	// Generate new recommendations using AI
	taskID, err := s.recommendationService.GenerateRecommendationsAsync(req.Algorithm, req.UserIds, req.ForceRegenerate)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate recommendations: %v", err)
	}

	return &recommendationspb.GenerateResponse{
		TaskId:  taskID,
		Success: true,
		Message: "Recommendation generation started",
	}, nil
}

// Helper function to convert media model to proto
func (s *RecommendationServiceServer) convertMediaToProto(media *models.Media) *mediapb.Media {
	if media == nil {
		return nil
	}

	return &mediapb.Media{
		Id:            uint32(media.ID),
		Uuid:          media.UUID,
		Title:         media.Title,
		OriginalTitle: media.OriginalTitle,
		Type:          media.Type,
		FilePath:      media.FilePath,
		FileSize:      media.FileSize,
		Duration:      int32(media.Duration),
		Description:   media.Description,
		Year:          int32(media.Year),
		Rating:        media.Rating,
		Country:       media.Country,
		Language:      media.Language,
		Quality:       media.Quality,
		Resolution:    media.Resolution,
		Codec:         media.Codec,
		ThumbnailPath: media.ThumbnailPath,
		PosterPath:    media.PosterPath,
		ViewCount:     int32(media.ViewCount),
		CreatedAt:     timestamppb.New(media.CreatedAt),
		UpdatedAt:     timestamppb.New(media.UpdatedAt),
	}
}