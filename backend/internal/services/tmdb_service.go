package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type TMDBService struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type TMDBSearchResponse struct {
	Results []TMDBMovie `json:"results"`
}

type TMDBMovie struct {
	ID               int     `json:"id"`
	Title            string  `json:"title"`
	OriginalTitle    string  `json:"original_title"`
	Overview         string  `json:"overview"`
	ReleaseDate      string  `json:"release_date"`
	PosterPath       string  `json:"poster_path"`
	BackdropPath     string  `json:"backdrop_path"`
	GenreIDs         []int   `json:"genre_ids"`
	VoteAverage      float64 `json:"vote_average"`
	VoteCount        int     `json:"vote_count"`
	Popularity       float64 `json:"popularity"`
	Adult            bool    `json:"adult"`
	Video            bool    `json:"video"`
	OriginalLanguage string  `json:"original_language"`
}

type TMDBMovieDetails struct {
	TMDBMovie
	Tagline             string          `json:"tagline"`
	Runtime             int             `json:"runtime"`
	Budget              int64           `json:"budget"`
	Revenue             int64           `json:"revenue"`
	Status              string          `json:"status"`
	Genres              []TMDBGenre     `json:"genres"`
	ProductionCompanies []TMDBCompany   `json:"production_companies"`
	ProductionCountries []TMDBCountry   `json:"production_countries"`
	SpokenLanguages     []TMDBLanguage  `json:"spoken_languages"`
	Credits             TMDBCredits     `json:"credits,omitempty"`
	IMDBID              string          `json:"imdb_id"`
	Homepage            string          `json:"homepage"`
	BelongsToCollection *TMDBCollection `json:"belongs_to_collection"`
}

type TMDBCollection struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
}

type TMDBGenre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type TMDBCompany struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type TMDBCountry struct {
	ISO31661 string `json:"iso_3166_1"`
	Name     string `json:"name"`
}

type TMDBLanguage struct {
	ISO6391 string `json:"iso_639_1"`
	Name    string `json:"name"`
}

type TMDBCredits struct {
	Cast []TMDBCast `json:"cast"`
	Crew []TMDBCrew `json:"crew"`
}

type TMDBCast struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Character string `json:"character"`
	Order     int    `json:"order"`
}

type TMDBCrew struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Job        string `json:"job"`
	Department string `json:"department"`
}

func NewTMDBService() *TMDBService {
	apiKey := os.Getenv("TMDB_API_KEY")
	if apiKey == "" {
		fmt.Println("Warning: TMDB_API_KEY not set")
	}

	return &TMDBService{
		apiKey:  apiKey,
		baseURL: "https://api.themoviedb.org/3",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (t *TMDBService) SearchMovie(title string, year int) (*TMDBMovie, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	// Try search with year first if year is provided
	if year > 0 {
		if movie, err := t.searchMovieWithParams(title, year); err == nil && movie != nil {
			return movie, nil
		}
	}

	// Fallback: search without year constraint
	return t.searchMovieWithParams(title, 0)
}

func (t *TMDBService) searchMovieWithParams(title string, year int) (*TMDBMovie, error) {
	searchURL := fmt.Sprintf("%s/search/movie", t.baseURL)
	params := url.Values{}
	params.Add("query", title)
	if year > 0 {
		params.Add("year", strconv.Itoa(year))
	}

	req, err := http.NewRequest("GET", searchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}

	var searchResp TMDBSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	if len(searchResp.Results) == 0 {
		return nil, fmt.Errorf("no results found for: %s", title)
	}

	// Return the first result (most relevant)
	return &searchResp.Results[0], nil
}

func (t *TMDBService) GetMovieDetails(movieID int) (*TMDBMovieDetails, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	detailsURL := fmt.Sprintf("%s/movie/%d", t.baseURL, movieID)
	params := url.Values{}
	params.Add("append_to_response", "credits")

	req, err := http.NewRequest("GET", detailsURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}

	var details TMDBMovieDetails
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, err
	}

	return &details, nil
}

func (t *TMDBService) GenerateMediaMetadata(filePath, title string) (*MediaMetadata, error) {
	// Extract year from title if present
	year := t.extractYear(title)
	cleanTitle := t.cleanTitle(title)
	
	// Remove year from the clean title for better search results
	// The year will be used as a separate search parameter
	cleanTitleWithoutYear := t.removeYearFromTitle(cleanTitle)

	// Try multiple search strategies
	var movie *TMDBMovie
	var err error

	// Strategy 1: Search with clean title (without year) and year parameter
	movie, err = t.SearchMovie(cleanTitleWithoutYear, year)
	if err != nil {
		// Strategy 2: Try with the original clean title (may include year)
		movie, err = t.SearchMovie(cleanTitle, year)
		if err != nil {
			// Strategy 3: Try simple title extraction as last resort
			simpleTitle := t.simpleCleanTitle(title)
			simpleTitleWithoutYear := t.removeYearFromTitle(simpleTitle)
			movie, err = t.SearchMovie(simpleTitleWithoutYear, year)
			if err != nil {
				return nil, fmt.Errorf("failed to find movie metadata for '%s': %w", title, err)
			}
		}
	}

	// Get detailed information
	details, err := t.GetMovieDetails(movie.ID)
	if err != nil {
		return nil, err
	}

	// Extract cast (stars) - top 5 for stars, more for full cast
	var stars []string
	var cast []string
	for i, castMember := range details.Credits.Cast {
		if i < 5 { // Top 5 stars
			stars = append(stars, castMember.Name)
		}
		if i < 15 { // Top 15 for full cast
			cast = append(cast, fmt.Sprintf("%s (%s)", castMember.Name, castMember.Character))
		}
	}

	// Extract crew by roles
	var directors []string
	var writers []string
	var producers []string
	var crew []string

	for _, crewMember := range details.Credits.Crew {
		switch crewMember.Job {
		case "Director":
			directors = append(directors, crewMember.Name)
		case "Writer", "Screenplay", "Story":
			writers = append(writers, crewMember.Name)
		case "Producer", "Executive Producer":
			producers = append(producers, crewMember.Name)
		case "Director of Photography", "Cinematography", "Music", "Editor":
			crew = append(crew, fmt.Sprintf("%s (%s)", crewMember.Name, crewMember.Job))
		}
	}

	// Extract genres
	var genres []string
	for _, genre := range details.Genres {
		genres = append(genres, genre.Name)
	}

	// Extract country
	var country string
	if len(details.ProductionCountries) > 0 {
		country = details.ProductionCountries[0].Name
	}

	// Extract language
	var language string
	if len(details.SpokenLanguages) > 0 {
		language = details.SpokenLanguages[0].Name
	}

	// Extract year from release date
	releaseYear := 0
	if details.ReleaseDate != "" {
		if parsedTime, err := time.Parse("2006-01-02", details.ReleaseDate); err == nil {
			releaseYear = parsedTime.Year()
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	backdropURL := ""
	if details.PosterPath != "" {
		posterURL = "https://image.tmdb.org/t/p/w500" + details.PosterPath
	}
	if details.BackdropPath != "" {
		backdropURL = "https://image.tmdb.org/t/p/w1280" + details.BackdropPath
	}

	// Format box office information
	boxOffice := ""
	if details.Revenue > 0 {
		boxOffice = t.formatCurrency(details.Revenue)
	}

	// Collection information
	collection := ""
	if details.BelongsToCollection != nil {
		collection = details.BelongsToCollection.Name
	}

	metadata := &MediaMetadata{
		Title:       details.Title,
		Tagline:     details.Tagline,
		ShortDesc:   t.truncateText(details.Overview, 150),
		LongDesc:    details.Overview,
		Description: details.Overview,
		Year:        releaseYear,
		Stars:       stars,
		Directors:   directors,
		Country:     country,
		Language:    language,
		Quality:     "HD", // Default quality
		Rating:      details.VoteAverage,
		Genres:      genres,
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		Runtime:     details.Runtime,
		// Enhanced metadata
		Budget:     details.Budget,
		Revenue:    details.Revenue,
		BoxOffice:  boxOffice,
		Status:     details.Status,
		IMDBID:     details.IMDBID,
		Homepage:   details.Homepage,
		Collection: collection,
		Cast:       cast,
		Crew:       crew,
		Writers:    writers,
		Producers:  producers,
	}

	return metadata, nil
}

// CleanTitle is a public method that exposes the title cleaning functionality
func (t *TMDBService) CleanTitle(title string) string {
	return t.cleanTitle(title)
}

// RemoveYearFromTitle is a public method that removes year from title for cleaner searches
func (t *TMDBService) RemoveYearFromTitle(title string) string {
	return t.removeYearFromTitle(title)
}

// removeYearFromTitle removes year patterns from a cleaned title for better TMDB search
// This allows TMDB to match movies more accurately by using the year as a separate search parameter
// rather than having it embedded in the title string
func (t *TMDBService) removeYearFromTitle(title string) string {
	// Remove year patterns like (2019), [2019], {2019}
	bracketYearPattern := regexp.MustCompile(`\s*[\[\(\{]\s*(19\d{2}|20\d{2})\s*[\]\)\}]\s*`)
	title = bracketYearPattern.ReplaceAllString(title, " ")
	
	// Remove standalone years at the end of title
	endYearPattern := regexp.MustCompile(`\s+(19\d{2}|20\d{2})\s*$`)
	title = endYearPattern.ReplaceAllString(title, "")
	
	// Remove years surrounded by separators
	separatorYearPattern := regexp.MustCompile(`\s*[\._\-\s](19\d{2}|20\d{2})[\._\-\s]*`)
	title = separatorYearPattern.ReplaceAllString(title, " ")
	
	// Clean up multiple spaces and trim
	title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
	title = strings.TrimSpace(title)
	
	return title
}

func (t *TMDBService) cleanTitle(title string) string {
	// First, extract the base filename without extension
	baseName := filepath.Base(title)
	ext := filepath.Ext(baseName)
	baseName = strings.TrimSuffix(baseName, ext)

	// Step 1: Extract year FIRST before any other processing
	originalBaseName := baseName
	yearPattern := regexp.MustCompile("\\b(19|20)\\d{2}\\b")
	yearMatches := yearPattern.FindAllString(originalBaseName, -1)
	var extractedYear string
	if len(yearMatches) > 0 {
		// Use the last year found (usually the release year)
		extractedYear = yearMatches[len(yearMatches)-1]
	}

	// Step 2: Replace common separators with spaces
	baseName = strings.ReplaceAll(baseName, ".", " ")
	baseName = strings.ReplaceAll(baseName, "_", " ")
	baseName = strings.ReplaceAll(baseName, "-", " ")

	// Step 3: Extract the main title before quality indicators (excluding years from the cut pattern)
	titleEndPattern := regexp.MustCompile("(?i)\\s*(\\b(1080p|2160p|720p|480p|4K|8K|UHD|FHD|HD|BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB|HDTV|HDRip|x264|x265|h264|h265|HEVC|AVC|XviD|10bit|8bit|HDR|AAC|AC3|DTS|5\\.1|7\\.1|YIFY|YTS|RARBG|PSA|ETRG)\\b)")
	
	// Find where the title likely ends
	titleEndIndex := titleEndPattern.FindStringIndex(baseName)
	if titleEndIndex != nil {
		// Extract everything before the quality indicators
		baseName = baseName[:titleEndIndex[0]]
	}

	// Step 3: Remove anything in brackets or parentheses that might remain
	bracketsPattern := regexp.MustCompile("[\\[\\{\\(][^\\]\\}\\)]*[\\]\\}\\)]*")
	baseName = bracketsPattern.ReplaceAllString(baseName, " ")

	// Step 4: Remove any remaining quality indicators that might have slipped through
	qualityPattern := regexp.MustCompile("(?i)\\b(" +
		"1080p|2160p|720p|480p|360p|4K|8K|UHD|FHD|HD|SD|" +
		"BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB|HDTV|HDRip|BrRip|" +
		"x264|x265|h264|h265|HEVC|AVC|XviD|" +
		"10bit|8bit|HDR|HDR10|DV|DoVi|" +
		"AAC|AC3|DTS|DDP|DD|EAC3|FLAC|MP3|Atmos|TrueHD|" +
		"5\\.1|7\\.1|2\\.0|2ch|6ch|8ch|" +
		"PROPER|REPACK|INTERNAL|LIMITED|SUBBED|DUBBED|UNRATED|" +
		"EXTENDED|THEATRICAL|DIRECTORS?\\.?CUT|DC|UNCUT|" +
		"REMASTERED|ANNIVERSARY|SPECIAL\\.?EDITION|SE|" +
		"MULTI|DUAL|VOSTFR|TRUEFRENCH|" +
		"COMPLETE|FULL|" +
		"ESub|ESubs|Subs?|Subtitle|Subtitles|" +
		"DVD|CD\\d|DISC\\d" +
		")\\b")
	baseName = qualityPattern.ReplaceAllString(baseName, " ")

	// Step 5: Remove release groups (specific known groups only)
	releaseGroupPattern := regexp.MustCompile("(?i)\\b(" +
		"YIFY|YTS|RARBG|PSA|ETRG|AMZN|NF|NETFLIX|ATVP|DSNP|" +
		"HMAX|HBO|HULU|DISNEY|APPLE|PARAMOUNT|" +
		"SPARKS|GECKOS|ROVERS|GALAXY|ORBS|CMRG|ETHiCS|" +
		"DEFLATE|STUTTERSHIT|VETO|BLOW|SCENE|FGT|" +
		"EVOLVE|KILLERS|DEMAND|FLEET|ION10|ION|" +
		"RARBG|ETRG|YIFY|YTS|MX" +
		")\\b")
	baseName = releaseGroupPattern.ReplaceAllString(baseName, " ")

	// Step 6: Keep years in the title for now (they'll be removed separately for TMDB search)
	// This preserves the original title structure while still extracting year for search parameter

	// Step 7: Remove episode/season patterns
	episodePattern := regexp.MustCompile("(?i)\\b(S\\d{1,2}E\\d{1,2}|Season\\s?\\d{1,2}|Episode\\s?\\d{1,2})\\b")
	baseName = episodePattern.ReplaceAllString(baseName, " ")

	// Step 8: Remove file size indicators
	sizePattern := regexp.MustCompile("(?i)\\b\\d+(\\.\\d+)?\\s?(GB|MB|GiB|MiB)\\b")
	baseName = sizePattern.ReplaceAllString(baseName, " ")

	// Step 9: Remove hash-like patterns and numeric IDs
	hashPattern := regexp.MustCompile("\\b[a-fA-F0-9]{8,}\\b")
	baseName = hashPattern.ReplaceAllString(baseName, " ")

	// Step 10: Remove leading numeric IDs
	numericPrefixPattern := regexp.MustCompile("^\\d{3,}[\\s]+")
	baseName = numericPrefixPattern.ReplaceAllString(baseName, "")

	// Step 11: Clean up special characters (but preserve apostrophes and basic punctuation)
	specialCharsPattern := regexp.MustCompile("[^\\p{L}\\p{N}\\s'&:!?.-]")
	baseName = specialCharsPattern.ReplaceAllString(baseName, " ")

	// Step 12: Clean up multiple spaces and trim
	baseName = regexp.MustCompile("\\s+").ReplaceAllString(baseName, " ")
	baseName = strings.TrimSpace(baseName)

	// Step 13: If we're left with a very short string or empty, try a fallback approach
	if len(baseName) <= 2 || baseName == "" {
		// Fallback: try to extract title from the original filename more conservatively
		originalBase := filepath.Base(title)
		originalBase = strings.TrimSuffix(originalBase, filepath.Ext(originalBase))
		
		// Look for the first major separator or quality indicator
		fallbackPattern := regexp.MustCompile("(?i)^([^\\[\\(]*?)\\s*[\\[\\(]")
		matches := fallbackPattern.FindStringSubmatch(originalBase)
		if len(matches) > 1 && strings.TrimSpace(matches[1]) != "" {
			baseName = strings.TrimSpace(matches[1])
			baseName = strings.ReplaceAll(baseName, ".", " ")
			baseName = strings.ReplaceAll(baseName, "_", " ")
			baseName = strings.ReplaceAll(baseName, "-", " ")
			baseName = regexp.MustCompile("\\s+").ReplaceAllString(baseName, " ")
			baseName = strings.TrimSpace(baseName)
		} else {
			// Last resort: use first few words before any numbers/quality indicators
			words := strings.Fields(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(originalBase, ".", " "), "_", " "), "-", " "))
			var titleWords []string
			for _, word := range words {
				// Stop at first quality indicator or year
				if regexp.MustCompile("(?i)^(19|20)\\d{2}$|^(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265)$").MatchString(word) {
					break
				}
				titleWords = append(titleWords, word)
				// Don't take more than 5 words for the title
				if len(titleWords) >= 5 {
					break
				}
			}
			if len(titleWords) > 0 {
				baseName = strings.Join(titleWords, " ")
			}
		}
	}

	// Step 14: Final fallback - if still empty or too short, use basic filename cleanup
	if len(baseName) <= 2 || baseName == "" {
		// Ultimate fallback: just clean the basic filename
		fallbackTitle := filepath.Base(title)
		fallbackTitle = strings.TrimSuffix(fallbackTitle, filepath.Ext(fallbackTitle))
		fallbackTitle = strings.ReplaceAll(fallbackTitle, ".", " ")
		fallbackTitle = strings.ReplaceAll(fallbackTitle, "_", " ")
		fallbackTitle = strings.ReplaceAll(fallbackTitle, "-", " ")
		fallbackTitle = regexp.MustCompile("\\s+").ReplaceAllString(fallbackTitle, " ")
		fallbackTitle = strings.TrimSpace(fallbackTitle)
		
		// If we have something reasonable, use it
		if len(fallbackTitle) > 2 {
			baseName = fallbackTitle
		}
	}

	// Step 15: Title case formatting
	if baseName != "" {
		words := strings.Fields(baseName)
		for i, word := range words {
			if len(word) > 0 {
				// Keep short articles/prepositions lowercase (except at start)
				if i > 0 && len(word) <= 3 && regexp.MustCompile("(?i)^(a|an|the|and|or|but|of|in|on|at|to|for|by|with)$").MatchString(word) {
					words[i] = strings.ToLower(word)
				} else {
					// Title case for other words
					words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
				}
			}
		}
		baseName = strings.Join(words, " ")
	}

	// Step 16: Add year back to the title if we found one and it's not already there
	if extractedYear != "" && baseName != "" {
		// Check if year is already in the title
		if !strings.Contains(baseName, extractedYear) {
			baseName = baseName + " (" + extractedYear + ")"
		}
	}

	// Final validation - check if the cleaned title makes sense
	if !t.isValidTitle(baseName) {
		// Try a simpler approach
		simpleTitle := t.simpleCleanTitle(title)
		if t.isValidTitle(simpleTitle) && len(simpleTitle) > len(baseName) {
			baseName = simpleTitle
		}
	}

	// Final safety check - if we still have nothing, return the original filename
	if baseName == "" {
		baseName = strings.TrimSuffix(filepath.Base(title), filepath.Ext(filepath.Base(title)))
		baseName = strings.ReplaceAll(baseName, ".", " ")
		baseName = strings.ReplaceAll(baseName, "_", " ")
		baseName = strings.ReplaceAll(baseName, "-", " ")
		baseName = regexp.MustCompile("\\s+").ReplaceAllString(baseName, " ")
		baseName = strings.TrimSpace(baseName)
	}

	return baseName
}

// isValidTitle checks if a title looks reasonable
func (t *TMDBService) isValidTitle(title string) bool {
	if title == "" || len(title) <= 2 {
		return false
	}
	
	// Check if title contains at least one letter
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(title)
	if !hasLetter {
		return false
	}
	
	// Check if title is mostly numbers (probably not a good title)
	words := strings.Fields(title)
	numberWords := 0
	for _, word := range words {
		if regexp.MustCompile(`^\d+$`).MatchString(word) {
			numberWords++
		}
	}
	
	// If more than half the words are numbers, it's probably not a good title
	if len(words) > 0 && float64(numberWords)/float64(len(words)) > 0.5 {
		return false
	}
	
	// Check for common bad patterns
	badPatterns := []string{
		`^[0-9\s]+$`,           // Only numbers and spaces
		`^[^a-zA-Z]*$`,         // No letters at all
		`^\s*$`,                // Only whitespace
	}
	
	for _, pattern := range badPatterns {
		if matched, _ := regexp.MatchString(pattern, title); matched {
			return false
		}
	}
	
	return true
}

// simpleCleanTitle provides a basic, conservative title cleaning
func (t *TMDBService) simpleCleanTitle(title string) string {
	baseName := filepath.Base(title)
	baseName = strings.TrimSuffix(baseName, filepath.Ext(baseName))
	
	// Replace separators with spaces
	baseName = strings.ReplaceAll(baseName, ".", " ")
	baseName = strings.ReplaceAll(baseName, "_", " ")
	baseName = strings.ReplaceAll(baseName, "-", " ")
	
	// Extract year first before cutting
	yearPattern := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	yearMatches := yearPattern.FindAllString(baseName, -1)
	var extractedYear string
	if len(yearMatches) > 0 {
		extractedYear = yearMatches[len(yearMatches)-1]
	}
	
	// Find the first occurrence of common quality indicators and cut there
	cutPattern := regexp.MustCompile(`(?i)\s*(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265|YIFY|YTS|RARBG)`)
	cutIndex := cutPattern.FindStringIndex(baseName)
	if cutIndex != nil {
		baseName = baseName[:cutIndex[0]]
	}
	
	// Keep year in the title for now (will be handled separately for TMDB search)
	
	// Clean up spaces
	baseName = regexp.MustCompile(`\s+`).ReplaceAllString(baseName, " ")
	baseName = strings.TrimSpace(baseName)
	
	// Title case
	if baseName != "" {
		words := strings.Fields(baseName)
		for i, word := range words {
			if len(word) > 0 {
				words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
			}
		}
		baseName = strings.Join(words, " ")
	}
	
	// Add year back if we found one and it's not already there
	if extractedYear != "" && baseName != "" {
		if !strings.Contains(baseName, extractedYear) {
			baseName = baseName + " (" + extractedYear + ")"
		}
	}
	
	return baseName
}

func (t *TMDBService) truncateText(text string, maxLength int) string {
	if len(text) <= maxLength {
		return text
	}

	// Find the last space before maxLength
	truncated := text[:maxLength]
	lastSpace := strings.LastIndex(truncated, " ")
	if lastSpace > 0 {
		truncated = truncated[:lastSpace]
	}

	return truncated + "..."
}

// formatCurrency formats a number as currency (USD)
func (t *TMDBService) formatCurrency(amount int64) string {
	if amount == 0 {
		return ""
	}

	// Convert to millions or billions for readability
	if amount >= 1000000000 {
		return fmt.Sprintf("$%.1fB", float64(amount)/1000000000)
	} else if amount >= 1000000 {
		return fmt.Sprintf("$%.1fM", float64(amount)/1000000)
	} else if amount >= 1000 {
		return fmt.Sprintf("$%.1fK", float64(amount)/1000)
	}

	return fmt.Sprintf("$%d", amount)
}

func (t *TMDBService) extractYear(title string) int {
	// Common year patterns in movie filenames:
	// - (2019), [2019], {2019}
	// - .2019., _2019_, -2019-
	// - 2019 (with spaces around it)

	// Pattern 1: Year in brackets/parentheses
	bracketPattern := regexp.MustCompile(`[\[\(\{](19\d{2}|20\d{2})[\]\)\}]`)
	if matches := bracketPattern.FindStringSubmatch(title); len(matches) > 1 {
		if year, err := strconv.Atoi(matches[1]); err == nil {
			if year >= 1900 && year <= time.Now().Year()+2 {
				return year
			}
		}
	}

	// Pattern 2: Year surrounded by dots, dashes, or underscores
	separatorPattern := regexp.MustCompile(`[\._\-\s](19\d{2}|20\d{2})[\._\-\s]`)
	if matches := separatorPattern.FindStringSubmatch(title); len(matches) > 1 {
		if year, err := strconv.Atoi(matches[1]); err == nil {
			if year >= 1900 && year <= time.Now().Year()+2 {
				return year
			}
		}
	}

	// Pattern 3: Year at the end of filename (before extension indicators)
	endPattern := regexp.MustCompile(`[\._\-\s](19\d{2}|20\d{2})(?:[\._\-\s]|$)`)
	if matches := endPattern.FindStringSubmatch(title); len(matches) > 1 {
		if year, err := strconv.Atoi(matches[1]); err == nil {
			if year >= 1900 && year <= time.Now().Year()+2 {
				return year
			}
		}
	}

	// Pattern 4: Year with word boundaries (avoids matching from numbers like 1080p)
	wordBoundaryPattern := regexp.MustCompile(`\b(19\d{2}|20\d{2})\b`)
	matches := wordBoundaryPattern.FindAllStringSubmatch(title, -1)

	// Return the last valid year found (usually most relevant)
	for i := len(matches) - 1; i >= 0; i-- {
		if len(matches[i]) > 1 {
			if year, err := strconv.Atoi(matches[i][1]); err == nil {
				// Additional validation: skip if it looks like a resolution
				// Check if followed by 'p' (like 1080p, 2160p)
				yearIndex := strings.Index(title, matches[i][1])
				if yearIndex >= 0 && yearIndex+4 < len(title) {
					nextChar := title[yearIndex+4]
					if nextChar == 'p' || nextChar == 'P' {
						continue // Skip this match, it's a resolution
					}
				}

				if year >= 1900 && year <= time.Now().Year()+2 {
					return year
				}
			}
		}
	}

	return 0
}
