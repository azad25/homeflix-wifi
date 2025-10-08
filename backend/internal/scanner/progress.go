package scanner

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

// winsize represents terminal window size
type winsize struct {
	Row    uint16
	Col    uint16
	Xpixel uint16
	Ypixel uint16
}

// ProgressTracker handles fixed status display with progress bar
type ProgressTracker struct {
	currentPhase     string
	currentOperation string
	totalFiles       int
	processedFiles   int
	errorFiles       int
	skippedFiles     int
	startTime        time.Time
	activeGoroutines int
	maxGoroutines    int
	mutex            sync.RWMutex
	ticker           *time.Ticker
	stopChan         chan bool
	isRunning        bool
	terminalHeight   int
	terminalWidth    int
	progressLine     int
}

// NewProgressTracker creates a new progress tracker
func NewProgressTracker() *ProgressTracker {
	height, width := getTerminalSize()
	return &ProgressTracker{
		stopChan:       make(chan bool),
		maxGoroutines:  50,
		terminalHeight: height,
		terminalWidth:  width,
		progressLine:   height - 2, // Reserve bottom 2 lines for progress
	}
}

// getTerminalSize returns the terminal dimensions
func getTerminalSize() (int, int) {
	ws := &winsize{}
	retVal, _, _ := syscall.Syscall(syscall.SYS_IOCTL,
		uintptr(os.Stdout.Fd()),
		uintptr(syscall.TIOCGWINSZ),
		uintptr(unsafe.Pointer(ws)))
	
	if int(retVal) == 0 {
		return int(ws.Row), int(ws.Col)
	}
	// Fallback to default size
	return 24, 80
}

// Start begins the progress display
func (p *ProgressTracker) Start() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	if p.isRunning {
		return
	}
	
	p.startTime = time.Now()
	p.isRunning = true
	p.ticker = time.NewTicker(1 * time.Second)
	
	go p.displayLoop()
}

// Stop ends the progress display
func (p *ProgressTracker) Stop() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	if !p.isRunning {
		return
	}
	
	p.isRunning = false
	if p.ticker != nil {
		p.ticker.Stop()
	}
	
	select {
	case p.stopChan <- true:
	default:
	}
	
	// Clear the bottom progress lines
	fmt.Printf("\033[%d;1H", p.terminalHeight-1) // Move to second-to-last line
	fmt.Print("\033[K")                           // Clear line
	fmt.Printf("\033[%d;1H", p.terminalHeight)   // Move to last line
	fmt.Print("\033[K")                           // Clear line
	
	// Show final status
	p.printFinalStatus()
}

// UpdatePhase updates the current phase
func (p *ProgressTracker) UpdatePhase(phase string) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.currentPhase = phase
}

// UpdateOperation updates the current operation
func (p *ProgressTracker) UpdateOperation(operation string) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.currentOperation = operation
}

// SetTotalFiles sets the total number of files
func (p *ProgressTracker) SetTotalFiles(total int) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.totalFiles = total
}

// IncrementProcessed increments processed files counter
func (p *ProgressTracker) IncrementProcessed() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.processedFiles++
}

// IncrementError increments error files counter
func (p *ProgressTracker) IncrementError() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.errorFiles++
}

// IncrementSkipped increments skipped files counter
func (p *ProgressTracker) IncrementSkipped() {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.skippedFiles++
}

// UpdateGoroutines updates active goroutines count
func (p *ProgressTracker) UpdateGoroutines(active int) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.activeGoroutines = active
}

// displayLoop runs the progress display loop
func (p *ProgressTracker) displayLoop() {
	for {
		select {
		case <-p.ticker.C:
			p.displayProgress()
		case <-p.stopChan:
			return
		}
	}
}

// displayProgress displays the current progress at bottom of terminal
func (p *ProgressTracker) displayProgress() {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	if !p.isRunning {
		return
	}
	
	// Save current cursor position
	fmt.Print("\033[s")
	
	// Calculate progress percentage
	var progressPercent float64
	if p.totalFiles > 0 {
		progressPercent = float64(p.processedFiles+p.errorFiles+p.skippedFiles) / float64(p.totalFiles) * 100
	}
	
	// Create progress bar (adjust width based on terminal)
	barWidth := p.terminalWidth - 80 // Leave space for other info
	if barWidth < 20 {
		barWidth = 20
	}
	if barWidth > 50 {
		barWidth = 50
	}
	filledWidth := int(progressPercent / 100 * float64(barWidth))
	progressBar := strings.Repeat("█", filledWidth) + strings.Repeat("░", barWidth-filledWidth)
	
	// Calculate elapsed time
	elapsed := time.Since(p.startTime)
	
	// Calculate ETA
	var eta string
	if progressPercent > 0 && progressPercent < 100 {
		totalEstimated := elapsed.Seconds() / (progressPercent / 100)
		remaining := time.Duration(totalEstimated-elapsed.Seconds()) * time.Second
		eta = fmt.Sprintf("ETA: %v", remaining.Round(time.Second))
	} else {
		eta = "ETA: --:--"
	}
	
	// Resource usage indicator
	resourcePercent := float64(p.activeGoroutines) / float64(p.maxGoroutines) * 100
	var resourceStatus string
	if resourcePercent > 80 {
		resourceStatus = "🔴 HIGH"
	} else if resourcePercent > 50 {
		resourceStatus = "🟡 MED"
	} else {
		resourceStatus = "🟢 LOW"
	}
	
	// Move to bottom of terminal for progress display
	fmt.Printf("\033[%d;1H", p.terminalHeight-1) // Move to second-to-last line
	fmt.Print("\033[K")                           // Clear line
	
	// Display current phase and operation on second-to-last line
	if p.currentPhase != "" {
		phaseInfo := fmt.Sprintf("🔄 %s", p.currentPhase)
		if p.currentOperation != "" {
			phaseInfo += fmt.Sprintf(" - %s", p.currentOperation)
		}
		// Truncate if too long
		if len(phaseInfo) > p.terminalWidth-5 {
			phaseInfo = phaseInfo[:p.terminalWidth-8] + "..."
		}
		fmt.Print(phaseInfo)
	}
	
	// Move to last line for progress bar
	fmt.Printf("\033[%d;1H", p.terminalHeight) // Move to last line
	fmt.Print("\033[K")                        // Clear line
	
	// Fixed status line at bottom
	statusLine := fmt.Sprintf(
		"📊 [%s] %.1f%% │ %d/%d │ ✅%d ❌%d ⏭️%d │ %s │ 🔧%s(%d/%d) │ %s",
		progressBar,
		progressPercent,
		p.processedFiles+p.errorFiles+p.skippedFiles,
		p.totalFiles,
		p.processedFiles,
		p.errorFiles,
		p.skippedFiles,
		elapsed.Round(time.Second),
		resourceStatus,
		p.activeGoroutines,
		p.maxGoroutines,
		eta,
	)
	
	// Truncate status line if too long for terminal
	if len(statusLine) > p.terminalWidth {
		statusLine = statusLine[:p.terminalWidth-3] + "..."
	}
	
	fmt.Print(statusLine)
	
	// Restore cursor position
	fmt.Print("\033[u")
}

// printFinalStatus prints the final completion status
func (p *ProgressTracker) printFinalStatus() {
	elapsed := time.Since(p.startTime)
	
	fmt.Printf("\n✅ Scan completed in %v\n", elapsed.Round(time.Second))
	fmt.Printf("📈 Results: %d processed, %d errors, %d skipped (Total: %d)\n",
		p.processedFiles, p.errorFiles, p.skippedFiles, p.totalFiles)
	
	if p.totalFiles > 0 {
		successRate := float64(p.processedFiles) / float64(p.totalFiles) * 100
		fmt.Printf("📊 Success rate: %.1f%%\n", successRate)
	}
}

// LogWithProgress logs a message while preserving the progress display
func (p *ProgressTracker) LogWithProgress(message string) {
	p.mutex.RLock()
	isRunning := p.isRunning
	height := p.terminalHeight
	p.mutex.RUnlock()
	
	if isRunning {
		// Save cursor position
		fmt.Print("\033[s")
		
		// Clear the bottom progress lines
		fmt.Printf("\033[%d;1H", height-1) // Move to second-to-last line
		fmt.Print("\033[K")                // Clear line
		fmt.Printf("\033[%d;1H", height)   // Move to last line
		fmt.Print("\033[K")                // Clear line
		
		// Restore cursor and print message
		fmt.Print("\033[u")
		fmt.Println(message)
		
		// Progress will be redrawn on next tick
	} else {
		fmt.Println(message)
	}
}
