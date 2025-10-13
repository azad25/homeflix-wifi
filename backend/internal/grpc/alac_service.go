package grpc

import (
	"context"
	"os"
	"path/filepath"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	pb "homeflix-backend/proto"
	"homeflix-backend/internal/services"
)

type ALACAudioServiceServer struct {
	streamingpb.UnimplementedALACAudioServiceServer
	alacService  *services.ALACAudioService
	mediaService *services.MediaService
}

func NewALACAudioServiceServer(
	alacService *services.ALACAudioService,
	mediaService *services.MediaService,
) *ALACAudioServiceServer {
	return &ALACAudioServiceServer{
		alacService:  alacService,
		mediaService: mediaService,
	}
}

func (s *ALACAudioServiceServer) GetALACAudio(req *streamingpb.ALACRequest, stream streamingpb.ALACAudioService_GetALACAudioServer) error {
	if req.MediaUuid == "" {
		return status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Get ALAC audio path
	alacPath, err := s.alacService.GetALACPath(media.FilePath)
	if err != nil {
		return status.Errorf(codes.NotFound, "ALAC audio not available: %v", err)
	}

	// Check if ALAC file exists
	if _, err := os.Stat(alacPath); os.IsNotExist(err) {
		return status.Error(codes.NotFound, "ALAC audio file not found")
	}

	// Stream the ALAC file
	return s.streamAudioFile(alacPath, stream.Send, stream.Context())
}

func (s *ALACAudioServiceServer) ExtractALACAudio(ctx context.Context, req *streamingpb.ExtractALACRequest) (*streamingpb.ExtractALACResponse, error) {
	if req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Start ALAC extraction
	taskID, err := s.alacService.ExtractALACAudio(media.FilePath, req.OutputFormat, int(req.Quality))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to start ALAC extraction: %v", err)
	}

	return &streamingpb.ExtractALACResponse{
		TaskId:  taskID,
		Success: true,
		Message: "ALAC extraction started",
	}, nil
}

func (s *ALACAudioServiceServer) GetALACMetadata(ctx context.Context, req *streamingpb.ALACRequest) (*streamingpb.ALACMetadata, error) {
	if req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Get ALAC metadata
	metadata, err := s.alacService.GetALACMetadata(media.FilePath)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get ALAC metadata: %v", err)
	}

	return &streamingpb.ALACMetadata{
		Format:       metadata.Format,
		SampleRate:   int32(metadata.SampleRate),
		BitDepth:     int32(metadata.BitDepth),
		Channels:     int32(metadata.Channels),
		Duration:     metadata.Duration,
		FileSize:     metadata.FileSize,
		SpatialAudio: metadata.SpatialAudio,
		Layout:       metadata.Layout,
		Bitrate:      int32(metadata.Bitrate),
	}, nil
}

func (s *ALACAudioServiceServer) ConvertToSpatialAudio(ctx context.Context, req *streamingpb.SpatialAudioRequest) (*streamingpb.SpatialAudioResponse, error) {
	if req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID is required")
	}

	if req.Layout == "" {
		return nil, status.Error(codes.InvalidArgument, "spatial audio layout is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Start spatial audio conversion
	taskID, err := s.alacService.ConvertToSpatialAudio(media.FilePath, req.Layout)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to start spatial audio conversion: %v", err)
	}

	return &streamingpb.SpatialAudioResponse{
		TaskId:  taskID,
		Success: true,
		Message: "Spatial audio conversion started",
	}, nil
}

func (s *ALACAudioServiceServer) GetSupportedFormats(ctx context.Context, req *emptypb.Empty) (*streamingpb.SupportedFormatsResponse, error) {
	formats, codecs := s.alacService.GetSupportedFormats()

	return &streamingpb.SupportedFormatsResponse{
		Formats: formats,
		Codecs:  codecs,
	}, nil
}

func (s *ALACAudioServiceServer) GetAudioFileInfo(ctx context.Context, req *streamingpb.ALACRequest) (*streamingpb.ALACMetadata, error) {
	if req.MediaUuid == "" {
		return nil, status.Error(codes.InvalidArgument, "media UUID is required")
	}

	// Get media information
	media, err := s.mediaService.GetMediaByUUID(req.MediaUuid)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "media not found: %v", err)
	}

	// Get detailed audio file information
	info, err := s.alacService.GetAudioFileInfo(media.FilePath)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get audio file info: %v", err)
	}

	return &streamingpb.ALACMetadata{
		Format:       info.Format,
		SampleRate:   int32(info.SampleRate),
		BitDepth:     int32(info.BitDepth),
		Channels:     int32(info.Channels),
		Duration:     info.Duration,
		FileSize:     info.FileSize,
		SpatialAudio: info.SpatialAudio,
		Layout:       info.Layout,
		Bitrate:      int32(info.Bitrate),
	}, nil
}

// Helper function to stream audio file
func (s *ALACAudioServiceServer) streamAudioFile(filePath string, sendFunc func(*streamingpb.StreamChunk) error, ctx context.Context) error {
	file, err := os.Open(filePath)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open audio file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get file info: %v", err)
	}

	totalSize := fileInfo.Size()
	chunkSize := int64(64 * 1024) // 64KB chunks for audio
	totalChunks := (totalSize + chunkSize - 1) / chunkSize

	buffer := make([]byte, chunkSize)
	chunkIndex := int64(0)

	for {
		n, err := file.Read(buffer)
		if n == 0 {
			break
		}
		if err != nil && err.Error() != "EOF" {
			return status.Errorf(codes.Internal, "failed to read audio file: %v", err)
		}

		chunk := &streamingpb.StreamChunk{
			Data:        buffer[:n],
			ChunkIndex:  chunkIndex,
			TotalChunks: totalChunks,
			ContentType: s.getAudioContentType(filePath),
			TotalSize:   totalSize,
		}

		if err := sendFunc(chunk); err != nil {
			return status.Errorf(codes.Internal, "failed to send audio chunk: %v", err)
		}

		chunkIndex++

		// Check if client disconnected
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if n < int(chunkSize) {
			break
		}
	}

	return nil
}

func (s *ALACAudioServiceServer) getAudioContentType(filePath string) string {
	ext := filepath.Ext(filePath)
	switch ext {
	case ".m4a":
		return "audio/mp4"
	case ".alac":
		return "audio/alac"
	case ".flac":
		return "audio/flac"
	case ".wav":
		return "audio/wav"
	case ".aac":
		return "audio/aac"
	default:
		return "audio/mpeg"
	}
}