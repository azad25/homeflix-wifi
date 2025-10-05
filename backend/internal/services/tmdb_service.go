package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
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
	ID               int      `json:"id"`
	Title            string   `json:"title"`
	OriginalTitle    string   `json:"original_title"`
	Overview         string   `json:"overview"`
	ReleaseDate      string   `json:"release_date"`
	PosterPath       string   `json:"poster_path"`
	BackdropPath     string   `json:"backdrop_path"`
	GenreIDs         []int    `json:"genre_ids"`
	VoteAverage      float64  `json:"vote_average"`
	VoteCount        int      `json:"vote_count"`
	Popularity       float64  `json:"popularity"`
	Adult            bool     `json:"adult"`
	Video            bool     `json:"video"`
	OriginalLanguage string   `json:"original_language"`
}

type TMDBMovieDetails struct {
	TMDBMovie
	Tagline         string        `json:"tagline"`
	Runtime         int           `json:"runtime"`
	Budget          int64         `json:"budget"`
	Revenue         int64         `json:"revenue"`
	Status          string        `json:"status"`
	Genres          []TMDBGenre   `json:"genres"`
	ProductionCompanies []TMDBCompany `json:"production_companies"`
	ProductionCountries []TMDBCountry `json:"production_countries"`
	SpokenLanguages []TMDBLanguage `json:"spoken_languages"`
	Credits         TMDBCredits   `json:"credits,omitempty"`
	IMDBID          string        `json:"imdb_id"`
	Homepage        string        `json:"homepage"`
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
			Timeout: 30 * time.Second,
		},
	}
}

func (t *TMDBService) SearchMovie(title string, year int) (*TMDBMovie, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	// Clean the title for better search results
	cleanTitle := t.cleanTitle(title)
	
	searchURL := fmt.Sprintf("%s/search/movie", t.baseURL)
	params := url.Values{}
	params.Add("query", cleanTitle)
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

	// Search for the movie
	movie, err := t.SearchMovie(cleanTitle, year)
	if err != nil {
		return nil, err
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

	// Remove duplicates from writers and producers
	writers = t.removeDuplicates(writers)
	producers = t.removeDuplicates(producers)

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
		Budget:      details.Budget,
		Revenue:     details.Revenue,
		BoxOffice:   boxOffice,
		Status:      details.Status,
		IMDBID:      details.IMDBID,
		Homepage:    details.Homepage,
		Collection:  collection,
		Cast:        cast,
		Crew:        crew,
		Writers:     writers,
		Producers:   producers,
	}

	return metadata, nil
}

func (t *TMDBService) cleanTitle(title string) string {
	// Remove common video file patterns
	title = strings.ReplaceAll(title, "_", " ")
	title = strings.ReplaceAll(title, ".", " ")
	
	// Remove year in parentheses or brackets
	title = strings.ReplaceAll(title, "(", " ")
	title = strings.ReplaceAll(title, ")", " ")
	title = strings.ReplaceAll(title, "[", " ")
	title = strings.ReplaceAll(title, "]", " ")
	
	// Remove common quality indicators
	qualityPatterns := []string{
		"1080p", "720p", "480p", "4K", "HD", "BluRay", "BRRip", "DVDRip",
		"WEBRip", "HDTV", "x264", "x265", "HEVC", "AAC", "AC3", "DTS",
	}
	
	titleLower := strings.ToLower(title)
	for _, pattern := range qualityPatterns {
		titleLower = strings.ReplaceAll(titleLower, strings.ToLower(pattern), " ")
	}
	
	// Clean up extra spaces
	words := strings.Fields(titleLower)
	return strings.Join(words, " ")
}

func (t *TMDBService) extractYear(title string) int {
	// Look for 4-digit year patterns
	for i := len(title) - 4; i >= 0; i-- {
		if i+4 <= len(title) {
			yearStr := title[i : i+4]
			if year, err := strconv.Atoi(yearStr); err == nil {
				if year >= 1900 && year <= time.Now().Year()+2 {
					return year
				}
			}
		}
	}
	return 0
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

// removeDuplicates removes duplicate strings from a slice
func (t *TMDBService) removeDuplicates(slice []string) []string {
	keys := make(map[string]bool)
	result := []string{}
	
	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}
	
	return result
}