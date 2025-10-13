package grpc

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "homeflix-backend/proto"
	"homeflix-backend/internal/services"
)

type StreamingServiceServer struct {
	pb.UnimplementedStreamingServiceServer
	streamService    *services.OptimizedStreamService
	mediaService     *services.MediaService
	transcodeService *services.TranscodeService
}

func NewStreamingServiceServer(
	streamService *services.OptimizedStreamService,
	mediaService *services.MediaService,
	transcodeService *services.TranscodeService,
) *StreamingServiceServer {
	return &StreamingServiceServer{
		streamService:    streamService,
		mediaService:     mediaService,
		transcodeService: transcodeService,
	}
}

const (
	ChunkSize = 1024 * 1024 // 1MB chunks for streaming
)

func (s *StreamingServiceServer) StreamVideo(req *streamingpb.StreamRequest, stream streamingpb.StreamingService_StreamVideoServer) error {
	if req.MediaUuid == "" {
		return status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Check if file exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		return status.Errorf(codes.NotFound, "media file not found: %s", media.FilePath)
	}

	// Open the file
	file, err := os.Open(media.FilePath)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open media file: %v", err)
	}
	defer file.Close()

	// Get file info
	fileInfo, err := file.Stat()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get file info: %v", err)
	}

	totalSize := fileInfo.Size()
	
	// Handle range requests
	startByte := req.StartByte
	endByte := req.EndByte
	if endByte == 0 || endByte > totalSize {
		endByte = totalSize
	}

	// Seek to start position
	if startByte > 0 {
		if _, err := file.Seek(startByte, io.SeekStart); err != nil {
			return status.Errorf(codes.Internal, "failed to seek file: %v", err)
		}
	}

	// Calculate total chunks
	contentLength := endByte - startByte
	totalChunks := (contentLength + ChunkSize - 1) / ChunkSize

	// Stream metadata
	metadata := &streamingpb.StreamMetadata{
		Codec:      media.Codec,
		Resolution: media.Resolution,
		Bitrate:    int32(media.Bitrate),
		Duration:   int32(media.Duration),
	}

	// Stream the file in chunks
	buffer := make([]byte, ChunkSize)
	chunkIndex := int64(0)
	bytesRemaining := contentLength

	for bytesRemaining > 0 {
		// Determine chunk size
		currentChunkSize := ChunkSize
		if bytesRemaining < ChunkSize {
			currentChunkSize = int(bytesRemaining)
		}

		// Read chunk
		n, err := file.Read(buffer[:currentChunkSize])
		if err != nil && err != io.EOF {
			return status.Errorf(codes.Internal, "failed to read file chunk: %v", err)
		}

		if n == 0 {
			break
		}

		// Send chunk
		chunk := &streamingpb.StreamChunk{
			Data:         buffer[:n],
			ChunkIndex:   chunkIndex,
			TotalChunks:  totalChunks,
			ContentType:  s.getContentType(media.FilePath),
			TotalSize:    totalSize,
			Metadata:     metadata,
		}

		if err := stream.Send(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send chunk: %v", err)
		}

		chunkIndex++
		bytesRemaining -= int64(n)

		// Check if client disconnected
		if stream.Context().Err() != nil {
			return stream.Context().Err()
		}
	}

	return nil
}

func (s *StreamingServiceServer) StreamAudio(req *streamingpb.StreamRequest, stream streamingpb.StreamingService_StreamAudioServer) error {
	if req.MediaUuid == "" {
		return status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	var audioPath string
	
	// Check if ALAC audio is requested and available
	if req.AlacAudio {
		alacPath := s.getALACPath(media.FilePath)
		if _, err := os.Stat(alacPath); err == nil {
			audioPath = alacPath
		} else {
			// Fall back to original file
			audioPath = media.FilePath
		}
	} else {
		audioPath = media.FilePath
	}

	// Stream audio file similar to video
	return s.streamFile(audioPath, stream.Send, stream.Context())
}

func (s *StreamingServiceServer) StreamPreviewClip(req *streamingpb.StreamRequest, stream streamingpb.StreamingService_StreamPreviewClipServer) error {
	if req.MediaUuid == "" {
		return status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Check if preview clip exists
	previewExists := false
	if media.PreviewClipPath != "" {
		if _, err := os.Stat(media.PreviewClipPath); err == nil {
			previewExists = true
		}
	}

	if !previewExists {
		// Preview doesn't exist - queue generation and return appropriate response
		return s.handleMissingPreview(req.MediaUuid, media, stream)
	}

	// Stream existing preview clip
	return s.streamFile(media.PreviewClipPath, stream.Send, stream.Context())
}

func (s *StreamingServiceServer) handleMissingPreview(mediaUUID string, media *models.Media, stream streamingpb.StreamingService_StreamPreviewClipServer) error {
	// Queue preview generation
	taskID, err := s.queuePreviewGeneration(mediaUUID, media)
	if err != nil {
		log.Printf("Failed to queue preview generation for %s: %v", mediaUUID, err)
	} else {
		log.Printf("Queued preview generation for %s (task: %s)", mediaUUID, taskID)
	}

	// Check if we have a fallback thumbnail to convert to video
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return s.streamThumbnailAsPreview(media.ThumbnailPath, stream)
		}
	}

	// Return a placeholder preview or error with generation status
	return s.streamPlaceholderPreview(mediaUUID, taskID, stream)
}

func (s *StreamingServiceServer) queuePreviewGeneration(mediaUUID string, media *models.Media) (string, error) {
	// Check if already in queue to avoid duplicates
	if s.isPreviewInQueue(mediaUUID) {
		return "", fmt.Errorf("preview generation already queued for %s", mediaUUID)
	}

	// Add to preview generation queue
	taskID := fmt.Sprintf("preview_%s_%d", mediaUUID, time.Now().Unix())
	
	// Queue the task (this would integrate with your existing task queue system)
	task := PreviewGenerationTask{
		TaskID:    taskID,
		MediaUUID: mediaUUID,
		MediaPath: media.FilePath,
		Priority:  "high", // High priority for user-requested previews
		CreatedAt: time.Now(),
	}

	// Add to queue (implement based on your queue system - Redis, database, etc.)
	err := s.addToPreviewQueue(task)
	if err != nil {
		return "", fmt.Errorf("failed to queue preview generation: %v", err)
	}

	// Start background worker if not running
	go s.processPreviewQueue()

	return taskID, nil
}

func (s *StreamingServiceServer) streamThumbnailAsPreview(thumbnailPath string, stream streamingpb.StreamingService_StreamPreviewClipServer) error {
	// Create a simple video from thumbnail as temporary preview
	// This provides immediate visual feedback while real preview generates
	
	file, err := os.Open(thumbnailPath)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open thumbnail: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get thumbnail info: %v", err)
	}

	// Stream thumbnail as fallback
	buffer := make([]byte, 64*1024) // 64KB chunks for thumbnails
	chunkIndex := int64(0)
	totalSize := fileInfo.Size()

	for {
		n, err := file.Read(buffer)
		if n == 0 {
			break
		}
		if err != nil && err.Error() != "EOF" {
			return status.Errorf(codes.Internal, "failed to read thumbnail: %v", err)
		}

		chunk := &streamingpb.StreamChunk{
			Data:        buffer[:n],
			ChunkIndex:  chunkIndex,
			TotalChunks: 1, // Single chunk for thumbnail
			ContentType: "image/jpeg",
			TotalSize:   totalSize,
			Metadata: &streamingpb.StreamMetadata{
				Resolution: "thumbnail",
				Duration:   0, // Static image
			},
		}

		if err := stream.Send(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send thumbnail chunk: %v", err)
		}

		chunkIndex++
		if n < len(buffer) {
			break
		}
	}

	return nil
}

func (s *StreamingServiceServer) streamPlaceholderPreview(mediaUUID, taskID string, stream streamingpb.StreamingService_StreamPreviewClipServer) error {
	// Send a placeholder response indicating preview is being generated
	placeholderData := []byte("Preview generation in progress...")
	
	chunk := &streamingpb.StreamChunk{
		Data:        placeholderData,
		ChunkIndex:  0,
		TotalChunks: 1,
		ContentType: "text/plain",
		TotalSize:   int64(len(placeholderData)),
		Metadata: &streamingpb.StreamMetadata{
			Resolution: "generating",
			Duration:   0,
		},
	}

	if err := stream.Send(chunk); err != nil {
		return status.Errorf(codes.Internal, "failed to send placeholder: %v", err)
	}

	return status.Errorf(codes.NotFound, "preview clip not available - generation queued (task: %s)", taskID)
}

func (s *StreamingServiceServer) StreamSubtitles(req *streamingpb.SubtitleRequest, stream streamingpb.StreamingService_StreamSubtitlesServer) error {
	if req.MediaUuid == "" {
		return status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Find subtitle file
	var subtitlePath string
	for _, subtitle := range media.Subtitles {
		if subtitle.Language == req.Language || req.Language == "" {
			subtitlePath = subtitle.FilePath
			break
		}
	}

	if subtitlePath == "" {
		return status.Error(codes.NotFound, "subtitle not found")
	}

	// Read subtitle file
	content, err := os.ReadFile(subtitlePath)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read subtitle file: %v", err)
	}

	// Send subtitle content
	chunk := &streamingpb.SubtitleChunk{
		Content:  string(content),
		Format:   req.Format,
		Language: req.Language,
	}

	return stream.Send(chunk)
}

// Bidirectional streaming for playback control
func (s *StreamingServiceServer) PlaybackSession(stream streamingpb.StreamingService_PlaybackSessionServer) error {
	for {
		// Receive command from client
		cmd, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to receive command: %v", err)
		}

		// Process command
		response := s.processPlaybackCommand(cmd)

		// Send response
		if err := stream.Send(response); err != nil {
			return status.Errorf(codes.Internal, "failed to send response: %v", err)
		}
	}
}

func (s *StreamingServiceServer) TrackProgress(stream streamingpb.StreamingService_TrackProgressServer) error {
	for {
		// Receive progress update from client
		update, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to receive progress update: %v", err)
		}

		// Process progress update
		response := s.processProgressUpdate(update)

		// Send response
		if err := stream.Send(response); err != nil {
			return status.Errorf(codes.Internal, "failed to send progress response: %v", err)
		}
	}
}

// Helper functions
func (s *StreamingServiceServer) streamFile(filePath string, sendFunc func(*streamingpb.StreamChunk) error, ctx context.Context) error {
	file, err := os.Open(filePath)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get file info: %v", err)
	}

	totalSize := fileInfo.Size()
	totalChunks := (totalSize + ChunkSize - 1) / ChunkSize

	buffer := make([]byte, ChunkSize)
	chunkIndex := int64(0)

	for {
		n, err := file.Read(buffer)
		if err == io.EOF {
			break
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to read file: %v", err)
		}

		chunk := &streamingpb.StreamChunk{
			Data:        buffer[:n],
			ChunkIndex:  chunkIndex,
			TotalChunks: totalChunks,
			ContentType: s.getContentType(filePath),
			TotalSize:   totalSize,
		}

		if err := sendFunc(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send chunk: %v", err)
		}

		chunkIndex++

		// Check if client disconnected
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}

	return nil
}

func (s *StreamingServiceServer) getContentType(filePath string) string {
	ext := filepath.Ext(filePath)
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".m4a":
		return "audio/mp4"
	case ".alac":
		return "audio/alac"
	default:
		return "application/octet-stream"
	}
}

func (s *StreamingServiceServer) getALACPath(originalPath string) string {
	dir := filepath.Dir(originalPath)
	base := filepath.Base(originalPath)
	ext := filepath.Ext(base)
	name := base[:len(base)-len(ext)]
	return filepath.Join(dir, name+"_alac.m4a")
}

func (s *StreamingServiceServer) processPlaybackCommand(cmd *streamingpb.PlaybackCommand) *streamingpb.PlaybackStatus {
	// Process different playback commands
	status := &streamingpb.PlaybackStatus{
		SessionId:   cmd.SessionId,
		MediaUuid:   cmd.MediaUuid,
		Status:      streamingpb.PlaybackStatus_PLAYING,
		Timestamp:   timestamppb.Now(),
	}

	switch cmd.Command {
	case streamingpb.PlaybackCommand_PLAY:
		status.Status = streamingpb.PlaybackStatus_PLAYING
	case streamingpb.PlaybackCommand_PAUSE:
		status.Status = streamingpb.PlaybackStatus_PAUSED
	case streamingpb.PlaybackCommand_SEEK:
		status.CurrentPosition = cmd.SeekPosition
		status.Status = streamingpb.PlaybackStatus_PLAYING
	case streamingpb.PlaybackCommand_STOP:
		status.Status = streamingpb.PlaybackStatus_ENDED
	}

	return status
}

func (s *StreamingServiceServer) processProgressUpdate(update *streamingpb.ProgressUpdate) *streamingpb.ProgressResponse {
	// Here you would typically save the progress to database
	// For now, just return success
	return &streamingpb.ProgressResponse{
		SessionId: update.SessionId,
		Success:   true,
		Message:   "Progress updated successfully",
		Timestamp: timestamppb.Now(),
	}
}