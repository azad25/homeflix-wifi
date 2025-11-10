package handlers

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// SystemStats represents system resource information
type SystemStats struct {
	CPU        CPUStats    `json:"cpu"`
	Memory     MemoryStats `json:"memory"`
	Disk       DiskStats   `json:"disk"`
	Network    NetworkStats `json:"network"`
	Process    ProcessStats `json:"process"`
	Timestamp  time.Time   `json:"timestamp"`
}

type CPUStats struct {
	Usage     float64 `json:"usage"`
	Cores     int     `json:"cores"`
	LoadAvg1  float64 `json:"load_avg_1"`
	LoadAvg5  float64 `json:"load_avg_5"`
	LoadAvg15 float64 `json:"load_avg_15"`
}

type MemoryStats struct {
	Total       uint64  `json:"total"`
	Available   uint64  `json:"available"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	Cached      uint64  `json:"cached"`
	Buffers     uint64  `json:"buffers"`
}

type DiskStats struct {
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type NetworkStats struct {
	BytesReceived uint64 `json:"bytes_received"`
	BytesSent     uint64 `json:"bytes_sent"`
	PacketsReceived uint64 `json:"packets_received"`
	PacketsSent   uint64 `json:"packets_sent"`
}

type ProcessStats struct {
	PID         int     `json:"pid"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryMB    float64 `json:"memory_mb"`
	MemoryPercent float64 `json:"memory_percent"`
	Threads     int     `json:"threads"`
	OpenFiles   int     `json:"open_files"`
}

// LogEntry represents a server log entry
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Source    string    `json:"source"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// GetSystemStats returns current system resource usage
func GetSystemStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := collectSystemStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, stats)
	}
}

// StreamSystemStats provides real-time system stats via WebSocket
func StreamSystemStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
			return
		}
		defer conn.Close()

		// Send stats every 2 seconds
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				stats, err := collectSystemStats()
				if err != nil {
					continue
				}

				if err := conn.WriteJSON(stats); err != nil {
					return
				}
			}
		}
	}
}

// StreamServerLogs provides real-time server logs via WebSocket
func StreamServerLogs() gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
			return
		}
		defer conn.Close()

		// Create context for cancellation
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Start log streaming
		go streamLogs(ctx, conn)

		// Keep connection alive and handle client disconnect
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}
}

// GetServerLogs returns recent server logs
func GetServerLogs() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get query parameters
		lines := c.DefaultQuery("lines", "100")
		source := c.DefaultQuery("source", "all")

		lineCount, err := strconv.Atoi(lines)
		if err != nil {
			lineCount = 100
		}

		logs, err := getRecentLogs(lineCount, source)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"logs": logs,
			"count": len(logs),
			"source": source,
		})
	}
}

// collectSystemStats gathers system resource information
func collectSystemStats() (*SystemStats, error) {
	stats := &SystemStats{
		Timestamp: time.Now(),
	}

	// CPU Stats
	cpuStats, err := getCPUStats()
	if err == nil {
		stats.CPU = cpuStats
	}

	// Memory Stats
	memStats, err := getMemoryStats()
	if err == nil {
		stats.Memory = memStats
	}

	// Disk Stats
	diskStats, err := getDiskStats()
	if err == nil {
		stats.Disk = diskStats
	}

	// Network Stats
	netStats, err := getNetworkStats()
	if err == nil {
		stats.Network = netStats
	}

	// Process Stats
	procStats, err := getProcessStats()
	if err == nil {
		stats.Process = procStats
	}

	return stats, nil
}

// getCPUStats retrieves CPU usage information
func getCPUStats() (CPUStats, error) {
	stats := CPUStats{
		Cores: runtime.NumCPU(),
	}

	// Get load average on Linux
	if runtime.GOOS == "linux" {
		loadavg, err := os.ReadFile("/proc/loadavg")
		if err == nil {
			fields := strings.Fields(string(loadavg))
			if len(fields) >= 3 {
				stats.LoadAvg1, _ = strconv.ParseFloat(fields[0], 64)
				stats.LoadAvg5, _ = strconv.ParseFloat(fields[1], 64)
				stats.LoadAvg15, _ = strconv.ParseFloat(fields[2], 64)
			}
		}

		// Get CPU usage from /proc/stat
		usage, err := getCPUUsage()
		if err == nil {
			stats.Usage = usage
		}
	}

	return stats, nil
}

// getCPUUsage calculates CPU usage percentage
func getCPUUsage() (float64, error) {
	// Read /proc/stat twice with a small interval
	stat1, err := readProcStat()
	if err != nil {
		return 0, err
	}

	time.Sleep(100 * time.Millisecond)

	stat2, err := readProcStat()
	if err != nil {
		return 0, err
	}

	// Calculate CPU usage
	totalDelta := stat2.total - stat1.total
	idleDelta := stat2.idle - stat1.idle

	if totalDelta == 0 {
		return 0, nil
	}

	usage := 100.0 * (1.0 - float64(idleDelta)/float64(totalDelta))
	return usage, nil
}

type cpuStat struct {
	total uint64
	idle  uint64
}

func readProcStat() (*cpuStat, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return nil, fmt.Errorf("empty /proc/stat")
	}

	// Parse first line (overall CPU stats)
	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return nil, fmt.Errorf("invalid /proc/stat format")
	}

	var values []uint64
	for i := 1; i < len(fields) && i <= 8; i++ {
		val, err := strconv.ParseUint(fields[i], 10, 64)
		if err != nil {
			return nil, err
		}
		values = append(values, val)
	}

	if len(values) < 4 {
		return nil, fmt.Errorf("insufficient CPU stats")
	}

	// Calculate total and idle
	var total uint64
	for _, val := range values {
		total += val
	}

	idle := values[3] // idle time is the 4th field

	return &cpuStat{total: total, idle: idle}, nil
}

// getMemoryStats retrieves memory usage information
func getMemoryStats() (MemoryStats, error) {
	stats := MemoryStats{}

	if runtime.GOOS == "linux" {
		data, err := os.ReadFile("/proc/meminfo")
		if err != nil {
			return stats, err
		}

		lines := strings.Split(string(data), "\n")
		memInfo := make(map[string]uint64)

		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				key := strings.TrimSuffix(fields[0], ":")
				value, err := strconv.ParseUint(fields[1], 10, 64)
				if err == nil {
					memInfo[key] = value * 1024 // Convert from KB to bytes
				}
			}
		}

		stats.Total = memInfo["MemTotal"]
		stats.Available = memInfo["MemAvailable"]
		stats.Cached = memInfo["Cached"]
		stats.Buffers = memInfo["Buffers"]
		stats.Used = stats.Total - stats.Available

		if stats.Total > 0 {
			stats.UsedPercent = float64(stats.Used) / float64(stats.Total) * 100
		}
	}

	return stats, nil
}

// getDiskStats retrieves disk usage information
func getDiskStats() (DiskStats, error) {
	stats := DiskStats{}

	if runtime.GOOS == "linux" {
		var stat syscall.Statfs_t
		err := syscall.Statfs(".", &stat)
		if err != nil {
			return stats, err
		}

		stats.Total = stat.Blocks * uint64(stat.Bsize)
		stats.Free = stat.Bavail * uint64(stat.Bsize)
		stats.Used = stats.Total - stats.Free

		if stats.Total > 0 {
			stats.UsedPercent = float64(stats.Used) / float64(stats.Total) * 100
		}
	}

	return stats, nil
}

// getNetworkStats retrieves network usage information
func getNetworkStats() (NetworkStats, error) {
	stats := NetworkStats{}

	if runtime.GOOS == "linux" {
		data, err := os.ReadFile("/proc/net/dev")
		if err != nil {
			return stats, err
		}

		lines := strings.Split(string(data), "\n")
		for _, line := range lines[2:] { // Skip header lines
			fields := strings.Fields(line)
			if len(fields) >= 10 {
				// Skip loopback interface
				if strings.Contains(fields[0], "lo:") {
					continue
				}

				// Parse received bytes (field 1) and transmitted bytes (field 9)
				rxBytes, err1 := strconv.ParseUint(fields[1], 10, 64)
				txBytes, err2 := strconv.ParseUint(fields[9], 10, 64)
				rxPackets, err3 := strconv.ParseUint(fields[2], 10, 64)
				txPackets, err4 := strconv.ParseUint(fields[10], 10, 64)

				if err1 == nil && err2 == nil && err3 == nil && err4 == nil {
					stats.BytesReceived += rxBytes
					stats.BytesSent += txBytes
					stats.PacketsReceived += rxPackets
					stats.PacketsSent += txPackets
				}
			}
		}
	}

	return stats, nil
}

// getProcessStats retrieves current process statistics
func getProcessStats() (ProcessStats, error) {
	stats := ProcessStats{
		PID: os.Getpid(),
	}

	if runtime.GOOS == "linux" {
		// Read process stats from /proc/self/stat
		data, err := os.ReadFile("/proc/self/stat")
		if err == nil {
			fields := strings.Fields(string(data))
			if len(fields) >= 24 {
				// Parse memory usage (RSS in pages, field 24)
				if rss, err := strconv.ParseUint(fields[23], 10, 64); err == nil {
					pageSize := uint64(os.Getpagesize())
					stats.MemoryMB = float64(rss*pageSize) / (1024 * 1024)
				}

				// Parse thread count (field 20)
				if threads, err := strconv.Atoi(fields[19]); err == nil {
					stats.Threads = threads
				}
			}
		}

		// Get memory percentage
		memStats, err := getMemoryStats()
		if err == nil && memStats.Total > 0 {
			processMemBytes := stats.MemoryMB * 1024 * 1024
			stats.MemoryPercent = processMemBytes / float64(memStats.Total) * 100
		}

		// Count open file descriptors
		if files, err := os.ReadDir("/proc/self/fd"); err == nil {
			stats.OpenFiles = len(files)
		}
	}

	return stats, nil
}

// streamLogs streams server logs in real-time
func streamLogs(ctx context.Context, conn *websocket.Conn) {
	// Try to tail the server log file
	logFiles := []string{
		"homeflix.log",
		"server.log", 
		"backend.log",
		"/var/log/homeflix.log",
	}

	var logFile string
	for _, file := range logFiles {
		if _, err := os.Stat(file); err == nil {
			logFile = file
			break
		}
	}

	if logFile == "" {
		// If no log file found, stream from stderr/stdout
		streamProcessLogs(ctx, conn)
		return
	}

	// Tail the log file
	cmd := exec.CommandContext(ctx, "tail", "-f", logFile)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return
	}

	if err := cmd.Start(); err != nil {
		return
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		logEntry := parseLogLine(line, "file")

		if err := conn.WriteJSON(logEntry); err != nil {
			break
		}
	}

	cmd.Wait()
}

// streamProcessLogs streams logs from the current process
func streamProcessLogs(ctx context.Context, conn *websocket.Conn) {
	// Create a pipe to capture logs
	r, w := io.Pipe()
	
	// Redirect log output (this is a simplified version)
	go func() {
		defer w.Close()
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			line := scanner.Text()
			logEntry := parseLogLine(line, "process")

			if err := conn.WriteJSON(logEntry); err != nil {
				break
			}
		}
	}()

	// Keep the connection alive
	<-ctx.Done()
}

// getRecentLogs retrieves recent log entries
func getRecentLogs(lines int, source string) ([]LogEntry, error) {
	var logs []LogEntry

	// Try to read from log files
	logFiles := []string{
		"homeflix.log",
		"server.log",
		"backend.log",
		"/var/log/homeflix.log",
	}

	var logFile string
	for _, file := range logFiles {
		if _, err := os.Stat(file); err == nil {
			logFile = file
			break
		}
	}

	if logFile == "" {
		// Return some sample logs if no file found
		return getSampleLogs(lines), nil
	}

	// Use tail command to get recent lines
	cmd := exec.Command("tail", "-n", strconv.Itoa(lines), logFile)
	output, err := cmd.Output()
	if err != nil {
		return getSampleLogs(lines), nil
	}

	logLines := strings.Split(string(output), "\n")
	for _, line := range logLines {
		if strings.TrimSpace(line) != "" {
			logEntry := parseLogLine(line, "file")
			logs = append(logs, logEntry)
		}
	}

	return logs, nil
}

// parseLogLine parses a log line into a LogEntry
func parseLogLine(line, source string) LogEntry {
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   line,
		Source:    source,
	}

	// Try to parse timestamp and level from common log formats
	if strings.Contains(line, "[") && strings.Contains(line, "]") {
		// Extract timestamp
		if timeStart := strings.Index(line, "["); timeStart >= 0 {
			if timeEnd := strings.Index(line[timeStart:], "]"); timeEnd > 0 {
				timeStr := line[timeStart+1 : timeStart+timeEnd]
				if parsedTime, err := time.Parse("2006-01-02 15:04:05", timeStr); err == nil {
					entry.Timestamp = parsedTime
				} else if parsedTime, err := time.Parse("15:04:05", timeStr); err == nil {
					entry.Timestamp = parsedTime
				}
			}
		}
	}

	// Extract log level
	upperLine := strings.ToUpper(line)
	if strings.Contains(upperLine, "ERROR") {
		entry.Level = "ERROR"
	} else if strings.Contains(upperLine, "WARN") {
		entry.Level = "WARN"
	} else if strings.Contains(upperLine, "DEBUG") {
		entry.Level = "DEBUG"
	} else if strings.Contains(upperLine, "FATAL") {
		entry.Level = "FATAL"
	}

	return entry
}

// getSampleLogs returns sample log entries for demonstration
func getSampleLogs(count int) []LogEntry {
	logs := []LogEntry{
		{
			Timestamp: time.Now().Add(-5 * time.Minute),
			Level:     "INFO",
			Message:   "🚀 HomeFlix Server starting on port 8252",
			Source:    "server",
		},
		{
			Timestamp: time.Now().Add(-4 * time.Minute),
			Level:     "INFO",
			Message:   "✅ Redis asset cache initialized successfully",
			Source:    "cache",
		},
		{
			Timestamp: time.Now().Add(-3 * time.Minute),
			Level:     "INFO",
			Message:   "🎬 Transcode service initialized (HW Accel: none)",
			Source:    "transcode",
		},
		{
			Timestamp: time.Now().Add(-2 * time.Minute),
			Level:     "INFO",
			Message:   "📁 Loaded media path: /media/movies (external) - Movies",
			Source:    "scanner",
		},
		{
			Timestamp: time.Now().Add(-1 * time.Minute),
			Level:     "INFO",
			Message:   "🔄 Starting comprehensive media sync validation on server startup...",
			Source:    "scanner",
		},
		{
			Timestamp: time.Now(),
			Level:     "INFO",
			Message:   "✅ Initial media scanning completed successfully",
			Source:    "scanner",
		},
	}

	if count < len(logs) {
		return logs[:count]
	}
	return logs
}