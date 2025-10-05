package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

type GeminiService struct {
	apiKey     string
	model      string
	ollamaURL  string
	ollamaModel string
	fallbackService *MetadataFallbackService
}

type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

// Ollama API structures
type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type OllamaResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

type MediaMetadata struct {
	Title       string   `json:"title"`
	Tagline     string   `json:"tagline"`
	ShortDesc   string   `json:"short_desc"`
	LongDesc    string   `json:"long_desc"`
	Description string   `json:"description"`
	Year        int      `json:"year"`
	Stars       []string `json:"stars"`
	Directors   []string `json:"directors"`
	Country     string   `json:"country"`
	Language    string   `json:"language"`
	Quality     string   `json:"quality"`
	Genres      []string `json:"genres"`
	Rating      float64  `json:"rating"`
	PosterURL   string   `json:"poster_url"`
	BackdropURL string   `json:"backdrop_url"`
	Runtime     int      `json:"runtime"`
	// Box office and additional metadata
	Budget      int64    `json:"budget"`
	Revenue     int64    `json:"revenue"`
	BoxOffice   string   `json:"box_office"`   // Formatted box office string
	Status      string   `json:"status"`       // Released, Post Production, etc.
	IMDBID      string   `json:"imdb_id"`
	Homepage    string   `json:"homepage"`
	Collection  string   `json:"collection"`   // Movie collection/franchise
	Cast        []string `json:"cast"`         // Full cast list (more than just stars)
	Crew        []string `json:"crew"`         // Key crew members
	Writers     []string `json:"writers"`      // Writers/Screenplay
	Producers   []string `json:"producers"`    // Producers
}

func NewGeminiService() *GeminiService {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Printf("Warning: GEMINI_API_KEY not set, will use Ollama fallback")
	}

	model := os.Getenv("DEFAULT_MODEL")
	if model == "" {
		model = "gemini-2.0-flash-exp" // Default model
	}

	// Ollama configuration
	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434" // Default Ollama URL
	}

	ollamaModel := os.Getenv("OLLAMA_MODEL")
	if ollamaModel == "" {
		ollamaModel = "llama3.2:3b" // Default Ollama model
	}

	// Initialize fallback service
	fallbackService := NewMetadataFallbackService("media.json")
	fallbackService.LoadMetadata()

	return &GeminiService{
		apiKey:     apiKey,
		model:      model,
		ollamaURL:  ollamaURL,
		ollamaModel: ollamaModel,
		fallbackService: fallbackService,
	}
}

func (s *GeminiService) GenerateMediaMetadata(filename string, existingTitle string) (*MediaMetadata, error) {
	prompt := fmt.Sprintf(`Analyze this media file and generate comprehensive metadata in JSON format.

Filename: %s
Existing Title: %s

Generate the following information:
1. Title (clean, proper title)
2. Tagline (catchy one-liner)
3. Description (detailed plot summary, 2-3 sentences)
4. Year (release year, estimate if unknown)
5. Stars (main actors/actresses, array of names)
6. Directors (director names, array)
7. Country (country of origin)
8. Genres (array of genre tags)
9. Rating (estimated rating 1-10)

Return ONLY valid JSON in this exact format:
{
  "title": "Movie Title",
  "tagline": "Catchy tagline",
  "description": "Detailed description",
  "year": 2024,
  "stars": ["Actor 1", "Actor 2"],
  "directors": ["Director Name"],
  "country": "USA",
  "genres": ["Action", "Drama"],
  "rating": 8.5
}`, filename, existingTitle)

	// Try Gemini first, fallback to Ollama if it fails
	var response string
	var err error
	
	if s.apiKey != "" {
		log.Printf("Trying Gemini API for %s", filename)
		response, err = s.callGemini(prompt)
		if err != nil {
			log.Printf("Gemini API failed for %s: %v, trying Ollama fallback", filename, err)
			response, err = s.callOllama(prompt)
			if err != nil {
				log.Printf("Both Gemini and Ollama failed for %s: %v, using filename-based fallback", filename, err)
				return s.generateFallbackMetadata(filename, existingTitle)
			}
		}
	} else {
		log.Printf("Using Ollama for %s (no Gemini API key)", filename)
		response, err = s.callOllama(prompt)
		if err != nil {
			log.Printf("Ollama failed for %s: %v, using filename-based fallback", filename, err)
			return s.generateFallbackMetadata(filename, existingTitle)
		}
	}

	// Parse JSON response
	var metadata MediaMetadata
	
	// First try to extract JSON from response
	cleanResponse := extractJSON(response)
	
	// Log the response for debugging
	log.Printf("AI response for %s: %s", filename, cleanResponse)
	
	if err := json.Unmarshal([]byte(cleanResponse), &metadata); err != nil {
		log.Printf("Failed to parse JSON for %s: %v\nResponse: %s", filename, err, cleanResponse)
		log.Printf("Using filename-based fallback for %s", filename)
		return s.generateFallbackMetadata(filename, existingTitle)
	}

	// Store successful AI metadata in fallback cache for future use
	s.storeFallbackMetadata(filename, &metadata)

	return &metadata, nil
}

// generateFallbackMetadata creates metadata from filename when AI services fail
func (s *GeminiService) generateFallbackMetadata(filename string, _ string) (*MediaMetadata, error) {
	// Check if we have cached metadata first
	if fallbackMeta := s.fallbackService.GetFallbackMetadata(filename); fallbackMeta != nil {
		// Convert fallback metadata to GeminiService MediaMetadata format
		metadata := &MediaMetadata{
			Title:       fallbackMeta.Title,
			Tagline:     fallbackMeta.Tagline,
			ShortDesc:   fallbackMeta.ShortDesc,
			LongDesc:    fallbackMeta.LongDesc,
			Description: fallbackMeta.LongDesc,
			Year:        fallbackMeta.Year,
			Stars:       fallbackMeta.Stars,
			Directors:   fallbackMeta.Director,
			Country:     fallbackMeta.Country,
			Language:    fallbackMeta.Language,
			Quality:     fallbackMeta.Quality,
			Genres:      fallbackMeta.Genres,
			Rating:      fallbackMeta.Rating,
		}
		
		if metadata.Rating == 0 {
			metadata.Rating = 7.0 // Default rating
		}
		
		log.Printf("Using filename-based metadata for %s: %s", filename, metadata.Title)
		return metadata, nil
	}
	
	return nil, fmt.Errorf("failed to generate fallback metadata for %s", filename)
}

// storeFallbackMetadata stores AI-generated metadata in the fallback cache
func (s *GeminiService) storeFallbackMetadata(filename string, metadata *MediaMetadata) {
	fallbackMeta := s.fallbackService.ExtractMetadataFromFilename(filename)
	
	// Update with AI-generated data
	fallbackMeta.Title = metadata.Title
	fallbackMeta.Tagline = metadata.Tagline
	fallbackMeta.ShortDesc = metadata.ShortDesc
	fallbackMeta.LongDesc = metadata.LongDesc
	fallbackMeta.Year = metadata.Year
	fallbackMeta.Genres = metadata.Genres
	fallbackMeta.Stars = metadata.Stars
	fallbackMeta.Director = metadata.Directors
	fallbackMeta.Country = metadata.Country
	fallbackMeta.Language = metadata.Language
	fallbackMeta.Quality = metadata.Quality
	fallbackMeta.Rating = metadata.Rating
	
	s.fallbackService.AddMetadata(filename, fallbackMeta)
	s.fallbackService.SaveMetadata()
}

func (s *GeminiService) GenerateRecommendations(mediaTitle string, genres []string, watchHistory []string) ([]string, error) {
	prompt := fmt.Sprintf(`Based on the following information, recommend 10 similar movies or TV shows:

Current Media: %s
Genres: %v
Recently Watched: %v

Provide recommendations that match the genre and style. Return ONLY a JSON array of titles:
["Title 1", "Title 2", "Title 3", ...]`, mediaTitle, genres, watchHistory)

	response, err := s.callGemini(prompt)
	if err != nil {
		return nil, err
	}

	var recommendations []string
	response = extractJSON(response)
	if err := json.Unmarshal([]byte(response), &recommendations); err != nil {
		return nil, fmt.Errorf("failed to parse recommendations: %w", err)
	}

	return recommendations, nil
}

func (s *GeminiService) callGemini(prompt string) (string, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", 
		s.model, s.apiKey)

	requestBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: prompt},
				},
			},
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API error: %s", string(body))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

func (s *GeminiService) callOllama(prompt string) (string, error) {
	url := fmt.Sprintf("%s/api/generate", s.ollamaURL)
	
	requestBody := OllamaRequest{
		Model:  s.ollamaModel,
		Prompt: prompt,
		Stream: false,
	}
	
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}
	
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("ollama request failed: %w", err)
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama API error: %s", string(body))
	}
	
	var ollamaResp OllamaResponse
	if err := json.Unmarshal(body, &ollamaResp); err != nil {
		return "", err
	}
	
	if ollamaResp.Response == "" {
		return "", fmt.Errorf("no response from Ollama")
	}
	
	return ollamaResp.Response, nil
}

func extractJSON(text string) string {
	// Remove markdown code blocks and extract JSON
	text = strings.TrimSpace(text)
	
	// Look for ```json blocks
	if start := strings.Index(text, "```json"); start != -1 {
		text = text[start+7:]
		if end := strings.Index(text, "```"); end != -1 {
			text = text[:end]
		}
	} else if start := strings.Index(text, "```"); start != -1 {
		// Look for generic ``` blocks
		text = text[start+3:]
		if end := strings.Index(text, "```"); end != -1 {
			text = text[:end]
		}
	}
	
	// Find JSON object boundaries
	start := strings.Index(text, "{")
	if start == -1 {
		return text // No JSON found, return as is
	}
	
	// Find the matching closing brace
	braceCount := 0
	end := -1
	for i := start; i < len(text); i++ {
		if text[i] == '{' {
			braceCount++
		} else if text[i] == '}' {
			braceCount--
			if braceCount == 0 {
				end = i + 1
				break
			}
		}
	}
	
	if end != -1 {
		text = text[start:end]
	}
	
	return strings.TrimSpace(text)
}
