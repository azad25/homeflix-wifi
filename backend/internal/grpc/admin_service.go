package grpc

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "homeflix-backend/proto"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"
)

type AdminServiceServer struct {
	pb.UnimplementedAdminServiceServer
	mediaScanner     *scanner.MediaScanner
	thumbnailService *services.ThumbnailService
	watcherService   *services.WatcherService
	celeryService    *services.CeleryService
}

func NewAdminServiceServer(
	mediaScanner *scanner.MediaScanner,
	thumbnailService *services.ThumbnailService,
	watcherService *services.WatcherService,
	celeryService *services.CeleryService,
) *AdminServiceServer {
	return &AdminServiceServer{
		mediaScanner:     mediaScanner,
		thumbnailService: thumbnailService,
		watcherService:   watcherService,
		celeryService:    celeryService,
	}
}

func (s *AdminServiceServer) StartFullScan(req *adminpb.ScanRequest, stream adminpb.AdminService_StartFullScanServer) error {
	scanID := generateScanID()
	
	// Send initial progress
	progress := &adminpb.ScanProgress{
		ScanId:             scanID,
		Status:             adminpb.ScanProgress_STARTED,
		TotalFiles:         0,
		ProcessedFiles:     0,
		FailedFiles:        0,
		ProgressPercentage: 0.0,
		Message:            "Starting full media scan...",
		Timestamp:          timestamppb.Now(),
	}

	if err := stream.Send(progress); err != nil {
		return status.Errorf(codes.Internal, "failed to send scan progress: %v", err)
	}

	// Configure scanner
	if req.MaxWorkers > 0 {
		s.mediaScanner.SetMaxWorkers(int(req.MaxWorkers))
	}
	if req.BatchSize > 0 {
		s.mediaScanner.SetBatchSize(int(req.BatchSize))
	}

	// Start scan with progress callback
	progressCallback := func(current, total, failed int, currentFile, message string) {
		progressPercent := 0.0
		if total > 0 {
			progressPercent = float64(current) / float64(total) * 100.0
		}

		progress := &adminpb.ScanProgress{
			ScanId:             scanID,
			Status:             adminpb.ScanProgress_SCANNING,
			TotalFiles:         int32(total),
			ProcessedFiles:     int32(current),
			FailedFiles:        int32(failed),
			CurrentFile:        currentFile,
			ProgressPercentage: progressPercent,
			Message:            message,
			Timestamp:          timestamppb.Now(),
		}

		stream.Send(progress)
	}

	// Execute scan
	err := s.mediaScanner.StartFullScanWithCallback(req.Paths, progressCallback)
	
	// Send final progress
	finalStatus := adminpb.ScanProgress_COMPLETED
	finalMessage := "Full scan completed successfully"
	if err != nil {
		finalStatus = adminpb.ScanProgress_FAILED
		finalMessage = err.Error()
	}

	finalProgress := &adminpb.ScanProgress{
		ScanId:             scanID,
		Status:             finalStatus,
		ProgressPercentage: 100.0,
		Message:            finalMessage,
		Timestamp:          timestamppb.Now(),
	}

	return stream.Send(finalProgress)
}

func (s *AdminServiceServer) StartIncrementalScan(req *adminpb.ScanRequest, stream adminpb.AdminService_StartIncrementalScanServer) error {
	scanID := generateScanID()
	
	progress := &adminpb.ScanProgress{
		ScanId:    scanID,
		Status:    adminpb.ScanProgress_STARTED,
		Message:   "Starting incremental scan...",
		Timestamp: timestamppb.Now(),
	}

	if err := stream.Send(progress); err != nil {
		return status.Errorf(codes.Internal, "failed to send scan progress: %v", err)
	}

	// Progress callback
	progressCallback := func(current, total, failed int, currentFile, message string) {
		progressPercent := 0.0
		if total > 0 {
			progressPercent = float64(current) / float64(total) * 100.0
		}

		progress := &adminpb.ScanProgress{
			ScanId:             scanID,
			Status:             adminpb.ScanProgress_SCANNING,
			TotalFiles:         int32(total),
			ProcessedFiles:     int32(current),
			FailedFiles:        int32(failed),
			CurrentFile:        currentFile,
			ProgressPercentage: progressPercent,
			Message:            message,
			Timestamp:          timestamppb.Now(),
		}
		stream.Send(progress)
	}

	// Execute incremental scan
	err := s.mediaScanner.StartIncrementalScanWithCallback(progressCallback)
	
	finalStatus := adminpb.ScanProgress_COMPLETED
	finalMessage := "Incremental scan completed successfully"
	if err != nil {
		finalStatus = adminpb.ScanProgress_FAILED
		finalMessage = err.Error()
	}

	finalProgress := &adminpb.ScanProgress{
		ScanId:             scanID,
		Status:             finalStatus,
		ProgressPercentage: 100.0,
		Message:            finalMessage,
		Timestamp:          timestamppb.Now(),
	}

	return stream.Send(finalProgress)
}

func (s *AdminServiceServer) StartSuperfastScan(req *adminpb.ScanRequest, stream adminpb.AdminService_StartSuperfastScanServer) error {
	scanID := generateScanID()
	
	progress := &adminpb.ScanProgress{
		ScanId:    scanID,
		Status:    adminpb.ScanProgress_STARTED,
		Message:   "Starting superfast scan...",
		Timestamp: timestamppb.Now(),
	}

	if err := stream.Send(progress); err != nil {
		return status.Errorf(codes.Internal, "failed to send scan progress: %v", err)
	}

	// Execute superfast scan
	err := s.mediaScanner.StartSuperfastScan()
	
	finalStatus := adminpb.ScanProgress_COMPLETED
	finalMessage := "Superfast scan completed successfully"
	if err != nil {
		finalStatus = adminpb.ScanProgress_FAILED
		finalMessage = err.Error()
	}

	finalProgress := &adminpb.ScanProgress{
		ScanId:             scanID,
		Status:             finalStatus,
		ProgressPercentage: 100.0,
		Message:            finalMessage,
		Timestamp:          timestamppb.Now(),
	}

	return stream.Send(finalProgress)
}

func (s *AdminServiceServer) GetScanStats(ctx context.Context, req *emptypb.Empty) (*adminpb.ScanStats, error) {
	stats, err := s.mediaScanner.GetStats()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get scan stats: %v", err)
	}

	return &adminpb.ScanStats{
		TotalMedia:           int32(stats.TotalMedia),
		Movies:               int32(stats.Movies),
		TvShows:              int32(stats.TVShows),
		Episodes:             int32(stats.Episodes),
		TotalSize:            stats.TotalSize,
		LastScan:             timestamppb.New(stats.LastScan),
		ScanDurationSeconds:  int32(stats.ScanDuration.Seconds()),
		RecentErrors:         stats.RecentErrors,
	}, nil
}

func (s *AdminServiceServer) GenerateThumbnails(req *adminpb.AssetRequest, stream adminpb.AdminService_GenerateThumbnailsServer) error {
	if len(req.MediaUuids) == 0 {
		return status.Error(codes.InvalidArgument, "media UUIDs are required")
	}

	taskID := generateTaskID()
	
	// Send initial progress
	progress := &adminpb.AssetProgress{
		TaskId:             taskID,
		Status:             adminpb.AssetProgress_STARTED,
		AssetType:          req.AssetType,
		ProgressPercentage: 0.0,
		Message:            "Starting thumbnail generation...",
		Timestamp:          timestamppb.Now(),
	}

	if err := stream.Send(progress); err != nil {
		return status.Errorf(codes.Internal, "failed to send asset progress: %v", err)
	}

	// Process each media UUID
	total := len(req.MediaUuids)
	for i, mediaUUID := range req.MediaUuids {
		// Generate thumbnail
		assetPath, err := s.thumbnailService.GenerateThumbnail(mediaUUID, req.ForceRegenerate)
		
		status := adminpb.AssetProgress_PROCESSING
		message := "Generating thumbnail..."
		errorMsg := ""
		
		if err != nil {
			status = adminpb.AssetProgress_FAILED
			errorMsg = err.Error()
			message = "Failed to generate thumbnail"
		} else {
			status = adminpb.AssetProgress_COMPLETED
			message = "Thumbnail generated successfully"
		}

		progress := &adminpb.AssetProgress{
			TaskId:             taskID,
			Status:             status,
			MediaUuid:          mediaUUID,
			AssetType:          req.AssetType,
			AssetPath:          assetPath,
			ProgressPercentage: float64(i+1) / float64(total) * 100.0,
			Message:            message,
			Error:              errorMsg,
			Timestamp:          timestamppb.Now(),
		}

		if err := stream.Send(progress); err != nil {
			return status.Errorf(codes.Internal, "failed to send asset progress: %v", err)
		}
	}

	return nil
}

func (s *AdminServiceServer) GeneratePreviewClips(req *adminpb.AssetRequest, stream adminpb.AdminService_GeneratePreviewClipsServer) error {
	if len(req.MediaUuids) == 0 {
		return status.Error(codes.InvalidArgument, "media UUIDs are required")
	}

	taskID := generateTaskID()
	
	// Process each media UUID for preview clip generation
	total := len(req.MediaUuids)
	for i, mediaUUID := range req.MediaUuids {
		progress := &adminpb.AssetProgress{
			TaskId:             taskID,
			Status:             adminpb.AssetProgress_PROCESSING,
			MediaUuid:          mediaUUID,
			AssetType:          "preview_clips",
			ProgressPercentage: float64(i) / float64(total) * 100.0,
			Message:            "Generating preview clip...",
			Timestamp:          timestamppb.Now(),
		}

		if err := stream.Send(progress); err != nil {
			return status.Errorf(codes.Internal, "failed to send asset progress: %v", err)
		}

		// Generate preview clip
		assetPath, err := s.thumbnailService.GeneratePreviewClip(mediaUUID, req.ForceRegenerate)
		
		if err != nil {
			progress.Status = adminpb.AssetProgress_FAILED
			progress.Error = err.Error()
			progress.Message = "Failed to generate preview clip"
		} else {
			progress.Status = adminpb.AssetProgress_COMPLETED
			progress.AssetPath = assetPath
			progress.Message = "Preview clip generated successfully"
		}

		progress.ProgressPercentage = float64(i+1) / float64(total) * 100.0
		progress.Timestamp = timestamppb.Now()

		if err := stream.Send(progress); err != nil {
			return status.Errorf(codes.Internal, "failed to send asset progress: %v", err)
		}
	}

	return nil
}

func (s *AdminServiceServer) RegenerateAssets(req *adminpb.AssetRequest, stream adminpb.AdminService_RegenerateAssetsServer) error {
	// This would regenerate all assets (thumbnails, previews, posters)
	taskID := generateTaskID()
	
	progress := &adminpb.AssetProgress{
		TaskId:    taskID,
		Status:    adminpb.AssetProgress_STARTED,
		AssetType: "all",
		Message:   "Starting asset regeneration...",
		Timestamp: timestamppb.Now(),
	}

	if err := stream.Send(progress); err != nil {
		return status.Errorf(codes.Internal, "failed to send asset progress: %v", err)
	}

	// Execute asset regeneration
	err := s.thumbnailService.RegenerateAllAssets(req.MediaUuids, req.ForceRegenerate)
	
	finalStatus := adminpb.AssetProgress_COMPLETED
	finalMessage := "Asset regeneration completed successfully"
	if err != nil {
		finalStatus = adminpb.AssetProgress_FAILED
		finalMessage = err.Error()
	}

	finalProgress := &adminpb.AssetProgress{
		TaskId:             taskID,
		Status:             finalStatus,
		ProgressPercentage: 100.0,
		Message:            finalMessage,
		Timestamp:          timestamppb.Now(),
	}

	return stream.Send(finalProgress)
}

func (s *AdminServiceServer) StartFileWatcher(ctx context.Context, req *adminpb.WatcherRequest) (*adminpb.WatcherResponse, error) {
	err := s.watcherService.Start(req.WatchPaths, req.Recursive, req.FileExtensions)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to start file watcher: %v", err)
	}

	return &adminpb.WatcherResponse{
		Success:      true,
		Message:      "File watcher started successfully",
		PathsWatched: int32(len(req.WatchPaths)),
	}, nil
}

func (s *AdminServiceServer) StopFileWatcher(ctx context.Context, req *emptypb.Empty) (*adminpb.WatcherResponse, error) {
	err := s.watcherService.Stop()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to stop file watcher: %v", err)
	}

	return &adminpb.WatcherResponse{
		Success: true,
		Message: "File watcher stopped successfully",
	}, nil
}

func (s *AdminServiceServer) GetWatcherStatus(ctx context.Context, req *emptypb.Empty) (*adminpb.WatcherStatus, error) {
	status := s.watcherService.GetStatus()

	return &adminpb.WatcherStatus{
		Active:           status.Active,
		WatchedPaths:     status.WatchedPaths,
		FilesWatched:     int32(status.FilesWatched),
		EventsProcessed:  int32(status.EventsProcessed),
		LastEvent:        timestamppb.New(status.LastEvent),
	}, nil
}

func (s *AdminServiceServer) WatchFileEvents(req *emptypb.Empty, stream adminpb.AdminService_WatchFileEventsServer) error {
	// This would connect to the file watcher's event stream
	eventChan := s.watcherService.GetEventChannel()
	
	for {
		select {
		case event := <-eventChan:
			fileEvent := &adminpb.FileEvent{
				Type:        s.convertEventType(event.Type),
				FilePath:    event.FilePath,
				OldPath:     event.OldPath,
				Timestamp:   timestamppb.New(event.Timestamp),
				IsDirectory: event.IsDirectory,
			}

			if err := stream.Send(fileEvent); err != nil {
				return status.Errorf(codes.Internal, "failed to send file event: %v", err)
			}

		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
}

func (s *AdminServiceServer) GetSystemStats(ctx context.Context, req *emptypb.Empty) (*adminpb.SystemStats, error) {
	// Get system statistics
	stats, err := s.getSystemStatistics()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get system stats: %v", err)
	}

	return stats, nil
}

func (s *AdminServiceServer) WatchSystemHealth(req *emptypb.Empty, stream adminpb.AdminService_WatchSystemHealthServer) error {
	ticker := time.NewTicker(30 * time.Second) // Send health updates every 30 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			stats, err := s.getSystemStatistics()
			if err != nil {
				continue
			}

			healthStatus := adminpb.HealthUpdate_HEALTHY
			message := "System is healthy"

			// Check for warning conditions
			if stats.Memory.UsagePercentage > 80 {
				healthStatus = adminpb.HealthUpdate_WARNING
				message = "High memory usage detected"
			}
			if stats.Disk.UsagePercentage > 90 {
				healthStatus = adminpb.HealthUpdate_CRITICAL
				message = "Critical disk space usage"
			}

			healthUpdate := &adminpb.HealthUpdate{
				Status:    healthStatus,
				Service:   "homeflix-backend",
				Message:   message,
				Stats:     stats,
				Timestamp: timestamppb.Now(),
			}

			if err := stream.Send(healthUpdate); err != nil {
				return status.Errorf(codes.Internal, "failed to send health update: %v", err)
			}

		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
}

func (s *AdminServiceServer) GetQueueStatus(ctx context.Context, req *emptypb.Empty) (*adminpb.QueueStatusResponse, error) {
	if s.celeryService == nil {
		return nil, status.Error(codes.Unimplemented, "celery service not available")
	}

	queues, err := s.celeryService.GetQueueStatus()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get queue status: %v", err)
	}

	response := &adminpb.QueueStatusResponse{
		Timestamp: timestamppb.Now(),
	}

	for _, queue := range queues {
		queueInfo := &adminpb.QueueInfo{
			Name:         queue.Name,
			Length:       int32(queue.Length),
			Workers:      int32(queue.Workers),
			Processed:    int32(queue.Processed),
			Failed:       int32(queue.Failed),
			LastActivity: timestamppb.New(queue.LastActivity),
		}
		response.Queues = append(response.Queues, queueInfo)
	}

	return response, nil
}

func (s *AdminServiceServer) PurgeQueue(ctx context.Context, req *adminpb.PurgeQueueRequest) (*adminpb.PurgeQueueResponse, error) {
	if s.celeryService == nil {
		return nil, status.Error(codes.Unimplemented, "celery service not available")
	}

	tasksPurged, err := s.celeryService.PurgeQueue(req.QueueName)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to purge queue: %v", err)
	}

	return &adminpb.PurgeQueueResponse{
		Success:     true,
		TasksPurged: int32(tasksPurged),
		Message:     "Queue purged successfully",
	}, nil
}

func (s *AdminServiceServer) WatchQueueMetrics(req *emptypb.Empty, stream adminpb.AdminService_WatchQueueMetricsServer) error {
	ticker := time.NewTicker(10 * time.Second) // Send metrics every 10 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Get preview queue metrics
			previewQueueStatus := s.getPreviewQueueMetrics()
			
			previewMetric := &adminpb.QueueMetrics{
				QueueName:           "preview_generation",
				PendingTasks:        int32(previewQueueStatus["queued"].(int)),
				ActiveTasks:         int32(previewQueueStatus["processing"].(int)),
				CompletedTasks:      int32(previewQueueStatus["completed"].(int)),
				FailedTasks:         int32(previewQueueStatus["failed"].(int)),
				AvgProcessingTime:   120.0, // Average 2 minutes per preview
				Timestamp:           timestamppb.Now(),
			}

			if err := stream.Send(previewMetric); err != nil {
				return status.Errorf(codes.Internal, "failed to send preview queue metrics: %v", err)
			}

			// Get Celery queue metrics if available
			if s.celeryService != nil {
				metrics, err := s.celeryService.GetQueueMetrics()
				if err == nil {
					for _, metric := range metrics {
						queueMetric := &adminpb.QueueMetrics{
							QueueName:           metric.QueueName,
							PendingTasks:        int32(metric.PendingTasks),
							ActiveTasks:         int32(metric.ActiveTasks),
							CompletedTasks:      int32(metric.CompletedTasks),
							FailedTasks:         int32(metric.FailedTasks),
							AvgProcessingTime:   metric.AvgProcessingTime,
							Timestamp:           timestamppb.Now(),
						}

						if err := stream.Send(queueMetric); err != nil {
							return status.Errorf(codes.Internal, "failed to send queue metrics: %v", err)
						}
					}
				}
			}

		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
}

func (s *AdminServiceServer) getPreviewQueueMetrics() map[string]interface{} {
	// This would get metrics from the streaming service's preview queue
	// For now, return mock data - in real implementation, this would call
	// the streaming service's GetQueueStatus method
	return map[string]interface{}{
		"queued":     5,
		"processing": 2,
		"completed":  150,
		"failed":     3,
		"workers":    3,
	}
}

// Helper functions
func generateScanID() string {
	return "scan_" + time.Now().Format("20060102_150405")
}

func generateTaskID() string {
	return "task_" + time.Now().Format("20060102_150405")
}

func (s *AdminServiceServer) convertEventType(eventType string) adminpb.FileEvent_EventType {
	switch eventType {
	case "CREATE":
		return adminpb.FileEvent_CREATED
	case "MODIFY":
		return adminpb.FileEvent_MODIFIED
	case "DELETE":
		return adminpb.FileEvent_DELETED
	case "MOVE":
		return adminpb.FileEvent_MOVED
	default:
		return adminpb.FileEvent_MODIFIED
	}
}

func (s *AdminServiceServer) getSystemStatistics() (*adminpb.SystemStats, error) {
	// This would typically use a system monitoring library
	// For now, return mock data
	return &adminpb.SystemStats{
		Cpu: &adminpb.CpuStats{
			UsagePercentage: 25.5,
			Cores:           8,
			LoadAverage:     1.2,
		},
		Memory: &adminpb.MemoryStats{
			TotalBytes:      16 * 1024 * 1024 * 1024, // 16GB
			UsedBytes:       8 * 1024 * 1024 * 1024,  // 8GB
			FreeBytes:       8 * 1024 * 1024 * 1024,  // 8GB
			UsagePercentage: 50.0,
		},
		Disk: &adminpb.DiskStats{
			TotalBytes:      1024 * 1024 * 1024 * 1024, // 1TB
			UsedBytes:       512 * 1024 * 1024 * 1024,  // 512GB
			FreeBytes:       512 * 1024 * 1024 * 1024,  // 512GB
			UsagePercentage: 50.0,
			MountPoint:      "/",
		},
		Network: &adminpb.NetworkStats{
			BytesSent:     1024 * 1024 * 100, // 100MB
			BytesReceived: 1024 * 1024 * 200, // 200MB
			PacketsSent:   10000,
			PacketsReceived: 15000,
		},
		Services: &adminpb.ServiceStats{
			ActiveStreams:     5,
			ConcurrentUsers:   25,
			QueueLength:       10,
			AvgResponseTime:   150.5,
		},
		Timestamp: timestamppb.Now(),
	}, nil
}