package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

// SystemInfo represents detailed system hardware information
type SystemInfo struct {
	CPU     CPUInfo     `json:"cpu"`
	GPU     GPUInfo     `json:"gpu"`
	Memory  MemoryInfo  `json:"memory"`
	Disk    DiskInfo    `json:"disk"`
	Network NetworkInfo `json:"network"`
	OS      OSInfo      `json:"os"`
}

type CPUInfo struct {
	Model      string `json:"model"`
	Cores      int    `json:"cores"`
	Threads    int    `json:"threads"`
	MaxFreq    string `json:"max_freq"`
	Cache      string `json:"cache"`
	Arch       string `json:"arch"`
}

type GPUInfo struct {
	Model  string `json:"model"`
	Vendor string `json:"vendor"`
	Driver string `json:"driver"`
	Memory string `json:"memory"`
}

type MemoryInfo struct {
	Total     string `json:"total"`
	Type      string `json:"type"`
	Speed     string `json:"speed"`
	Slots     int    `json:"slots"`
}

type DiskInfo struct {
	Model      string   `json:"model"`
	Type       string   `json:"type"`
	Total      string   `json:"total"`
	Partitions []string `json:"partitions"`
}

type NetworkInfo struct {
	Hostname   string   `json:"hostname"`
	Interfaces []string `json:"interfaces"`
	IPAddress  string   `json:"ip_address"`
	MACAddress string   `json:"mac_address"`
}

type OSInfo struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Kernel   string `json:"kernel"`
	Platform string `json:"platform"`
	Uptime   string `json:"uptime"`
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
		if files, err := filepath.Glob("/proc/self/fd/*"); err == nil {
			stats.OpenFiles = len(files)
		}
		
		// Calculate process CPU percentage
		if cpu, err := getProcessCPUUsage(); err == nil {
			stats.CPUPercent = cpu
		}
	}

	return stats, nil
}

// getProcessCPUUsage calculates process CPU usage percentage
func getProcessCPUUsage() (float64, error) {
	// Read stats twice with a small interval
	p1, s1, err := readProcessAndSystemTimes()
	if err != nil {
		return 0, err
	}

	time.Sleep(100 * time.Millisecond)

	p2, s2, err := readProcessAndSystemTimes()
	if err != nil {
		return 0, err
	}

	// Calculate usage
	pDelta := p2 - p1
	sDelta := s2 - s1

	if sDelta == 0 {
		return 0, nil
	}
	
	usage := 100.0 * (float64(pDelta) / float64(sDelta)) * float64(runtime.NumCPU())
	return usage, nil
}

func readProcessAndSystemTimes() (uint64, uint64, error) {
	// Read process stats
	pData, err := os.ReadFile("/proc/self/stat")
	if err != nil {
		return 0, 0, err
	}
	pFields := strings.Fields(string(pData))
	if len(pFields) < 15 {
		return 0, 0, fmt.Errorf("invalid /proc/self/stat")
	}
	utime, _ := strconv.ParseUint(pFields[13], 10, 64)
	stime, _ := strconv.ParseUint(pFields[14], 10, 64)
	pTime := utime + stime

	// Read system stats
	sData, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	sLines := strings.Split(string(sData), "\n")
	if len(sLines) == 0 {
		return 0, 0, fmt.Errorf("empty /proc/stat")
	}
	sFields := strings.Fields(sLines[0])
	var sTime uint64
	for i := 1; i < len(sFields) && i <= 8; i++ {
		val, _ := strconv.ParseUint(sFields[i], 10, 64)
		sTime += val
	}

	return pTime, sTime, nil
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
	// Always return live system logs with real-time data
	return getLiveSystemLogs(lines), nil
}

// parseLogLine parses a log line into a LogEntry
func parseLogLine(line, source string) LogEntry {
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   line,
		Source:    source,
	}

	// Try to parse Go log format: 2006/01/02 15:04:05 message
	if len(line) > 19 && line[4] == '/' && line[7] == '/' && line[10] == ' ' && line[13] == ':' && line[16] == ':' {
		timeStr := line[:19]
		if parsedTime, err := time.Parse("2006/01/02 15:04:05", timeStr); err == nil {
			entry.Timestamp = parsedTime
			entry.Message = strings.TrimSpace(line[19:])
		}
	}

	// Try to parse timestamp and level from common log formats with brackets
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
	if strings.Contains(upperLine, "ERROR") || strings.Contains(upperLine, "❌") {
		entry.Level = "ERROR"
	} else if strings.Contains(upperLine, "WARN") || strings.Contains(upperLine, "⚠️") {
		entry.Level = "WARN"
	} else if strings.Contains(upperLine, "DEBUG") || strings.Contains(upperLine, "🔍") {
		entry.Level = "DEBUG"
	} else if strings.Contains(upperLine, "FATAL") {
		entry.Level = "FATAL"
	} else if strings.Contains(upperLine, "SUCCESS") || strings.Contains(upperLine, "✅") {
		entry.Level = "SUCCESS"
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

// GetSystemInfo returns detailed system hardware information
func GetSystemInfo() gin.HandlerFunc {
	return func(c *gin.Context) {
		info, err := collectSystemInfo()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, info)
	}
}

// collectSystemInfo gathers detailed system hardware information
func collectSystemInfo() (*SystemInfo, error) {
	info := &SystemInfo{}

	// CPU Info
	info.CPU = getCPUInfo()

	// GPU Info
	info.GPU = getGPUInfo()

	// Memory Info
	info.Memory = getMemoryInfo()

	// Disk Info
	info.Disk = getDiskInfo()

	// Network Info
	info.Network = getNetworkInfo()

	// OS Info
	info.OS = getOSInfo()

	return info, nil
}

// getCPUInfo retrieves detailed CPU information
func getCPUInfo() CPUInfo {
	cpuInfo := CPUInfo{
		Cores: runtime.NumCPU(),
		Arch:  runtime.GOARCH,
	}

	if runtime.GOOS == "linux" {
		// Get CPU model from /proc/cpuinfo
		if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "model name") {
					parts := strings.Split(line, ":")
					if len(parts) > 1 {
						cpuInfo.Model = strings.TrimSpace(parts[1])
						break
					}
				}
			}

			// Get cache size
			for _, line := range lines {
				if strings.HasPrefix(line, "cache size") {
					parts := strings.Split(line, ":")
					if len(parts) > 1 {
						cpuInfo.Cache = strings.TrimSpace(parts[1])
						break
					}
				}
			}
		}

		// Get max frequency
		if data, err := os.ReadFile("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq"); err == nil {
			freq := strings.TrimSpace(string(data))
			if freqInt, err := strconv.ParseInt(freq, 10, 64); err == nil {
				cpuInfo.MaxFreq = fmt.Sprintf("%.2f GHz", float64(freqInt)/1000000)
			}
		}
	}

	// Estimate threads (usually 2x cores for hyperthreading)
	cpuInfo.Threads = cpuInfo.Cores * 2

	if cpuInfo.Model == "" {
		cpuInfo.Model = "Unknown CPU"
	}

	return cpuInfo
}

// getGPUInfo retrieves GPU information
func getGPUInfo() GPUInfo {
	gpuInfo := GPUInfo{
		Model:  "Unknown GPU",
		Vendor: "Unknown",
		Driver: "N/A",
		Memory: "N/A",
	}

	if runtime.GOOS == "linux" {
		// Try lspci for GPU info
		cmd := exec.Command("lspci")
		if output, err := cmd.Output(); err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				if strings.Contains(strings.ToLower(line), "vga") || strings.Contains(strings.ToLower(line), "3d") {
					parts := strings.Split(line, ":")
					if len(parts) > 2 {
						gpuInfo.Model = strings.TrimSpace(parts[2])
						if strings.Contains(strings.ToLower(line), "nvidia") {
							gpuInfo.Vendor = "NVIDIA"
						} else if strings.Contains(strings.ToLower(line), "amd") || strings.Contains(strings.ToLower(line), "radeon") {
							gpuInfo.Vendor = "AMD"
						} else if strings.Contains(strings.ToLower(line), "intel") {
							gpuInfo.Vendor = "Intel"
						}
						break
					}
				}
			}
		}

		// Try nvidia-smi for NVIDIA GPUs
		cmd = exec.Command("nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader")
		if output, err := cmd.Output(); err == nil {
			parts := strings.Split(strings.TrimSpace(string(output)), ",")
			if len(parts) >= 3 {
				gpuInfo.Model = strings.TrimSpace(parts[0])
				gpuInfo.Vendor = "NVIDIA"
				gpuInfo.Driver = strings.TrimSpace(parts[1])
				gpuInfo.Memory = strings.TrimSpace(parts[2])
			}
		}
	}

	return gpuInfo
}

// getMemoryInfo retrieves memory information
func getMemoryInfo() MemoryInfo {
	memInfo := MemoryInfo{
		Type:  "Unknown",
		Speed: "Unknown",
		Slots: 1,
	}

	if runtime.GOOS == "linux" {
		// Get total memory from /proc/meminfo
		if data, err := os.ReadFile("/proc/meminfo"); err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "MemTotal:") {
					parts := strings.Fields(line)
					if len(parts) >= 2 {
						if totalKB, err := strconv.ParseUint(parts[1], 10, 64); err == nil {
							totalGB := float64(totalKB) / (1024 * 1024)
							memInfo.Total = fmt.Sprintf("%.1f GB", totalGB)
						}
					}
					break
				}
			}
		}

		// Try dmidecode for detailed memory info
		cmd := exec.Command("dmidecode", "-t", "memory")
		if output, err := cmd.Output(); err == nil {
			lines := strings.Split(string(output), "\n")
			slotCount := 0
			for _, line := range lines {
				if strings.Contains(line, "Type:") && !strings.Contains(line, "Error") && !strings.Contains(line, "Unknown") {
					parts := strings.Split(line, ":")
					if len(parts) > 1 {
						memType := strings.TrimSpace(parts[1])
						if memType != "" && memType != "Unknown" {
							memInfo.Type = memType
						}
					}
				}
				if strings.Contains(line, "Speed:") && !strings.Contains(line, "Unknown") {
					parts := strings.Split(line, ":")
					if len(parts) > 1 {
						memInfo.Speed = strings.TrimSpace(parts[1])
					}
				}
				if strings.Contains(line, "Size:") && !strings.Contains(line, "No Module") {
					slotCount++
				}
			}
			if slotCount > 0 {
				memInfo.Slots = slotCount
			}
		}
	}

	if memInfo.Total == "" {
		memInfo.Total = "Unknown"
	}

	return memInfo
}

// getDiskInfo retrieves disk information
func getDiskInfo() DiskInfo {
	diskInfo := DiskInfo{
		Model:      "Unknown",
		Type:       "Unknown",
		Total:      "Unknown",
		Partitions: []string{},
	}

	if runtime.GOOS == "linux" {
		// Get disk model from /sys/block
		if entries, err := os.ReadDir("/sys/block"); err == nil {
			for _, entry := range entries {
				if strings.HasPrefix(entry.Name(), "sd") || strings.HasPrefix(entry.Name(), "nvme") {
					modelPath := fmt.Sprintf("/sys/block/%s/device/model", entry.Name())
					if data, err := os.ReadFile(modelPath); err == nil {
						diskInfo.Model = strings.TrimSpace(string(data))
					}

					// Determine disk type
					if strings.HasPrefix(entry.Name(), "nvme") {
						diskInfo.Type = "NVMe SSD"
					} else {
						rotationalPath := fmt.Sprintf("/sys/block/%s/queue/rotational", entry.Name())
						if data, err := os.ReadFile(rotationalPath); err == nil {
							if strings.TrimSpace(string(data)) == "0" {
								diskInfo.Type = "SSD"
							} else {
								diskInfo.Type = "HDD"
							}
						}
					}
					break
				}
			}
		}

		// Get partition info
		cmd := exec.Command("lsblk", "-o", "NAME,SIZE,TYPE,MOUNTPOINT", "-n")
		if output, err := cmd.Output(); err == nil {
			lines := strings.Split(string(output), "\n")
			var totalSize uint64
			for _, line := range lines {
				fields := strings.Fields(line)
				if len(fields) >= 3 {
					if fields[2] == "part" {
						partition := fmt.Sprintf("%s (%s)", fields[0], fields[1])
						if len(fields) >= 4 {
							partition += fmt.Sprintf(" - %s", fields[3])
						}
						diskInfo.Partitions = append(diskInfo.Partitions, partition)
					}
					if fields[2] == "disk" && len(fields) >= 2 {
						// Parse size (e.g., "500G", "1T")
						sizeStr := fields[1]
						if strings.HasSuffix(sizeStr, "T") {
							if val, err := strconv.ParseFloat(strings.TrimSuffix(sizeStr, "T"), 64); err == nil {
								totalSize += uint64(val * 1024 * 1024 * 1024 * 1024)
							}
						} else if strings.HasSuffix(sizeStr, "G") {
							if val, err := strconv.ParseFloat(strings.TrimSuffix(sizeStr, "G"), 64); err == nil {
								totalSize += uint64(val * 1024 * 1024 * 1024)
							}
						}
					}
				}
			}
			if totalSize > 0 {
				diskInfo.Total = fmt.Sprintf("%.1f TB", float64(totalSize)/(1024*1024*1024*1024))
			}
		}
	}

	return diskInfo
}

// getNetworkInfo retrieves network information
func getNetworkInfo() NetworkInfo {
	netInfo := NetworkInfo{
		Hostname:   "Unknown",
		Interfaces: []string{},
		IPAddress:  "Unknown",
		MACAddress: "Unknown",
	}

	// Get hostname
	if hostname, err := os.Hostname(); err == nil {
		netInfo.Hostname = hostname
	}

	if runtime.GOOS == "linux" {
		// Get network interfaces
		cmd := exec.Command("ip", "link", "show")
		if output, err := cmd.Output(); err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				if strings.Contains(line, ": ") && !strings.Contains(line, "lo:") {
					parts := strings.Split(line, ": ")
					if len(parts) >= 2 {
						ifaceName := strings.TrimSpace(parts[1])
						if !strings.Contains(ifaceName, "lo") {
							netInfo.Interfaces = append(netInfo.Interfaces, ifaceName)
						}
					}
				}
			}
		}

		// Get IP address
		cmd = exec.Command("hostname", "-I")
		if output, err := cmd.Output(); err == nil {
			ips := strings.Fields(string(output))
			if len(ips) > 0 {
				netInfo.IPAddress = ips[0]
			}
		}

		// Get MAC address of first non-loopback interface
		if len(netInfo.Interfaces) > 0 {
			macPath := fmt.Sprintf("/sys/class/net/%s/address", netInfo.Interfaces[0])
			if data, err := os.ReadFile(macPath); err == nil {
				netInfo.MACAddress = strings.TrimSpace(string(data))
			}
		}
	}

	return netInfo
}

// getOSInfo retrieves operating system information
func getOSInfo() OSInfo {
	osInfo := OSInfo{
		Platform: runtime.GOOS,
	}

	if runtime.GOOS == "linux" {
		// Get OS name and version from /etc/os-release
		if data, err := os.ReadFile("/etc/os-release"); err == nil {
			lines := strings.Split(string(data), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "PRETTY_NAME=") {
					osInfo.Name = strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
				}
				if strings.HasPrefix(line, "VERSION=") {
					osInfo.Version = strings.Trim(strings.TrimPrefix(line, "VERSION="), "\"")
				}
			}
		}

		// Get kernel version
		cmd := exec.Command("uname", "-r")
		if output, err := cmd.Output(); err == nil {
			osInfo.Kernel = strings.TrimSpace(string(output))
		}

		// Get uptime
		if data, err := os.ReadFile("/proc/uptime"); err == nil {
			fields := strings.Fields(string(data))
			if len(fields) > 0 {
				if uptimeSec, err := strconv.ParseFloat(fields[0], 64); err == nil {
					days := int(uptimeSec / 86400)
					hours := int((uptimeSec - float64(days*86400)) / 3600)
					minutes := int((uptimeSec - float64(days*86400) - float64(hours*3600)) / 60)
					osInfo.Uptime = fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
				}
			}
		}
	}

	if osInfo.Name == "" {
		osInfo.Name = "Unknown OS"
	}

	return osInfo
}

// getSystemdLogs gets logs from systemd journal
func getSystemdLogs(lines int) []LogEntry {
	var logs []LogEntry
	
	// Try to get logs from journalctl for the current process
	cmd := exec.Command("journalctl", "-n", strconv.Itoa(lines), "--no-pager", "-o", "short-iso")
	output, err := cmd.Output()
	if err != nil {
		return logs
	}

	logLines := strings.Split(string(output), "\n")
	for _, line := range logLines {
		if strings.TrimSpace(line) != "" {
			entry := parseLogLine(line, "systemd")
			logs = append(logs, entry)
		}
	}

	return logs
}

// getDockerLogs gets logs from Docker (not applicable since not using Docker)
func getDockerLogs(lines int) []LogEntry {
	// Since backend is not running in Docker, return empty
	return []LogEntry{}
}

// getProcessLogs gets logs from current process and system
func getProcessLogs(lines int) []LogEntry {
	var logs []LogEntry
	
	// Get recent dmesg entries
	cmd := exec.Command("dmesg", "-T", "--level=info,notice,warn,err", "--time-format=iso")
	output, err := cmd.Output()
	if err == nil {
		logLines := strings.Split(string(output), "\n")
		// Get last 'lines' entries
		start := len(logLines) - lines
		if start < 0 {
			start = 0
		}
		
		for i := start; i < len(logLines); i++ {
			line := logLines[i]
			if strings.TrimSpace(line) != "" {
				entry := parseLogLine(line, "kernel")
				logs = append(logs, entry)
			}
		}
	}

	return logs
}

// getLiveSystemLogs generates live CLI logs from actual system processes
func getLiveSystemLogs(lines int) []LogEntry {
	var logs []LogEntry
	now := time.Now()

	// Get recent system logs from journalctl (real CLI logs)
	if journalLogs := getRealJournalLogs(lines / 3); len(journalLogs) > 0 {
		logs = append(logs, journalLogs...)
	}

	// Get recent process activity logs
	if processLogs := getRecentProcessActivity(lines / 3); len(processLogs) > 0 {
		logs = append(logs, processLogs...)
	}

	// Get application-specific logs
	if appLogs := getApplicationLogs(lines / 3); len(appLogs) > 0 {
		logs = append(logs, appLogs...)
	}

	// If no real logs found, add some basic system info
	if len(logs) == 0 {
		pid := os.Getpid()
		logs = append(logs, LogEntry{
			Timestamp: now.Add(-2 * time.Second),
			Level:     "INFO",
			Message:   fmt.Sprintf("🚀 HomeFlix Server running (PID: %d)", pid),
			Source:    "server",
		})

		logs = append(logs, LogEntry{
			Timestamp: now.Add(-1 * time.Second),
			Level:     "INFO",
			Message:   "📡 System logs endpoint active",
			Source:    "api",
		})

		logs = append(logs, LogEntry{
			Timestamp: now,
			Level:     "INFO",
			Message:   fmt.Sprintf("🕐 Live logs captured at %s", now.Format("15:04:05")),
			Source:    "logger",
		})
	}

	// Sort by timestamp and limit
	if len(logs) > lines {
		logs = logs[len(logs)-lines:]
	}

	return logs
}

// getRealJournalLogs gets actual system logs from journalctl
func getRealJournalLogs(lines int) []LogEntry {
	var logs []LogEntry
	
	// Try to get recent system logs
	cmd := exec.Command("journalctl", "-n", strconv.Itoa(lines), "--no-pager", "-o", "short-iso", "--since", "5 minutes ago")
	output, err := cmd.Output()
	if err != nil {
		return logs
	}

	logLines := strings.Split(string(output), "\n")
	for _, line := range logLines {
		if strings.TrimSpace(line) != "" && !strings.Contains(line, "-- Logs begin at") {
			entry := parseJournalLogLine(line)
			if entry.Message != "" {
				logs = append(logs, entry)
			}
		}
	}

	return logs
}

// getRecentProcessActivity gets recent process activity
func getRecentProcessActivity(lines int) []LogEntry {
	var logs []LogEntry
	now := time.Now()
	
	// Get recent process starts/stops
	cmd := exec.Command("ps", "aux", "--sort=-start_time")
	output, err := cmd.Output()
	if err != nil {
		return logs
	}

	psLines := strings.Split(string(output), "\n")
	count := 0
	for i, line := range psLines {
		if i == 0 || count >= lines { // Skip header
			continue
		}
		
		fields := strings.Fields(line)
		if len(fields) >= 11 {
			command := strings.Join(fields[10:], " ")
			if !strings.Contains(command, "ps aux") && !strings.Contains(command, "[") {
				logs = append(logs, LogEntry{
					Timestamp: now.Add(-time.Duration(count) * time.Second),
					Level:     "INFO",
					Message:   fmt.Sprintf("🔧 Process: %s (PID: %s, CPU: %s%%)", command[:min(50, len(command))], fields[1], fields[2]),
					Source:    "process",
				})
				count++
			}
		}
	}

	return logs
}

// getApplicationLogs gets application-specific logs
func getApplicationLogs(lines int) []LogEntry {
	var logs []LogEntry
	now := time.Now()
	
	// Check for common application log patterns
	logPatterns := []string{
		"/var/log/syslog",
		"/var/log/messages", 
		"/var/log/daemon.log",
	}
	
	for _, logPath := range logPatterns {
		if _, err := os.Stat(logPath); err == nil {
			cmd := exec.Command("tail", "-n", strconv.Itoa(lines/3), logPath)
			output, err := cmd.Output()
			if err == nil {
				logLines := strings.Split(string(output), "\n")
				for i, line := range logLines {
					if strings.TrimSpace(line) != "" {
						logs = append(logs, LogEntry{
							Timestamp: now.Add(-time.Duration(len(logLines)-i) * time.Second),
							Level:     "INFO", 
							Message:   line,
							Source:    "system",
						})
					}
				}
				break // Only use first available log file
			}
		}
	}
	
	return logs
}

// parseJournalLogLine parses a journalctl log line
func parseJournalLogLine(line string) LogEntry {
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     "INFO",
		Message:   line,
		Source:    "journal",
	}

	// Try to parse journalctl format: timestamp hostname service: message
	parts := strings.SplitN(line, " ", 4)
	if len(parts) >= 4 {
		// Parse timestamp (ISO format from journalctl -o short-iso)
		if timestamp, err := time.Parse("2006-01-02T15:04:05-0700", parts[0]); err == nil {
			entry.Timestamp = timestamp
		}
		
		// Extract service name and message
		if len(parts) >= 3 {
			entry.Source = parts[2] // hostname or service
			if len(parts) >= 4 {
				entry.Message = parts[3]
			}
		}
	}

	// Determine log level from message content
	upperMsg := strings.ToUpper(entry.Message)
	if strings.Contains(upperMsg, "ERROR") || strings.Contains(upperMsg, "FAIL") {
		entry.Level = "ERROR"
	} else if strings.Contains(upperMsg, "WARN") || strings.Contains(upperMsg, "WARNING") {
		entry.Level = "WARN"
	} else if strings.Contains(upperMsg, "DEBUG") {
		entry.Level = "DEBUG"
	}

	return entry
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TerminalOutput represents a terminal output line
type TerminalOutput struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"` // stdout, stderr, info, progress
	Message   string    `json:"message"`
	Progress  float64   `json:"progress,omitempty"` // 0-100 for progress updates
}

// StreamTerminalOutput provides real-time terminal output via WebSocket
func StreamTerminalOutput() gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
			return
		}
		defer conn.Close()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Stream terminal output
		go streamTerminalLogs(ctx, conn)

		// Keep connection alive
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}
}

// GetTerminalOutput returns recent terminal output
func GetTerminalOutput() gin.HandlerFunc {
	return func(c *gin.Context) {
		lines := c.DefaultQuery("lines", "100")
		lineCount, err := strconv.Atoi(lines)
		if err != nil {
			lineCount = 100
		}

		output := getRecentTerminalOutput(lineCount)
		c.JSON(http.StatusOK, gin.H{
			"output": output,
			"count":  len(output),
		})
	}
}

// streamTerminalLogs streams terminal output in real-time
func streamTerminalLogs(ctx context.Context, conn *websocket.Conn) {
	// Try to tail multiple log files for comprehensive output
	logFiles := []string{
		"backend.log",
		"frontend.log",
		"homeflix.log",
		"startup.log",
	}

	// Find available log files
	var availableFiles []string
	for _, file := range logFiles {
		if _, err := os.Stat(file); err == nil {
			availableFiles = append(availableFiles, file)
		}
	}

	if len(availableFiles) == 0 {
		// Send initial message if no log files found
		conn.WriteJSON(TerminalOutput{
			Timestamp: time.Now(),
			Type:      "info",
			Message:   "📡 Terminal stream connected - waiting for output...",
		})
		
		// Stream process activity instead
		streamProcessActivity(ctx, conn)
		return
	}

	// Tail all available log files
	for _, logFile := range availableFiles {
		go tailLogFile(ctx, conn, logFile)
	}

	// Also stream scan progress
	go streamScanProgress(ctx, conn)

	<-ctx.Done()
}

// tailLogFile tails a specific log file and sends output via WebSocket
func tailLogFile(ctx context.Context, conn *websocket.Conn, logFile string) {
	cmd := exec.CommandContext(ctx, "tail", "-f", "-n", "50", logFile)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return
	}

	if err := cmd.Start(); err != nil {
		return
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			return
		default:
			line := scanner.Text()
			output := parseTerminalLine(line, logFile)
			if err := conn.WriteJSON(output); err != nil {
				cmd.Process.Kill()
				return
			}
		}
	}

	cmd.Wait()
}

// streamProcessActivity streams process activity when no log files available
func streamProcessActivity(ctx context.Context, conn *websocket.Conn) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Get current process info
			pid := os.Getpid()
			stats, _ := getProcessStats()
			
			output := TerminalOutput{
				Timestamp: time.Now(),
				Type:      "info",
				Message:   fmt.Sprintf("🔧 Server PID: %d | CPU: %.1f%% | Memory: %.1f MB | Threads: %d", 
					pid, stats.CPUPercent, stats.MemoryMB, stats.Threads),
			}
			
			if err := conn.WriteJSON(output); err != nil {
				return
			}
		}
	}
}

// streamScanProgress streams media scan progress
func streamScanProgress(ctx context.Context, conn *websocket.Conn) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	lastProgress := -1.0

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Check for scan progress file or API
			progress := getScanProgress()
			if progress != lastProgress && progress >= 0 {
				lastProgress = progress
				output := TerminalOutput{
					Timestamp: time.Now(),
					Type:      "progress",
					Message:   fmt.Sprintf("📊 Scan progress: %.1f%%", progress),
					Progress:  progress,
				}
				if err := conn.WriteJSON(output); err != nil {
					return
				}
			}
		}
	}
}

// getScanProgress retrieves current scan progress
func getScanProgress() float64 {
	// Try to read from a progress file if it exists
	progressFile := "scan_progress.json"
	if data, err := os.ReadFile(progressFile); err == nil {
		var progress struct {
			Percent float64 `json:"percent"`
		}
		if err := json.Unmarshal(data, &progress); err == nil {
			return progress.Percent
		}
	}
	return -1 // No progress available
}

// parseTerminalLine parses a terminal output line
func parseTerminalLine(line, source string) TerminalOutput {
	output := TerminalOutput{
		Timestamp: time.Now(),
		Type:      "stdout",
		Message:   line,
	}

	// Detect output type from content
	upperLine := strings.ToUpper(line)
	if strings.Contains(upperLine, "ERROR") || strings.Contains(upperLine, "❌") || strings.Contains(upperLine, "FAIL") {
		output.Type = "stderr"
	} else if strings.Contains(upperLine, "WARN") || strings.Contains(upperLine, "⚠️") {
		output.Type = "warning"
	} else if strings.Contains(line, "%") {
		// Try to extract progress percentage
		if progress := extractProgress(line); progress >= 0 {
			output.Type = "progress"
			output.Progress = progress
		}
	} else if strings.Contains(line, "✅") || strings.Contains(line, "🎉") || strings.Contains(upperLine, "SUCCESS") {
		output.Type = "success"
	} else if strings.Contains(line, "🚀") || strings.Contains(line, "📁") || strings.Contains(line, "🔄") {
		output.Type = "info"
	}

	return output
}

// extractProgress extracts progress percentage from a line
func extractProgress(line string) float64 {
	// Look for patterns like "50%", "50.5%", "[50%]", "(50%)"
	patterns := []string{
		`(\d+\.?\d*)%`,
		`\[(\d+\.?\d*)%\]`,
		`\((\d+\.?\d*)%\)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(line)
		if len(matches) >= 2 {
			if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
				return val
			}
		}
	}
	return -1
}

// getRecentTerminalOutput returns recent terminal output
func getRecentTerminalOutput(lines int) []TerminalOutput {
	var output []TerminalOutput

	// Read from log files
	logFiles := []string{"backend.log", "frontend.log", "startup.log"}
	
	for _, logFile := range logFiles {
		if _, err := os.Stat(logFile); err == nil {
			cmd := exec.Command("tail", "-n", strconv.Itoa(lines/len(logFiles)), logFile)
			if data, err := cmd.Output(); err == nil {
				logLines := strings.Split(string(data), "\n")
				for _, line := range logLines {
					if strings.TrimSpace(line) != "" {
						output = append(output, parseTerminalLine(line, logFile))
					}
				}
			}
		}
	}

	// Sort by timestamp
	if len(output) > lines {
		output = output[len(output)-lines:]
	}

	return output
}


// ServerControlResponse represents the response from server control operations
type ServerControlResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Output  string `json:"output,omitempty"`
}

// ServerStatus represents the status of production and dev servers
type ServerStatus struct {
	Production struct {
		Frontend bool `json:"frontend"`
		Backend  bool `json:"backend"`
	} `json:"production"`
	Development struct {
		Frontend bool `json:"frontend"`
		Backend  bool `json:"backend"`
	} `json:"development"`
}

// GetServerStatus returns the status of all servers
func GetServerStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		status := ServerStatus{}

		// Check production servers
		status.Production.Frontend = isPortInUse(3008)
		status.Production.Backend = isPortInUse(8252)

		// Check development servers
		status.Development.Frontend = isPortInUse(3009)
		status.Development.Backend = isPortInUse(8253)

		c.JSON(http.StatusOK, status)
	}
}

// StartProductionServer starts the production server
func StartProductionServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		cmd := exec.Command("./start.sh")
		cmd.Dir = getProjectRoot()
		output, err := cmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to start production server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Production server started",
			Output:  string(output),
		})
	}
}

// StopProductionServer stops the production server
func StopProductionServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		cmd := exec.Command("./stop.sh")
		cmd.Dir = getProjectRoot()
		output, err := cmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to stop production server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Production server stopped",
			Output:  string(output),
		})
	}
}

// RestartProductionServer restarts the production server
func RestartProductionServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Stop first
		stopCmd := exec.Command("./stop.sh")
		stopCmd.Dir = getProjectRoot()
		stopCmd.CombinedOutput()

		// Wait a moment
		time.Sleep(2 * time.Second)

		// Start
		startCmd := exec.Command("./start.sh")
		startCmd.Dir = getProjectRoot()
		output, err := startCmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to restart production server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Production server restarted",
			Output:  string(output),
		})
	}
}

// StartDevServer starts the development server
func StartDevServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		cmd := exec.Command("./start-dev.sh")
		cmd.Dir = getProjectRoot()
		output, err := cmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to start dev server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Development server started",
			Output:  string(output),
		})
	}
}

// StopDevServer stops the development server
func StopDevServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		cmd := exec.Command("./stop-dev.sh")
		cmd.Dir = getProjectRoot()
		output, err := cmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to stop dev server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Development server stopped",
			Output:  string(output),
		})
	}
}

// RestartDevServer restarts the development server
func RestartDevServer() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Stop first
		stopCmd := exec.Command("./stop-dev.sh")
		stopCmd.Dir = getProjectRoot()
		stopCmd.CombinedOutput()

		// Wait a moment
		time.Sleep(2 * time.Second)

		// Start
		startCmd := exec.Command("./start-dev.sh")
		startCmd.Dir = getProjectRoot()
		output, err := startCmd.CombinedOutput()

		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to restart dev server",
				Output:  string(output),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Development server restarted",
			Output:  string(output),
		})
	}
}

// isPortInUse checks if a port is in use
func isPortInUse(port int) bool {
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port))
	output, _ := cmd.Output()
	return strings.Contains(string(output), "LISTEN")
}

// getProjectRoot returns the project root directory
func getProjectRoot() string {
	// Go up from backend directory to project root
	execPath, err := os.Executable()
	if err != nil {
		// Fallback: assume we're running from backend directory
		return ".."
	}
	
	dir := filepath.Dir(execPath)
	// If running with go run, use working directory
	if strings.Contains(dir, "go-build") {
		wd, err := os.Getwd()
		if err != nil {
			return ".."
		}
		// If we're in backend directory, go up one level
		if strings.HasSuffix(wd, "backend") {
			return filepath.Dir(wd)
		}
		return wd
	}
	
	return filepath.Dir(dir)
}

// BuildBackend builds the backend using go build
func BuildBackend() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectRoot := getProjectRoot()
		backendDir := filepath.Join(projectRoot, "backend")
		
		cmd := exec.Command("go", "build", "-v", ".")
		cmd.Dir = backendDir
		
		// Create pipes for real-time output
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to create stdout pipe",
			})
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to create stderr pipe",
			})
			return
		}

		if err := cmd.Start(); err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to start build process",
			})
			return
		}

		// Read output
		var output strings.Builder
		
		// Read stdout
		go func() {
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				line := scanner.Text()
				output.WriteString(line + "\n")
			}
		}()
		
		// Read stderr
		go func() {
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				line := scanner.Text()
				output.WriteString(line + "\n")
			}
		}()

		// Wait for command to complete
		err = cmd.Wait()
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Backend build failed",
				Output:  output.String(),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Backend built successfully",
			Output:  output.String(),
		})
	}
}

// BuildFrontend builds the frontend using npm run build
func BuildFrontend() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectRoot := getProjectRoot()
		frontendDir := filepath.Join(projectRoot, "frontend")
		
		cmd := exec.Command("npm", "run", "build")
		cmd.Dir = frontendDir
		
		// Create pipes for real-time output
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to create stdout pipe",
			})
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to create stderr pipe",
			})
			return
		}

		if err := cmd.Start(); err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Failed to start build process",
			})
			return
		}

		// Read output
		var output strings.Builder
		
		// Read stdout
		go func() {
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				line := scanner.Text()
				output.WriteString(line + "\n")
			}
		}()
		
		// Read stderr
		go func() {
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				line := scanner.Text()
				output.WriteString(line + "\n")
			}
		}()

		// Wait for command to complete
		err = cmd.Wait()
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, ServerControlResponse{
				Success: false,
				Message: "Frontend build failed",
				Output:  output.String(),
			})
			return
		}

		c.JSON(http.StatusOK, ServerControlResponse{
			Success: true,
			Message: "Frontend built successfully",
			Output:  output.String(),
		})
	}
}

// StreamBuildBackend streams backend build output via WebSocket
func StreamBuildBackend() gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
			return
		}
		defer conn.Close()

		projectRoot := getProjectRoot()
		backendDir := filepath.Join(projectRoot, "backend")
		
		cmd := exec.Command("go", "build", "-v", ".")
		cmd.Dir = backendDir
		
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to create stdout pipe",
			})
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to create stderr pipe",
			})
			return
		}

		if err := cmd.Start(); err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to start build process",
			})
			return
		}

		// Send initial message
		conn.WriteJSON(TerminalOutput{
			Timestamp: time.Now(),
			Type:      "info",
			Message:   "🔨 Starting backend build...",
		})

		// Stream stdout
		go func() {
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				line := scanner.Text()
				conn.WriteJSON(TerminalOutput{
					Timestamp: time.Now(),
					Type:      "stdout",
					Message:   line,
				})
			}
		}()
		
		// Stream stderr
		go func() {
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				line := scanner.Text()
				conn.WriteJSON(TerminalOutput{
					Timestamp: time.Now(),
					Type:      "stderr",
					Message:   line,
				})
			}
		}()

		// Wait for completion
		err = cmd.Wait()
		
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "❌ Backend build failed",
			})
		} else {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "success",
				Message:   "✅ Backend build completed successfully",
			})
		}
	}
}

// StreamBuildFrontend streams frontend build output via WebSocket
func StreamBuildFrontend() gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
			return
		}
		defer conn.Close()

		projectRoot := getProjectRoot()
		frontendDir := filepath.Join(projectRoot, "frontend")
		
		cmd := exec.Command("npm", "run", "build")
		cmd.Dir = frontendDir
		
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to create stdout pipe",
			})
			return
		}
		
		stderr, err := cmd.StderrPipe()
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to create stderr pipe",
			})
			return
		}

		if err := cmd.Start(); err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "Failed to start build process",
			})
			return
		}

		// Send initial message
		conn.WriteJSON(TerminalOutput{
			Timestamp: time.Now(),
			Type:      "info",
			Message:   "🔨 Starting frontend build...",
		})

		// Stream stdout
		go func() {
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				line := scanner.Text()
				conn.WriteJSON(TerminalOutput{
					Timestamp: time.Now(),
					Type:      "stdout",
					Message:   line,
				})
			}
		}()
		
		// Stream stderr
		go func() {
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				line := scanner.Text()
				conn.WriteJSON(TerminalOutput{
					Timestamp: time.Now(),
					Type:      "stderr",
					Message:   line,
				})
			}
		}()

		// Wait for completion
		err = cmd.Wait()
		
		if err != nil {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "stderr",
				Message:   "❌ Frontend build failed",
			})
		} else {
			conn.WriteJSON(TerminalOutput{
				Timestamp: time.Now(),
				Type:      "success",
				Message:   "✅ Frontend build completed successfully",
			})
		}
	}
}