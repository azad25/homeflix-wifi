package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const openSubtitlesBaseURL = "https://api.opensubtitles.com/api/v1"

type OpenSubtitlesService struct {
	apiKey   string
	username string
	password string
	token    string
	client   *http.Client
}

// Simplified and more flexible struct to handle OpenSubtitles API variations
type OpenSubtitlesSearchResult struct {
	Data       []OpenSubtitleItem `json:"data"`
	TotalPages int                `json:"total_pages"`
	TotalCount int                `json:"total_count"`
	Page       int                `json:"page"`
}

type OpenSubtitleItem struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Attributes OpenSubtitleAttributes `json:"attributes"`
}

type OpenSubtitleAttributes struct {
	SubtitleID       string                 `json:"subtitle_id"`
	Language         string                 `json:"language"`
	DownloadCount    int                    `json:"download_count"`
	NewDownloadCount int                    `json:"new_download_count"`
	HearingImpaired  bool                   `json:"hearing_impaired"`
	HD               bool                   `json:"hd"`
	FPS              float64                `json:"fps"`
	Votes            int                    `json:"votes"`
	Ratings          float64                `json:"ratings"`
	FromTrusted      bool                   `json:"from_trusted"`
	ForeignPartsOnly bool                   `json:"foreign_parts_only"`
	AutoTranslation  bool                   `json:"auto_translation"`
	MachineTranslated bool                  `json:"machine_translated"`
	Release          string                 `json:"release"`
	Comments         string                 `json:"comments"`
	LegacySubtitleID int                    `json:"legacy_subtitle_id"`
	Uploader         OpenSubtitleUploader   `json:"uploader"`
	FeatureDetails   OpenSubtitleFeature    `json:"feature_details"`
	URL              string                 `json:"url"`
	RelatedLinks     interface{}            `json:"related_links"` // Can be array or object
	Files            []OpenSubtitleFile     `json:"files"`
}

type OpenSubtitleUploader struct {
	UploaderID int    `json:"uploader_id"`
	Name       string `json:"name"`
	Rank       string `json:"rank"`
}

type OpenSubtitleFeature struct {
	FeatureID   int    `json:"feature_id"`
	FeatureType string `json:"feature_type"`
	Year        int    `json:"year"`
	Title       string `json:"title"`
	MovieName   string `json:"movie_name"`
	ImdbID      int    `json:"imdb_id"`
	TmdbID      int    `json:"tmdb_id"`
}

type OpenSubtitleFile struct {
	FileID   int    `json:"file_id"`
	CdNumber int    `json:"cd_number"`
	FileName string `json:"file_name"`
}

type OpenSubtitlesDownloadResponse struct {
	Link     string `json:"link"`
	FileName string `json:"file_name"`
	Requests int    `json:"requests"`
	Remaining int   `json:"remaining"`
	Message  string `json:"message"`
	ResetTime string `json:"reset_time"`
}

type SubtitleSearchRequest struct {
	Query    string `json:"query"`
	Language string `json:"language,omitempty"`
	Year     string `json:"year,omitempty"`
	ImdbID   string `json:"imdb_id,omitempty"`
	TmdbID   string `json:"tmdb_id,omitempty"`
}

type SubtitleDownloadRequest struct {
	FileID interface{} `json:"file_id"` // Can be int or string from API
}

func NewOpenSubtitlesService() *OpenSubtitlesService {
	return &OpenSubtitlesService{
		apiKey:   os.Getenv("OPENSUB_API_KEY"),
		username: os.Getenv("OPENSUB_USERNAME"),
		password: os.Getenv("OPENSUB_PASSWORD"),
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *OpenSubtitlesService) IsConfigured() bool {
	return s.apiKey != ""
}

// retryWithBackoff performs HTTP request with exponential backoff retry logic
func (s *OpenSubtitlesService) retryWithBackoff(req *http.Request, maxRetries int) (*http.Response, error) {
	var resp *http.Response
	var err error
	
	for attempt := 0; attempt <= maxRetries; attempt++ {
		resp, err = s.client.Do(req)
		if err != nil {
			if attempt < maxRetries {
				backoffDuration := time.Duration(math.Pow(2, float64(attempt))) * time.Second
				// Add jitter to prevent thundering herd
				jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
				totalWait := backoffDuration + jitter
				fmt.Printf("⏳ Retry attempt %d/%d after %v (backoff: %v + jitter: %v)\n", 
					attempt+1, maxRetries, totalWait, backoffDuration, jitter)
				time.Sleep(totalWait)
				continue
			}
			return nil, err
		}
		
		// Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
		if resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests {
			if attempt < maxRetries {
				backoffDuration := time.Duration(math.Pow(2, float64(attempt))) * time.Second
				jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
				totalWait := backoffDuration + jitter
				
				// Read and discard response body to reuse connection
				io.ReadAll(resp.Body)
				resp.Body.Close()
				
				retryAfter := resp.Header.Get("Retry-After")
				if retryAfter != "" {
					fmt.Printf("⏳ Server requested retry after: %s\n", retryAfter)
				}
				
				fmt.Printf("⏳ Retry attempt %d/%d after %v (Status: %d)\n", 
					attempt+1, maxRetries, totalWait, resp.StatusCode)
				time.Sleep(totalWait)
				
				// Create a fresh request for the next attempt
				newReq := &http.Request{
					Method:   req.Method,
					URL:      req.URL,
					Header:   req.Header.Clone(),
					Body:     req.Body,
					Host:     req.Host,
				}
				// Reset body if it was seekable
				if req.Body != nil {
					if closer, ok := req.Body.(io.Closer); ok {
						closer.Close()
					}
				}
				req = newReq
				continue
			}
		}
		
		// Success or non-retryable error
		return resp, nil
	}
	
	return resp, nil
}


func (s *OpenSubtitlesService) Login() error {
	if s.username == "" || s.password == "" {
		return fmt.Errorf("username and password required for login")
	}

	fmt.Printf("🔐 Attempting OpenSubtitles login with username: %s\n", s.username)

	loginData := map[string]string{
		"username": s.username,
		"password": s.password,
	}

	jsonData, err := json.Marshal(loginData)
	if err != nil {
		return fmt.Errorf("failed to marshal login data: %v", err)
	}

	req, err := http.NewRequest("POST", openSubtitlesBaseURL+"/login", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create login request: %v", err)
	}

	req.Header.Set("Api-Key", s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "HomeFlix v1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("login request failed: %v", err)
	}
	defer resp.Body.Close()

	fmt.Printf("🔐 Login Response Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Login Error Response: %s\n", string(body))
		return fmt.Errorf("login failed with status %d: %s", resp.StatusCode, string(body))
	}

	var loginResponse struct {
		User   map[string]interface{} `json:"user"`
		Token  string                 `json:"token"`
		Status interface{}            `json:"status"` // Can be string or number
	}

	if err := json.NewDecoder(resp.Body).Decode(&loginResponse); err != nil {
		return fmt.Errorf("failed to decode login response: %v", err)
	}

	if loginResponse.Token == "" {
		return fmt.Errorf("no token received from login")
	}

	s.token = loginResponse.Token
	fmt.Printf("✅ Login successful! Token length: %d\n", len(s.token))
	return nil
}

func (s *OpenSubtitlesService) SearchSubtitles(req SubtitleSearchRequest) (*OpenSubtitlesSearchResult, error) {
	if !s.IsConfigured() {
		return nil, fmt.Errorf("OpenSubtitles API key not configured")
	}

	// Build query parameters
	params := url.Values{}
	if req.Query != "" {
		params.Set("query", req.Query)
	}
	if req.Language != "" {
		params.Set("languages", req.Language)
	} else {
		params.Set("languages", "en") // Default to English
	}
	if req.Year != "" {
		params.Set("year", req.Year)
	}
	if req.ImdbID != "" {
		params.Set("imdb_id", req.ImdbID)
	}
	if req.TmdbID != "" {
		params.Set("tmdb_id", req.TmdbID)
	}

	// Add ordering and limit
	params.Set("order_by", "download_count")
	params.Set("order_direction", "desc")

	searchURL := fmt.Sprintf("%s/subtitles?%s", openSubtitlesBaseURL, params.Encode())
	fmt.Printf("🔍 OpenSubtitles Search URL: %s\n", searchURL)

	httpReq, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %v", err)
	}

	httpReq.Header.Set("Api-Key", s.apiKey)
	httpReq.Header.Set("User-Agent", "HomeFlix v1.0")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %v", err)
	}
	defer resp.Body.Close()

	fmt.Printf("📊 OpenSubtitles API Response Status: %d\n", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ OpenSubtitles API Error Response: %s\n", string(body))
		return nil, fmt.Errorf("search failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Read the response body for debugging
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	// Truncate response for logging
	responsePreview := string(body)
	if len(responsePreview) > 500 {
		responsePreview = responsePreview[:500] + "..."
	}
	fmt.Printf("📝 OpenSubtitles Raw Response (first 500 chars): %s\n", responsePreview)

	var searchResult OpenSubtitlesSearchResult
	if err := json.Unmarshal(body, &searchResult); err != nil {
		fmt.Printf("❌ JSON Unmarshal Error: %v\n", err)
		fmt.Printf("📝 Full Response Body: %s\n", string(body))
		return nil, fmt.Errorf("failed to decode search response: %v", err)
	}

	fmt.Printf("✅ Successfully parsed %d subtitle results\n", len(searchResult.Data))
	return &searchResult, nil
}

func (s *OpenSubtitlesService) DownloadSubtitle(fileID int) (*OpenSubtitlesDownloadResponse, []byte, error) {
	if !s.IsConfigured() {
		return nil, nil, fmt.Errorf("OpenSubtitles API key not configured")
	}

	// Ensure we're logged in
	if s.token == "" {
		if err := s.Login(); err != nil {
			return nil, nil, fmt.Errorf("failed to login: %v", err)
		}
	}

	downloadReq := SubtitleDownloadRequest{
		FileID: fileID,
	}

	jsonData, err := json.Marshal(downloadReq)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to marshal download request: %v", err)
	}

	fmt.Printf("📋 Download request JSON: %s\n", string(jsonData))

	// Helper function to create a fresh request
	createRequest := func() *http.Request {
		reqBody := bytes.NewReader(jsonData)
		req, err := http.NewRequest("POST", openSubtitlesBaseURL+"/download", reqBody)
		if err != nil {
			return nil
		}

		req.Header.Set("Api-Key", s.apiKey)
		req.Header.Set("Authorization", "Bearer "+s.token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "HomeFlix v1.0")
		
		return req
	}

	tokenPreview := s.token
	if len(tokenPreview) > 20 {
		tokenPreview = tokenPreview[:20]
	}
	fmt.Printf("📤 Requesting download for fileID: %d with token: %s...\n", fileID, tokenPreview)

	// Create initial request and use retry logic with exponential backoff
	req := createRequest()
	resp, err := s.retryWithBackoff(req, 3) // Retry up to 3 times
	if err != nil {
		return nil, nil, fmt.Errorf("download request failed: %v", err)
	}
	defer resp.Body.Close()

	fmt.Printf("📊 Download Response Status: %d\n", resp.StatusCode)

	if resp.StatusCode == http.StatusUnauthorized {
		fmt.Println("🔄 Token expired, attempting re-login...")
		// Token might be expired, try to login again
		if err := s.Login(); err != nil {
			return nil, nil, fmt.Errorf("failed to re-login: %v", err)
		}
		
		// Retry the request with new token
		req := createRequest()
		resp, err = s.retryWithBackoff(req, 3)
		if err != nil {
			return nil, nil, fmt.Errorf("retry download request failed: %v", err)
		}
		defer resp.Body.Close()
		fmt.Printf("📊 Retry Response Status: %d\n", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Download API Error (Status %d):\n", resp.StatusCode)
		fmt.Printf("   Response: %s\n", string(body))
		fmt.Printf("   Headers: %v\n", resp.Header)
		return nil, nil, fmt.Errorf("download failed with status %d: %s", resp.StatusCode, string(body))
	}

	var downloadResp OpenSubtitlesDownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&downloadResp); err != nil {
		return nil, nil, fmt.Errorf("failed to decode download response: %v", err)
	}
	
	fmt.Printf("✅ Download response decoded: Link=%s, FileName=%s, Remaining=%d\n", downloadResp.Link, downloadResp.FileName, downloadResp.Remaining)

	if downloadResp.Link == "" {
		return nil, nil, fmt.Errorf("no download link provided")
	}

	fmt.Printf("🔗 Download link received: %s\n", downloadResp.Link)

	// Download the actual subtitle file
	fileResp, err := http.Get(downloadResp.Link)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to download subtitle file: %v", err)
	}
	defer fileResp.Body.Close()

	fmt.Printf("📥 File download status: %d\n", fileResp.StatusCode)
	fmt.Printf("📥 File download headers: %v\n", fileResp.Header)

	if fileResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(fileResp.Body)
		return nil, nil, fmt.Errorf("subtitle file download failed with status %d: %s", fileResp.StatusCode, string(body))
	}

	subtitleData, err := io.ReadAll(fileResp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read subtitle data: %v", err)
	}

	fmt.Printf("✅ Successfully downloaded %d bytes of subtitle data\n", len(subtitleData))
	fmt.Printf("📊 Content-Type: %s\n", fileResp.Header.Get("Content-Type"))
	fmt.Printf("📊 Content-Disposition: %s\n", fileResp.Header.Get("Content-Disposition"))
	
	return &downloadResp, subtitleData, nil
}

// Helper function to extract language from filename (similar to existing one)
func (s *OpenSubtitlesService) ExtractLanguageFromFilename(filename string) string {
	langPatterns := map[string]string{
		"en": "English", "eng": "English", "english": "English",
		"es": "Spanish", "spa": "Spanish", "spanish": "Spanish",
		"fr": "French", "fre": "French", "french": "French",
		"de": "German", "ger": "German", "german": "German",
		"it": "Italian", "ita": "Italian", "italian": "Italian",
		"pt": "Portuguese", "por": "Portuguese", "portuguese": "Portuguese",
		"ru": "Russian", "rus": "Russian", "russian": "Russian",
		"ja": "Japanese", "jpn": "Japanese", "japanese": "Japanese",
		"ko": "Korean", "kor": "Korean", "korean": "Korean",
		"zh": "Chinese", "chi": "Chinese", "chinese": "Chinese",
		"ar": "Arabic", "ara": "Arabic", "arabic": "Arabic",
		"nl": "Dutch", "dut": "Dutch", "dutch": "Dutch",
		"sv": "Swedish", "swe": "Swedish", "swedish": "Swedish",
		"no": "Norwegian", "nor": "Norwegian", "norwegian": "Norwegian",
		"da": "Danish", "dan": "Danish", "danish": "Danish",
		"fi": "Finnish", "fin": "Finnish", "finnish": "Finnish",
		"pl": "Polish", "pol": "Polish", "polish": "Polish",
		"tr": "Turkish", "tur": "Turkish", "turkish": "Turkish",
		"he": "Hebrew", "heb": "Hebrew", "hebrew": "Hebrew",
		"th": "Thai", "tha": "Thai", "thai": "Thai",
		"vi": "Vietnamese", "vie": "Vietnamese", "vietnamese": "Vietnamese",
	}

	lowerFilename := strings.ToLower(filename)
	
	// Try to find language patterns in filename
	for code, language := range langPatterns {
		patterns := []string{
			fmt.Sprintf(`\.%s\.`, code),
			fmt.Sprintf(`_%s_`, code),
			fmt.Sprintf(`-%s-`, code),
			fmt.Sprintf(`\.%s$`, code),
			fmt.Sprintf(`_%s$`, code),
			fmt.Sprintf(`-%s$`, code),
		}
		
		for _, pattern := range patterns {
			if strings.Contains(lowerFilename, pattern) {
				return language
			}
		}
	}
	
	return "English" // Default to English
}

// GetSupportedLanguages returns a list of commonly supported languages
func (s *OpenSubtitlesService) GetSupportedLanguages() []map[string]string {
	return []map[string]string{
		{"code": "en", "name": "English"},
		{"code": "es", "name": "Spanish"},
		{"code": "fr", "name": "French"},
		{"code": "de", "name": "German"},
		{"code": "it", "name": "Italian"},
		{"code": "pt", "name": "Portuguese"},
		{"code": "ru", "name": "Russian"},
		{"code": "ja", "name": "Japanese"},
		{"code": "ko", "name": "Korean"},
		{"code": "zh", "name": "Chinese"},
		{"code": "ar", "name": "Arabic"},
		{"code": "nl", "name": "Dutch"},
		{"code": "sv", "name": "Swedish"},
		{"code": "no", "name": "Norwegian"},
		{"code": "da", "name": "Danish"},
		{"code": "fi", "name": "Finnish"},
		{"code": "pl", "name": "Polish"},
		{"code": "tr", "name": "Turkish"},
		{"code": "he", "name": "Hebrew"},
		{"code": "th", "name": "Thai"},
		{"code": "vi", "name": "Vietnamese"},
	}
}
