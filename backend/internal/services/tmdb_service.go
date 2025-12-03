package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/interfaces"
)

type TMDBService struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// MetadataOptions provides options for metadata generation
type MetadataOptions struct {
	SearchTitle    string   // Custom title to use for TMDB search
	PreserveFields []string // Fields to preserve from manual editing
}

type TMDBSearchResponse struct {
	Results []TMDBMovie `json:"results"`
}

type TMDBTVSearchResponse struct {
	Results []TMDBTV `json:"results"`
}

type TMDBTV struct {
	ID               int     `json:"id"`
	Name             string  `json:"name"`
	OriginalName     string  `json:"original_name"`
	Overview         string  `json:"overview"`
	FirstAirDate     string  `json:"first_air_date"`
	PosterPath       string  `json:"poster_path"`
	BackdropPath     string  `json:"backdrop_path"`
	GenreIDs         []int   `json:"genre_ids"`
	VoteAverage      float64 `json:"vote_average"`
	VoteCount        int     `json:"vote_count"`
	Popularity       float64 `json:"popularity"`
	Adult            bool    `json:"adult"`
	OriginalLanguage string  `json:"original_language"`
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
	// Additional fields for enhanced metadata
	Certification string   `json:"certification,omitempty"`
	Awards        []string `json:"awards,omitempty"`
}

type TMDBTVDetails struct {
	TMDBTV
	Tagline             string         `json:"tagline"`
	NumberOfEpisodes    int            `json:"number_of_episodes"`
	NumberOfSeasons     int            `json:"number_of_seasons"`
	EpisodeRunTime      []int          `json:"episode_run_time"`
	InProduction        bool           `json:"in_production"`
	LastAirDate         string         `json:"last_air_date"`
	Status              string         `json:"status"`
	Type                string         `json:"type"`
	Genres              []TMDBGenre    `json:"genres"`
	ProductionCompanies []TMDBCompany  `json:"production_companies"`
	ProductionCountries []TMDBCountry  `json:"production_countries"`
	SpokenLanguages     []TMDBLanguage `json:"spoken_languages"`
	Credits             TMDBCredits    `json:"credits,omitempty"`
	Videos              TMDBVideos     `json:"videos,omitempty"`
	Homepage            string         `json:"homepage"`
	Networks            []TMDBNetwork  `json:"networks"`
	Seasons             []TMDBSeason   `json:"seasons"`
	// Additional fields for enhanced metadata
	Certification string   `json:"certification,omitempty"`
	Awards        []string `json:"awards,omitempty"`
}

type TMDBNetwork struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	LogoPath      string `json:"logo_path"`
	OriginCountry string `json:"origin_country"`
}

type TMDBSeason struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Overview     string `json:"overview"`
	PosterPath   string `json:"poster_path"`
	SeasonNumber int    `json:"season_number"`
	EpisodeCount int    `json:"episode_count"`
	AirDate      string `json:"air_date"`
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
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Character   string `json:"character"`
	Order       int    `json:"order"`
	ProfilePath string `json:"profile_path"`
}

type TMDBCrew struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Job         string `json:"job"`
	Department  string `json:"department"`
	ProfilePath string `json:"profile_path"`
}

// CastMember represents a cast member with image URL
type CastMember struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Character string `json:"character"`
	ImageURL  string `json:"image_url"`
	Order     int    `json:"order"`
}

// CrewMember represents a crew member with image URL
type CrewMember struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Job      string `json:"job"`
	ImageURL string `json:"image_url"`
}

// TMDBVideos represents the videos response from TMDB
type TMDBVideos struct {
	Results []TMDBVideo `json:"results"`
}

// TMDBVideo represents a single video from TMDB
type TMDBVideo struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Size        int    `json:"size"`
	Type        string `json:"type"`
	Official    bool   `json:"official"`
	PublishedAt string `json:"published_at"`
}

// TMDBMovieDetailsWithExtras includes video data
type TMDBMovieDetailsWithExtras struct {
	TMDBMovieDetails
	Videos TMDBVideos `json:"videos"`
}

func NewTMDBService() *TMDBService {
	apiKey := os.Getenv("TMDB_API_KEY")
	if apiKey == "" {
		log.Printf("⚠️ TMDB_API_KEY environment variable not set")
		log.Printf("📖 To enable TMDB poster downloads:")
		log.Printf("   1. Get a free API key from https://www.themoviedb.org/settings/api")
		log.Printf("   2. Set TMDB_API_KEY environment variable")
		log.Printf("   3. Restart the server")
	} else {
		log.Printf("✅ TMDB service initialized with API key")
	}

	return &TMDBService{
		apiKey:  apiKey,
		baseURL: "https://api.themoviedb.org/3",
		httpClient: &http.Client{
			Timeout: 15 * time.Second, // Increased timeout for poster downloads
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

func (t *TMDBService) SearchTV(title string, year int) (*TMDBTV, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	// Try search with year first if year is provided
	if year > 0 {
		if tv, err := t.searchTVWithParams(title, year); err == nil && tv != nil {
			return tv, nil
		}
	}

	// Fallback: search without year constraint
	return t.searchTVWithParams(title, 0)
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

	// Validate and return the first result (most relevant)
	result := &searchResp.Results[0]
	if result.ID == 0 {
		return nil, fmt.Errorf("invalid movie data received from TMDB search")
	}
	log.Printf("✅ TMDB: Found movie '%s' (ID: %d) with poster: '%s', backdrop: '%s'",
		result.Title, result.ID, result.PosterPath, result.BackdropPath)
	return result, nil
}

func (t *TMDBService) searchTVWithParams(title string, year int) (*TMDBTV, error) {
	searchURL := fmt.Sprintf("%s/search/tv", t.baseURL)
	params := url.Values{}
	params.Add("query", title)
	if year > 0 {
		params.Add("first_air_date_year", strconv.Itoa(year))
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

	var searchResp TMDBTVSearchResponse
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

func (t *TMDBService) GetTVDetails(tvID int) (*TMDBTVDetails, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	detailsURL := fmt.Sprintf("%s/tv/%d", t.baseURL, tvID)
	params := url.Values{}
	params.Add("append_to_response", "credits,videos")

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

	var details TMDBTVDetails
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, err
	}

	return &details, nil
}

func (t *TMDBService) GetMovieDetailsWithExtras(movieID int) (*TMDBMovieDetailsWithExtras, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	detailsURL := fmt.Sprintf("%s/movie/%d", t.baseURL, movieID)
	params := url.Values{}
	params.Add("append_to_response", "credits,videos")

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

	var details TMDBMovieDetailsWithExtras
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, err
	}

	return &details, nil
}

func (t *TMDBService) GenerateMediaMetadata(filePath, title string) (*interfaces.MediaMetadata, error) {
	return t.GenerateMediaMetadataWithOptions(filePath, title, nil)
}

// GenerateMediaMetadataWithOptions generates metadata with options for preserving fields and custom search
func (t *TMDBService) GenerateMediaMetadataWithOptions(filePath, title string, options *MetadataOptions) (*interfaces.MediaMetadata, error) {
	// Default options if none provided
	if options == nil {
		options = &MetadataOptions{}
	}

	// Use custom search title if provided, otherwise use the original title
	searchTitle := title
	if options.SearchTitle != "" {
		searchTitle = options.SearchTitle
		log.Printf("🔍 Using custom search title: '%s'", searchTitle)
	}

	// Check if we received a bad title with "Unknown Movie" prefix
	// If so, use the original filename instead
	originalTitle := searchTitle
	if strings.HasPrefix(searchTitle, "Unknown Movie") {
		log.Printf("⚠️ Detected bad title with 'Unknown Movie' prefix, using filename instead")
		originalTitle = filepath.Base(filePath)
	}

	// Extract year from title if present
	year := t.extractYear(originalTitle)
	// cleanTitle := t.cleanTitle(originalTitle)
	cleanTitle := originalTitle

	// For TMDB search, always remove year from title for better matching
	// The year will be used as a separate search parameter
	cleanTitleForSearch := t.removeYearFromTitle(cleanTitle)

	log.Printf("🔍 TMDB Search - Original: '%s', Clean: '%s', Search: '%s', Year: %d",
		originalTitle, cleanTitle, cleanTitleForSearch, year)

	// Try multiple search strategies
	var movie *TMDBMovie
	var err error

	// Strategy 1: Search with clean title (without year) and year parameter
	movie, err = t.SearchMovie(cleanTitleForSearch, year)
	if err != nil {
		// Strategy 2: Try without year parameter (broader search)
		movie, err = t.SearchMovie(cleanTitleForSearch, 0)
		if err != nil {
			// Strategy 3: Try simple title extraction as last resort
			simpleTitle := t.simpleCleanTitle(title)
			simpleTitleForSearch := t.removeYearFromTitle(simpleTitle)
			movie, err = t.SearchMovie(simpleTitleForSearch, year)
			if err != nil {
				// Strategy 4: Final fallback - try simple title without year
				movie, err = t.SearchMovie(simpleTitleForSearch, 0)
				if err != nil {
					return nil, fmt.Errorf("failed to find movie metadata for '%s': %w", title, err)
				}
			}
		}
	}

	// Get detailed information including videos for trailers
	detailsWithExtras, err := t.GetMovieDetailsWithExtras(movie.ID)
	if err != nil {
		log.Printf("⚠️ Failed to get movie details with extras for '%s' (ID: %d): %v", movie.Title, movie.ID, err)
		// Fallback to basic details without videos
		basicDetails, basicErr := t.GetMovieDetails(movie.ID)
		if basicErr != nil {
			return nil, fmt.Errorf("failed to get movie details: %w", basicErr)
		}
		// Create a minimal detailsWithExtras structure
		detailsWithExtras = &TMDBMovieDetailsWithExtras{
			TMDBMovieDetails: *basicDetails,
			Videos:           TMDBVideos{Results: []TMDBVideo{}},
		}
		log.Printf("✅ Using basic movie details for '%s' without video data", basicDetails.Title)
	}
	details := &detailsWithExtras.TMDBMovieDetails

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

	// Build poster and backdrop URLs with validation
	posterURL := t.buildImageURL(details.PosterPath, "w500")
	backdropURL := t.buildImageURL(details.BackdropPath, "w1280")

	if posterURL != "" {
		log.Printf("🖼️ Poster URL for '%s': %s", details.Title, posterURL)
	} else {
		log.Printf("⚠️ No valid poster path available for '%s' (path: '%s')", details.Title, details.PosterPath)
	}

	if backdropURL != "" {
		log.Printf("🖼️ Backdrop URL for '%s': %s", details.Title, backdropURL)
	} else {
		log.Printf("⚠️ No valid backdrop path available for '%s' (path: '%s')", details.Title, details.BackdropPath)
	}

	// Extract trailer URL from videos with improved error handling
	trailerURL := ""
	if detailsWithExtras != nil && len(detailsWithExtras.Videos.Results) > 0 {
		log.Printf("🎬 Processing %d videos for '%s'", len(detailsWithExtras.Videos.Results), details.Title)

		// Look for official trailers first, then any trailers
		var foundTrailer *TMDBVideo
		var fallbackTrailer *TMDBVideo

		for _, video := range detailsWithExtras.Videos.Results {
			if video.Site == "YouTube" && video.Key != "" {
				if video.Type == "Trailer" {
					if video.Official {
						// Official trailer is the best option
						foundTrailer = &video
						break
					} else if fallbackTrailer == nil {
						// Non-official trailer as fallback
						fallbackTrailer = &video
					}
				} else if video.Type == "Teaser" && fallbackTrailer == nil {
					// Teaser as last resort
					fallbackTrailer = &video
				}
			}
		}

		// Use the best trailer found
		if foundTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", foundTrailer.Key)
			log.Printf("🎬 Found official trailer for '%s': %s", details.Title, trailerURL)
		} else if fallbackTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", fallbackTrailer.Key)
			log.Printf("🎬 Found fallback trailer for '%s': %s", details.Title, trailerURL)
		} else {
			log.Printf("⚠️ No suitable YouTube trailer found for '%s'", details.Title)
		}
	} else {
		log.Printf("⚠️ No video data available for '%s'", details.Title)
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

	// Format budget for display
	budgetFormatted := ""
	if details.Budget > 0 {
		budgetFormatted = t.formatCurrency(details.Budget)
	}

	// Detect quality from filename
	quality := t.detectQuality(filePath)

	// Create final title - preserve original if it's in preserve fields, otherwise use TMDB title
	finalTitle := details.Title
	if options != nil && contains(options.PreserveFields, "title") {
		// Keep the original title if it's being preserved
		finalTitle = title
		log.Printf("🔒 Preserving original title: '%s'", finalTitle)
	} else {
		// Use TMDB title with year if not already present
		if year > 0 && !strings.Contains(finalTitle, strconv.Itoa(year)) {
			finalTitle = fmt.Sprintf("%s (%d)", finalTitle, year)
		}
	}

	metadata := &interfaces.MediaMetadata{
		Title:       finalTitle,
		Tagline:     details.Tagline,
		ShortDesc:   t.truncateText(details.Overview, 150),
		LongDesc:    details.Overview,
		Description: details.Overview,
		Year:        releaseYear,
		Stars:       stars,
		Directors:   directors,
		Country:     country,
		Language:    language,
		Quality:     quality,
		Rating:      details.VoteAverage,
		Genres:      genres,
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerURL:  trailerURL,
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
		// Additional fields
		Popularity: details.Popularity,
		VoteCount:  details.VoteCount,
		Adult:      details.Adult,
	}

	// Log enhanced metadata for debugging
	log.Printf("✅ TMDB metadata for '%s': Budget=%s, Revenue=%s, Rating=%.1f, Runtime=%dm",
		details.Title, budgetFormatted, boxOffice, details.VoteAverage, details.Runtime)
	log.Printf("🔗 URLs for '%s': Poster=%s, Backdrop=%s, Trailer=%s",
		details.Title,
		func() string {
			if posterURL != "" {
				return "✅"
			} else {
				return "❌"
			}
		}(),
		func() string {
			if backdropURL != "" {
				return "✅"
			} else {
				return "❌"
			}
		}(),
		func() string {
			if trailerURL != "" {
				return "✅"
			} else {
				return "❌"
			}
		}())

	// Validate metadata before returning
	t.validateMetadata(metadata, title)

	return metadata, nil
}

// DownloadPoster downloads a poster from TMDB for the given title and saves it locally
func (t *TMDBService) DownloadPoster(title string, mediaID uint, posterDir string) (string, error) {
	if t.apiKey == "" {
		return "", fmt.Errorf("TMDB API key not configured")
	}

	log.Printf("🎨 TMDB: Searching for poster for '%s'", title)

	// Extract year from title for better search accuracy
	year := t.extractYear(title)
	//cleanTitle := t.CleanTitle(title)
	cleanTitle := title
	searchTitle := t.RemoveYearFromTitle(cleanTitle)

	log.Printf("🔍 TMDB: Search params - Title: '%s', Year: %d", searchTitle, year)

	// Search for the movie
	movie, err := t.SearchMovie(searchTitle, year)
	if err != nil {
		// Try fallback search without year
		movie, err = t.SearchMovie(searchTitle, 0)
		if err != nil {
			return "", fmt.Errorf("movie not found in TMDB: %v", err)
		}
	}

	log.Printf("✅ TMDB: Found movie - ID: %d, Title: '%s', Poster: '%s'",
		movie.ID, movie.Title, movie.PosterPath)

	// Check if movie has a poster
	if movie.PosterPath == "" {
		return "", fmt.Errorf("no poster available for movie: %s", movie.Title)
	}

	// Create poster directories if they don't exist
	if err := os.MkdirAll(posterDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create poster directory: %v", err)
	}
	if err := os.MkdirAll("./posters", 0755); err != nil {
		return "", fmt.Errorf("failed to create root poster directory: %v", err)
	}

	// Generate filename using cleaned title
	cleanTitleForFile := t.cleanTitleForFilename(cleanTitle)
	filename := fmt.Sprintf("poster_%s.jpg", cleanTitleForFile)

	// Try root folder first (preferred location)
	rootPosterPath := filepath.Join("./posters", filename)
	backendPosterPath := filepath.Join(posterDir, filename)

	// Construct full poster URL (using w500 for good quality)
	posterURL := "https://image.tmdb.org/t/p/w500" + movie.PosterPath
	log.Printf("📥 TMDB: Downloading poster from: %s", posterURL)

	// Try to save to root folder first
	if err := t.savePosterToFile(posterURL, rootPosterPath); err == nil {
		log.Printf("✅ TMDB: Poster saved to root folder: %s", rootPosterPath)
		return rootPosterPath, nil
	}

	// Fallback to backend folder
	if err := t.savePosterToFile(posterURL, backendPosterPath); err != nil {
		return "", fmt.Errorf("failed to save poster to any location: %v", err)
	}

	log.Printf("✅ TMDB: Poster saved to backend folder: %s", backendPosterPath)
	return backendPosterPath, nil
}

// DownloadTVPoster downloads a poster from TMDB for the given TV series title and saves it locally
func (t *TMDBService) DownloadTVPoster(title string, seriesID uint, posterDir string) (string, error) {
	if t.apiKey == "" {
		return "", fmt.Errorf("TMDB API key not configured")
	}

	log.Printf("🎨 TMDB: Searching for TV series poster for '%s'", title)

	// Extract year from title for better search accuracy
	year := t.extractYear(title)
	cleanTitle := title
	searchTitle := t.RemoveYearFromTitle(cleanTitle)

	log.Printf("🔍 TMDB: TV Search params - Title: '%s', Year: %d", searchTitle, year)

	// Search for the TV series
	tv, err := t.SearchTV(searchTitle, year)
	if err != nil {
		// Try fallback search without year
		tv, err = t.SearchTV(searchTitle, 0)
		if err != nil {
			return "", fmt.Errorf("TV series not found in TMDB: %v", err)
		}
	}

	log.Printf("✅ TMDB: Found TV series - ID: %d, Name: '%s', Poster: '%s'",
		tv.ID, tv.Name, tv.PosterPath)

	// Check if TV series has a poster
	if tv.PosterPath == "" {
		return "", fmt.Errorf("no poster available for TV series: %s", tv.Name)
	}

	// Create poster directories if they don't exist
	if err := os.MkdirAll(posterDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create poster directory: %v", err)
	}
	if err := os.MkdirAll("./posters", 0755); err != nil {
		return "", fmt.Errorf("failed to create root poster directory: %v", err)
	}

	// Generate filename using cleaned title
	cleanTitleForFile := t.cleanTitleForFilename(cleanTitle)
	filename := fmt.Sprintf("poster_%s.jpg", cleanTitleForFile)

	// Try root folder first (preferred location)
	rootPosterPath := filepath.Join("./posters", filename)
	backendPosterPath := filepath.Join(posterDir, filename)

	// Construct full poster URL (using w500 for good quality)
	posterURL := "https://image.tmdb.org/t/p/w500" + tv.PosterPath
	log.Printf("📥 TMDB: Downloading TV poster from: %s", posterURL)

	// Try to save to root folder first
	if err := t.savePosterToFile(posterURL, rootPosterPath); err == nil {
		log.Printf("✅ TMDB: TV poster saved to root folder: %s", rootPosterPath)
		return rootPosterPath, nil
	}

	// Fallback to backend folder
	if err := t.savePosterToFile(posterURL, backendPosterPath); err != nil {
		return "", fmt.Errorf("failed to save TV poster to any location: %v", err)
	}

	log.Printf("✅ TMDB: TV poster saved to backend folder: %s", backendPosterPath)
	return backendPosterPath, nil
}

// savePosterToFile saves the poster data to a file
func (t *TMDBService) savePosterToFile(posterURL, filePath string) error {
	// Download the poster
	resp, err := t.httpClient.Get(posterURL)
	if err != nil {
		return fmt.Errorf("failed to download poster: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download poster: HTTP %d", resp.StatusCode)
	}

	// Create the file
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %v", filePath, err)
	}
	defer file.Close()

	// Copy data to file
	bytesWritten, err := file.ReadFrom(resp.Body)
	if err != nil {
		// Clean up partial file on error
		os.Remove(filePath)
		return fmt.Errorf("failed to write poster data: %v", err)
	}

	log.Printf("📁 TMDB: Wrote %d bytes to %s", bytesWritten, filePath)
	return nil
}

// cleanTitleForFilename creates a safe filename from a title
func (t *TMDBService) cleanTitleForFilename(title string) string {
	// Remove or replace characters that are not safe for filenames
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "")
	cleaned = strings.ReplaceAll(cleaned, "*", "")
	cleaned = strings.ReplaceAll(cleaned, "<", "")
	cleaned = strings.ReplaceAll(cleaned, ">", "")
	cleaned = strings.ReplaceAll(cleaned, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "\"", "")
	cleaned = strings.ReplaceAll(cleaned, "'", "")
	cleaned = strings.ReplaceAll(cleaned, "(", "")
	cleaned = strings.ReplaceAll(cleaned, ")", "")

	// Remove multiple underscores and trim
	cleaned = regexp.MustCompile(`_+`).ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")

	// Convert to lowercase for consistency
	cleaned = strings.ToLower(cleaned)

	// Limit length to avoid filesystem issues
	if len(cleaned) > 100 {
		cleaned = cleaned[:100]
	}

	// Ensure we have something if title was all special characters
	if cleaned == "" {
		cleaned = "untitled"
	}

	return cleaned
}

// GetPosterURL returns the full poster URL for a given poster path
func (t *TMDBService) GetPosterURL(posterPath string, size string) string {
	if posterPath == "" {
		return ""
	}

	// Default to w500 if no size specified
	if size == "" {
		size = "w500"
	}

	return "https://image.tmdb.org/t/p/" + size + posterPath
}

// TestConnection tests the TMDB API connection
func (t *TMDBService) TestConnection() error {
	if t.apiKey == "" {
		return fmt.Errorf("TMDB API key not configured")
	}

	// Test with a simple configuration request
	configURL := fmt.Sprintf("%s/configuration", t.baseURL)
	req, err := http.NewRequest("GET", configURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create test request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to TMDB API: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("TMDB API returned status %d", resp.StatusCode)
	}

	log.Printf("✅ TMDB API connection test successful")
	return nil
}

// CleanTitle is a public method that exposes the title cleaning functionality
// For TV series episodes, it preserves season/episode information for unique identification
func (t *TMDBService) CleanTitle(title string) string {
	// Check if this is a TV series episode first
	if t.isEpisodeFile(title) {
		return t.cleanEpisodeTitle(title)
	}

	cleaned := t.cleanTitle(title)

	// Safety check - never return empty title
	if cleaned == "" || len(strings.TrimSpace(cleaned)) == 0 {
		// Fallback to simple cleaning
		fallback := t.simpleCleanTitle(title)
		if fallback != "" && len(strings.TrimSpace(fallback)) > 0 {
			return fallback
		}

		// Last resort - return original with basic cleanup
		basic := strings.TrimSuffix(filepath.Base(title), filepath.Ext(filepath.Base(title)))
		basic = strings.ReplaceAll(basic, ".", " ")
		basic = strings.ReplaceAll(basic, "_", " ")
		basic = strings.ReplaceAll(basic, "-", " ")
		basic = regexp.MustCompile(`\s+`).ReplaceAllString(basic, " ")
		basic = strings.TrimSpace(basic)

		if basic != "" {
			return basic
		}

		// Absolute fallback
		return "Unknown Title"
	}

	return cleaned
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

// isEpisodeFile detects if a filename represents a TV series episode
func (t *TMDBService) isEpisodeFile(title string) bool {
	// Check for common episode patterns
	episodePatterns := []string{
		`S\d{1,2}E\d{1,2}`, // S01E01, S1E1
		`\d{1,2}x\d{1,2}`,  // 1x01, 12x05
		`Episode\s+\d+`,    // Episode 1, Episode 12
		`Ep\s*\d+`,         // Ep1, Ep 12
		`E\d{1,2}`,         // E01, E1
	}

	for _, pattern := range episodePatterns {
		if matched, _ := regexp.MatchString(`(?i)`+pattern, title); matched {
			return true
		}
	}

	return false
}

// cleanEpisodeTitle cleans episode titles while preserving season/episode information
func (t *TMDBService) cleanEpisodeTitle(title string) string {
	// Extract season/episode info first
	seasonEpisodePattern := regexp.MustCompile(`(?i)(S\d{1,2}E\d{1,2}|\d{1,2}x\d{1,2}|Episode\s+\d+|Ep\s*\d+|E\d{1,2})`)
	seasonEpisodeMatch := seasonEpisodePattern.FindString(title)

	// Clean the title using standard cleaning
	cleaned := t.cleanTitle(title)

	// If we found season/episode info and it's not in the cleaned title, append it
	if seasonEpisodeMatch != "" {
		// Normalize the season/episode format
		normalizedSE := strings.ToUpper(seasonEpisodeMatch)
		normalizedSE = regexp.MustCompile(`\s+`).ReplaceAllString(normalizedSE, "")

		// Check if season/episode info is already in cleaned title
		if !strings.Contains(strings.ToUpper(cleaned), normalizedSE) {
			cleaned = cleaned + " " + normalizedSE
		}
	}

	return cleaned
}

func (t *TMDBService) cleanTitle(title string) string {
	// First, extract the base filename without extension
	baseName := filepath.Base(title)
	ext := filepath.Ext(baseName)
	baseName = strings.TrimSuffix(baseName, ext)

	log.Printf("🔍 TMDB Title cleaning input: '%s'", baseName)

	// Step 1: Extract year FIRST before any other processing
	originalBaseName := baseName
	yearPattern := regexp.MustCompile("\\b(19|20)\\d{2}\\b")
	yearMatches := yearPattern.FindAllString(originalBaseName, -1)
	var extractedYear string
	if len(yearMatches) > 0 {
		// Use the last year found (usually the release year)
		extractedYear = yearMatches[len(yearMatches)-1]
		log.Printf("🗓️ Extracted year: %s", extractedYear)
	}

	// Step 2: Replace common separators with spaces
	baseName = strings.ReplaceAll(baseName, ".", " ")
	baseName = strings.ReplaceAll(baseName, "_", " ")
	baseName = strings.ReplaceAll(baseName, "-", " ")

	// Step 3: Find the main title by looking for the first quality/technical indicator
	// This is the key improvement - we stop at the FIRST technical indicator
	titleEndPattern := regexp.MustCompile("(?i)\\s+(\\b(1080p|2160p|720p|480p|4K|8K|UHD|FHD|HD|BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB.DL|WEB|HDTV|HDRip|x264|x265|h264|h265|HEVC|AVC|XviD|10bit|8bit|HDR|AAC|AC3|DTS|5\\.1|7\\.1|YIFY|YTS|RARBG|PSA|ETRG|Hasan)\\b)")

	// Find where the title likely ends
	titleEndIndex := titleEndPattern.FindStringIndex(baseName)
	if titleEndIndex != nil {
		// Extract everything before the quality indicators
		baseName = baseName[:titleEndIndex[0]]
		log.Printf("🎯 Title cut at quality indicator: '%s'", baseName)
	}

	// Step 4: Remove anything in brackets or parentheses that might remain
	bracketsPattern := regexp.MustCompile("[\\[\\{\\(][^\\]\\}\\)]*[\\]\\}\\)]*")
	baseName = bracketsPattern.ReplaceAllString(baseName, " ")

	// Step 5: Remove any remaining quality indicators and video codecs
	qualityPattern := regexp.MustCompile("(?i)\\b(" +
		"1080p|2160p|720p|480p|360p|4K|8K|UHD|FHD|HD|SD|" +
		"BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB.DL|WEB|HDTV|HDRip|BrRip|" +
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
		"DVD|CD\\d|DISC\\d|Hasan" +
		")\\b")
	baseName = qualityPattern.ReplaceAllString(baseName, " ")

	// Step 6: Remove release groups (specific known groups only)
	releaseGroupPattern := regexp.MustCompile("(?i)\\b(" +
		"YIFY|YTS|RARBG|PSA|ETRG|AMZN|NF|NETFLIX|ATVP|DSNP|" +
		"HMAX|HBO|HULU|DISNEY|APPLE|PARAMOUNT|" +
		"SPARKS|GECKOS|ROVERS|GALAXY|ORBS|CMRG|ETHiCS|" +
		"DEFLATE|STUTTERSHIT|VETO|BLOW|SCENE|FGT|" +
		"EVOLVE|KILLERS|DEMAND|FLEET|ION10|ION|" +
		"MX|Hasan" +
		")\\b")
	baseName = releaseGroupPattern.ReplaceAllString(baseName, " ")

	// Step 7: Remove episode/season patterns
	episodePattern := regexp.MustCompile("(?i)\\b(S\\d{1,2}E\\d{1,2}|Season\\s?\\d{1,2}|Episode\\s?\\d{1,2})\\b")
	baseName = episodePattern.ReplaceAllString(baseName, " ")

	// Step 8: Remove file size indicators
	sizePattern := regexp.MustCompile("(?i)\\b\\d+(\\.\\d+)?\\s?(GB|MB|GiB|MiB)\\b")
	baseName = sizePattern.ReplaceAllString(baseName, " ")

	// Step 9: Remove hash-like patterns (but preserve meaningful numbers)
	hashPattern := regexp.MustCompile(`\b[a-fA-F0-9]{8,}\b`)
	baseName = hashPattern.ReplaceAllString(baseName, " ")

	// Step 10: Remove leading numeric IDs (but preserve sequel numbers)
	// Only remove 3+ digit numbers at the start, preserve 1-2 digit sequel numbers
	numericPrefixPattern := regexp.MustCompile(`^\d{3,}[\s]+`)
	baseName = numericPrefixPattern.ReplaceAllString(baseName, "")

	// Step 10.5: Enhanced sequel and numbered title preservation
	// Preserve common sequel patterns like "Movie 2", "Movie II", "Movie Part 2"
	// Also preserve titles with numbers like "Table No 21", "Ocean's 11"
	sequelPatterns := []string{
		// Preserve Roman numerals (I, II, III, IV, V, etc.)
		`\b(I{1,3}V?|IV|V|VI{0,3}|IX|X)\b`,
		// Preserve sequel numbers (1-20)
		`\b(Part|Chapter|Episode|Volume|Book)\s+\d{1,2}\b`,
		// Preserve numbered titles
		`\b(No|Number|#)\s*\d{1,3}\b`,
		// Preserve Ocean's style numbers
		`'s\s+\d{1,2}\b`,
		// Preserve direct sequel numbers at end of title
		`\s+\d{1,2}$`,
	}

	// Mark sequel patterns for preservation
	var preservedParts []string
	for _, pattern := range sequelPatterns {
		seqRegex := regexp.MustCompile(`(?i)` + pattern)
		matches := seqRegex.FindAllString(baseName, -1)
		preservedParts = append(preservedParts, matches...)
	}

	log.Printf("🔢 Preserved sequel/number parts: %v", preservedParts)

	// Step 11: Clean up special characters (preserve apostrophes, numbers, and sequel indicators)
	// Enhanced to preserve more punctuation that might be part of titles
	specialCharsPattern := regexp.MustCompile(`[^\p{L}\p{N}\s'&:!?.,#-]`)
	baseName = specialCharsPattern.ReplaceAllString(baseName, " ")

	// Step 11.5: Restore preserved sequel/number parts if they were removed
	for _, preserved := range preservedParts {
		if preserved != "" && !strings.Contains(baseName, preserved) {
			// Try to find where this should be restored
			if strings.HasSuffix(strings.TrimSpace(baseName), strings.Fields(preserved)[0]) {
				baseName = baseName + " " + preserved
				log.Printf("🔄 Restored sequel part: %s", preserved)
			}
		}
	}

	// Step 12: Clean up multiple spaces and trim
	baseName = regexp.MustCompile("\\s+").ReplaceAllString(baseName, " ")
	baseName = strings.TrimSpace(baseName)

	log.Printf("🧹 After cleaning: '%s'", baseName)

	// Step 13: If we're left with a very short string or empty, try a fallback approach
	if len(baseName) <= 2 || baseName == "" {
		log.Printf("⚠️ Title too short, trying fallback approach...")

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
			log.Printf("🔄 Fallback 1 result: '%s'", baseName)
		} else {
			// Enhanced fallback: preserve sequel numbers and meaningful titles
			words := strings.Fields(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(originalBase, ".", " "), "_", " "), "-", " "))
			var titleWords []string
			for i, word := range words {
				// Stop at quality indicators, but preserve sequel numbers
				if regexp.MustCompile(`(?i)^(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265|HEVC|Hasan)$`).MatchString(word) {
					break
				}
				// Stop at years, but only if not part of a sequel pattern
				if regexp.MustCompile(`^(19|20)\d{2}$`).MatchString(word) {
					// Check if this might be a sequel year (like "Terminator 2 1991")
					if i > 0 && regexp.MustCompile(`^\d{1,2}$`).MatchString(words[i-1]) {
						// This is likely a year after a sequel number, stop here
						break
					}
					// If it's just a standalone year, stop
					break
				}

				titleWords = append(titleWords, word)
				// Allow more words for complex titles with numbers
				if len(titleWords) >= 6 {
					break
				}
			}
			if len(titleWords) > 0 {
				baseName = strings.Join(titleWords, " ")
				log.Printf("🔄 Fallback 2 result: '%s'", baseName)
			}
		}
	}

	// Step 14: Final fallback - if still empty or too short, use basic filename cleanup
	if len(baseName) <= 2 || baseName == "" {
		log.Printf("🚨 Using ultimate fallback...")
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
		log.Printf("⚠️ Title validation failed, trying simple clean...")
		// Try a simpler approach
		simpleTitle := t.simpleCleanTitle(title)
		if t.isValidTitle(simpleTitle) && len(simpleTitle) > len(baseName) {
			baseName = simpleTitle
		}
	}

	// Final safety check - if we still have nothing, return a basic cleaned version
	if baseName == "" {
		baseName = strings.TrimSuffix(filepath.Base(title), filepath.Ext(filepath.Base(title)))
		baseName = strings.ReplaceAll(baseName, ".", " ")
		baseName = strings.ReplaceAll(baseName, "_", " ")
		baseName = strings.ReplaceAll(baseName, "-", " ")
		baseName = regexp.MustCompile("\\s+").ReplaceAllString(baseName, " ")
		baseName = strings.TrimSpace(baseName)
	}

	log.Printf("✨ Final cleaned title: '%s'", baseName)
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
		`^[0-9\s]+$`,   // Only numbers and spaces
		`^[^a-zA-Z]*$`, // No letters at all
		`^\s*$`,        // Only whitespace
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

// detectQuality detects video quality from filename and path
func (t *TMDBService) detectQuality(filePath string) string {
	filename := strings.ToLower(filepath.Base(filePath))

	// 4K/UHD detection
	if regexp.MustCompile(`\b(2160p|4K|UHD|4096x2160|3840x2160)\b`).MatchString(filename) {
		return "4K"
	}

	// 1440p/QHD detection
	if regexp.MustCompile(`\b(1440p|QHD|2560x1440)\b`).MatchString(filename) {
		return "QHD"
	}

	// 1080p/Full HD detection
	if regexp.MustCompile(`\b(1080p|FHD|1920x1080)\b`).MatchString(filename) {
		return "Full HD"
	}

	// 720p/HD detection
	if regexp.MustCompile(`\b(720p|HD|1280x720)\b`).MatchString(filename) {
		return "HD"
	}

	// 480p/SD detection
	if regexp.MustCompile(`\b(480p|SD|854x480|640x480)\b`).MatchString(filename) {
		return "SD"
	}

	// 360p detection
	if regexp.MustCompile(`\b(360p|640x360)\b`).MatchString(filename) {
		return "360p"
	}

	// Check for BluRay/high quality sources
	if regexp.MustCompile(`\b(BluRay|BRRip|BDRip)\b`).MatchString(filename) {
		// If BluRay but no specific resolution, assume HD
		return "HD"
	}

	// Check for WEB sources
	if regexp.MustCompile(`\b(WEBRip|WEB.DL|WEB)\b`).MatchString(filename) {
		// If WEB but no specific resolution, assume HD
		return "HD"
	}

	// Default fallback
	return "HD"
}

// GetCastImages fetches cast images for a movie by searching TMDB
func (t *TMDBService) GetCastImages(title string, year int) ([]CastMember, []CrewMember, error) {
	if t.apiKey == "" {
		return nil, nil, fmt.Errorf("TMDB API key not configured")
	}

	// Search for the movie first
	movie, err := t.SearchMovie(title, year)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to find movie: %w", err)
	}

	// Get detailed movie information with credits
	details, err := t.GetMovieDetails(movie.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get movie details: %w", err)
	}

	// Process cast members
	var castMembers []CastMember
	for _, cast := range details.Credits.Cast {
		imageURL := ""
		if cast.ProfilePath != "" {
			imageURL = "https://image.tmdb.org/t/p/w185" + cast.ProfilePath
		}

		castMembers = append(castMembers, CastMember{
			ID:        cast.ID,
			Name:      cast.Name,
			Character: cast.Character,
			ImageURL:  imageURL,
			Order:     cast.Order,
		})

		// Limit to top 20 cast members to avoid too much data
		if len(castMembers) >= 20 {
			break
		}
	}

	// Process crew members (directors, writers, producers)
	var crewMembers []CrewMember
	directorJobs := map[string]bool{"Director": true}
	writerJobs := map[string]bool{"Writer": true, "Screenplay": true, "Story": true}
	producerJobs := map[string]bool{"Producer": true, "Executive Producer": true}

	for _, crew := range details.Credits.Crew {
		// Only include key crew roles
		if directorJobs[crew.Job] || writerJobs[crew.Job] || producerJobs[crew.Job] {
			imageURL := ""
			if crew.ProfilePath != "" {
				imageURL = "https://image.tmdb.org/t/p/w185" + crew.ProfilePath
			}

			crewMembers = append(crewMembers, CrewMember{
				ID:       crew.ID,
				Name:     crew.Name,
				Job:      crew.Job,
				ImageURL: imageURL,
			})
		}
	}

	log.Printf("✅ TMDB: Found %d cast members and %d crew members for '%s'",
		len(castMembers), len(crewMembers), title)

	return castMembers, crewMembers, nil
}

// GetCastImagesByTMDBID fetches cast images using a known TMDB movie ID
func (t *TMDBService) GetCastImagesByTMDBID(tmdbID int) ([]CastMember, []CrewMember, error) {
	if t.apiKey == "" {
		return nil, nil, fmt.Errorf("TMDB API key not configured")
	}

	// Get detailed movie information with credits
	details, err := t.GetMovieDetails(tmdbID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get movie details: %w", err)
	}

	// Process cast members
	var castMembers []CastMember
	for _, cast := range details.Credits.Cast {
		imageURL := ""
		if cast.ProfilePath != "" {
			imageURL = "https://image.tmdb.org/t/p/w185" + cast.ProfilePath
		}

		castMembers = append(castMembers, CastMember{
			ID:        cast.ID,
			Name:      cast.Name,
			Character: cast.Character,
			ImageURL:  imageURL,
			Order:     cast.Order,
		})

		// Limit to top 20 cast members
		if len(castMembers) >= 20 {
			break
		}
	}

	// Process crew members
	var crewMembers []CrewMember
	directorJobs := map[string]bool{"Director": true}
	writerJobs := map[string]bool{"Writer": true, "Screenplay": true, "Story": true}
	producerJobs := map[string]bool{"Producer": true, "Executive Producer": true}

	for _, crew := range details.Credits.Crew {
		if directorJobs[crew.Job] || writerJobs[crew.Job] || producerJobs[crew.Job] {
			imageURL := ""
			if crew.ProfilePath != "" {
				imageURL = "https://image.tmdb.org/t/p/w185" + crew.ProfilePath
			}

			crewMembers = append(crewMembers, CrewMember{
				ID:       crew.ID,
				Name:     crew.Name,
				Job:      crew.Job,
				ImageURL: imageURL,
			})
		}
	}

	return castMembers, crewMembers, nil
}

// GetPersonImage gets a person's image URL by their name (for fallback searches)
func (t *TMDBService) GetPersonImage(personName string) (string, error) {
	if t.apiKey == "" {
		return "", fmt.Errorf("TMDB API key not configured")
	}

	// Search for the person
	searchURL := fmt.Sprintf("%s/search/person", t.baseURL)
	params := url.Values{}
	params.Add("query", personName)

	req, err := http.NewRequest("GET", searchURL+"?"+params.Encode(), nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}

	var searchResp struct {
		Results []struct {
			ID          int    `json:"id"`
			Name        string `json:"name"`
			ProfilePath string `json:"profile_path"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return "", err
	}

	if len(searchResp.Results) == 0 {
		return "", fmt.Errorf("person not found: %s", personName)
	}

	// Return the first result's image
	if searchResp.Results[0].ProfilePath != "" {
		return "https://image.tmdb.org/t/p/w185" + searchResp.Results[0].ProfilePath, nil
	}

	return "", fmt.Errorf("no image available for: %s", personName)
}

// UpcomingMoviesResponse represents the combined response for upcoming movies
type UpcomingMoviesResponse struct {
	TrendingDaily  []TMDBMovie `json:"trending_daily"`
	TrendingWeekly []TMDBMovie `json:"trending_weekly"`
	NowPlaying     []TMDBMovie `json:"now_playing"`
	Upcoming       []TMDBMovie `json:"upcoming"`
	CachedAt       time.Time   `json:"cached_at"`
}

// GetUpcomingMovies fetches trending, now-playing, and upcoming movies from TMDB
func (t *TMDBService) GetUpcomingMovies() (*UpcomingMoviesResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	log.Printf("🎬 Fetching upcoming movies from TMDB...")

	// Fetch trending movies (daily)
	trendingDaily, err := t.fetchTrendingMovies("day")
	if err != nil {
		log.Printf("⚠️ Failed to fetch daily trending movies: %v", err)
		trendingDaily = []TMDBMovie{} // Continue with empty slice
	}

	// Fetch trending movies (weekly)
	trendingWeekly, err := t.fetchTrendingMovies("week")
	if err != nil {
		log.Printf("⚠️ Failed to fetch weekly trending movies: %v", err)
		trendingWeekly = []TMDBMovie{} // Continue with empty slice
	}

	// Fetch now playing movies
	nowPlaying, err := t.fetchNowPlayingMovies()
	if err != nil {
		log.Printf("⚠️ Failed to fetch now playing movies: %v", err)
		nowPlaying = []TMDBMovie{} // Continue with empty slice
	}

	// Fetch upcoming movies
	upcoming, err := t.fetchUpcomingMovies()
	if err != nil {
		log.Printf("⚠️ Failed to fetch upcoming movies: %v", err)
		upcoming = []TMDBMovie{} // Continue with empty slice
	}

	response := &UpcomingMoviesResponse{
		TrendingDaily:  trendingDaily,
		TrendingWeekly: trendingWeekly,
		NowPlaying:     nowPlaying,
		Upcoming:       upcoming,
		CachedAt:       time.Now(),
	}

	log.Printf("✅ Successfully fetched upcoming movies: %d trending daily, %d trending weekly, %d now playing, %d upcoming",
		len(trendingDaily), len(trendingWeekly), len(nowPlaying), len(upcoming))

	return response, nil
}

// fetchTrendingMovies fetches trending movies for a given time window
func (t *TMDBService) fetchTrendingMovies(timeWindow string) ([]TMDBMovie, error) {
	requestURL := fmt.Sprintf("%s/trending/movie/%s", t.baseURL, timeWindow)
	params := url.Values{}
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}

// fetchNowPlayingMovies fetches movies currently playing in theaters
func (t *TMDBService) fetchNowPlayingMovies() ([]TMDBMovie, error) {
	requestURL := fmt.Sprintf("%s/movie/now_playing", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}

// fetchUpcomingMovies fetches upcoming movies
func (t *TMDBService) fetchUpcomingMovies() ([]TMDBMovie, error) {
	requestURL := fmt.Sprintf("%s/movie/upcoming", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}

// GetNowPlayingMovies returns movies currently playing in theaters (public wrapper)
func (t *TMDBService) GetNowPlayingMovies(page int) ([]TMDBMovie, error) {
	if page <= 0 {
		page = 1
	}
	
	requestURL := fmt.Sprintf("%s/movie/now_playing", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", strconv.Itoa(page))

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	log.Printf("✅ TMDB: Retrieved %d now playing movies (page %d)", len(searchResp.Results), page)
	return searchResp.Results, nil
}

// GetUpcomingMoviesList returns upcoming movie releases (public wrapper)
func (t *TMDBService) GetUpcomingMoviesList(page int) ([]TMDBMovie, error) {
	if page <= 0 {
		page = 1
	}
	
	requestURL := fmt.Sprintf("%s/movie/upcoming", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", strconv.Itoa(page))

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	log.Printf("✅ TMDB: Retrieved %d upcoming movies (page %d)", len(searchResp.Results), page)
	return searchResp.Results, nil
}

// GetLatestMovie returns the most recently added movie to TMDB
func (t *TMDBService) GetLatestMovie() (*TMDBMovieDetails, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	requestURL := fmt.Sprintf("%s/movie/latest", t.baseURL)

	req, err := http.NewRequest("GET", requestURL, nil)
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

	var movie TMDBMovieDetails
	if err := json.NewDecoder(resp.Body).Decode(&movie); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Retrieved latest movie: %s (ID: %d)", movie.Title, movie.ID)
	return &movie, nil
}

// GetPopularMovies returns currently popular movies
func (t *TMDBService) GetPopularMovies(page int) ([]TMDBMovie, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if page <= 0 {
		page = 1
	}

	requestURL := fmt.Sprintf("%s/movie/popular", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", strconv.Itoa(page))

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	log.Printf("✅ TMDB: Retrieved %d popular movies (page %d)", len(searchResp.Results), page)
	return searchResp.Results, nil
}

// DiscoverMovies provides advanced filtered/sorted movie discovery
func (t *TMDBService) DiscoverMovies(params map[string]string) ([]TMDBMovie, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	requestURL := fmt.Sprintf("%s/discover/movie", t.baseURL)
	urlParams := url.Values{}
	
	// Add all provided parameters
	for key, value := range params {
		urlParams.Add(key, value)
	}

	// Set default language if not provided
	if _, ok := params["language"]; !ok {
		urlParams.Add("language", "en-US")
	}

	// Set default page if not provided
	if _, ok := params["page"]; !ok {
		urlParams.Add("page", "1")
	}

	req, err := http.NewRequest("GET", requestURL+"?"+urlParams.Encode(), nil)
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

	log.Printf("✅ TMDB: Discovered %d movies with filters", len(searchResp.Results))
	return searchResp.Results, nil
}

// TMDBImage represents a single image from TMDB
type TMDBImage struct {
	AspectRatio float64 `json:"aspect_ratio"`
	FilePath    string  `json:"file_path"`
	Height      int     `json:"height"`
	ISO6391     string  `json:"iso_639_1"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
	Width       int     `json:"width"`
}

// TMDBImagesResponse represents the images response from TMDB
type TMDBImagesResponse struct {
	ID        int         `json:"id"`
	Backdrops []TMDBImage `json:"backdrops"`
	Logos     []TMDBImage `json:"logos"`
	Posters   []TMDBImage `json:"posters"`
}

// GetMovieImages returns posters, backdrops, and logos for a movie
func (t *TMDBService) GetMovieImages(movieID int) (*TMDBImagesResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	requestURL := fmt.Sprintf("%s/movie/%d/images", t.baseURL, movieID)

	req, err := http.NewRequest("GET", requestURL, nil)
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

	var images TMDBImagesResponse
	if err := json.NewDecoder(resp.Body).Decode(&images); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Retrieved images for movie %d: %d backdrops, %d logos, %d posters",
		movieID, len(images.Backdrops), len(images.Logos), len(images.Posters))
	return &images, nil
}

// ConvertMovieDetailsToMetadata converts TMDB movie details to MediaMetadata format
func (t *TMDBService) ConvertMovieDetailsToMetadata(details *TMDBMovieDetailsWithExtras) *interfaces.MediaMetadata {
	if details == nil {
		return nil
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
	posterURL := t.buildImageURL(details.PosterPath, "w500")
	backdropURL := t.buildImageURL(details.BackdropPath, "w1280")

	// Extract trailer URL from videos
	trailerURL := ""
	if len(details.Videos.Results) > 0 {
		// Look for official trailers first, then any trailers
		var foundTrailer *TMDBVideo
		var fallbackTrailer *TMDBVideo

		for _, video := range details.Videos.Results {
			if video.Site == "YouTube" && video.Key != "" {
				if video.Type == "Trailer" {
					if video.Official {
						// Official trailer is the best option
						foundTrailer = &video
						break
					} else if fallbackTrailer == nil {
						// Non-official trailer as fallback
						fallbackTrailer = &video
					}
				} else if video.Type == "Teaser" && fallbackTrailer == nil {
					// Teaser as last resort
					fallbackTrailer = &video
				}
			}
		}

		// Use the best trailer found
		if foundTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", foundTrailer.Key)
		} else if fallbackTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", fallbackTrailer.Key)
		}
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

	return &interfaces.MediaMetadata{
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
		TrailerURL:  trailerURL,
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
		// Additional fields
		Popularity: details.Popularity,
		VoteCount:  details.VoteCount,
		Adult:      details.Adult,
	}
}

// TMDBSearchResult represents a unified search result for both movies and TV shows
type TMDBSearchResult struct {
	ID            int     `json:"id"`
	Title         string  `json:"title"` // For movies, this will be the title; for TV shows, this will be the name
	OriginalTitle string  `json:"original_title"`
	Overview      string  `json:"overview"`
	ReleaseDate   string  `json:"release_date"` // For movies: release_date, for TV: first_air_date
	PosterPath    string  `json:"poster_path"`
	BackdropPath  string  `json:"backdrop_path"`
	VoteAverage   float64 `json:"vote_average"`
	VoteCount     int     `json:"vote_count"`
	Popularity    float64 `json:"popularity"`
	MediaType     string  `json:"media_type"` // "movie" or "tv"
	Adult         bool    `json:"adult"`
	GenreIDs      []int   `json:"genre_ids"`
}

// TMDBMultiSearchResponse represents the response from TMDB's multi search endpoint
type TMDBMultiSearchResponse struct {
	Page         int                `json:"page"`
	Results      []TMDBSearchResult `json:"results"`
	TotalPages   int                `json:"total_pages"`
	TotalResults int                `json:"total_results"`
}

// TMDBRawSearchResult represents the raw response from TMDB API before normalization
type TMDBRawSearchResult struct {
	ID            int     `json:"id"`
	Title         string  `json:"title,omitempty"`          // Movies only
	Name          string  `json:"name,omitempty"`           // TV shows only
	OriginalTitle string  `json:"original_title,omitempty"` // Movies only
	OriginalName  string  `json:"original_name,omitempty"`  // TV shows only
	Overview      string  `json:"overview"`
	ReleaseDate   string  `json:"release_date,omitempty"`   // Movies only
	FirstAirDate  string  `json:"first_air_date,omitempty"` // TV shows only
	PosterPath    string  `json:"poster_path"`
	BackdropPath  string  `json:"backdrop_path"`
	VoteAverage   float64 `json:"vote_average"`
	VoteCount     int     `json:"vote_count"`
	Popularity    float64 `json:"popularity"`
	MediaType     string  `json:"media_type"`
	Adult         bool    `json:"adult"`
	GenreIDs      []int   `json:"genre_ids"`
}

// TMDBRawMultiSearchResponse represents the raw response from TMDB's multi search endpoint
type TMDBRawMultiSearchResponse struct {
	Page         int                   `json:"page"`
	Results      []TMDBRawSearchResult `json:"results"`
	TotalPages   int                   `json:"total_pages"`
	TotalResults int                   `json:"total_results"`
}

// SearchMulti searches for both movies and TV shows using TMDB's multi search endpoint
func (t *TMDBService) SearchMulti(query string, page int) (*TMDBMultiSearchResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if query == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	if page < 1 {
		page = 1
	}

	searchURL := fmt.Sprintf("%s/search/multi", t.baseURL)
	params := url.Values{}
	params.Add("query", query)
	params.Add("page", strconv.Itoa(page))
	params.Add("include_adult", "false")

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

	var rawResp TMDBRawMultiSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&rawResp); err != nil {
		return nil, err
	}

	// Convert raw results to normalized results
	var normalizedResults []TMDBSearchResult
	for _, rawResult := range rawResp.Results {
		// Skip person results (we only want movies and TV shows)
		if rawResult.MediaType != "movie" && rawResult.MediaType != "tv" {
			continue
		}

		normalized := TMDBSearchResult{
			ID:           rawResult.ID,
			Overview:     rawResult.Overview,
			PosterPath:   rawResult.PosterPath,
			BackdropPath: rawResult.BackdropPath,
			VoteAverage:  rawResult.VoteAverage,
			VoteCount:    rawResult.VoteCount,
			Popularity:   rawResult.Popularity,
			MediaType:    rawResult.MediaType,
			Adult:        rawResult.Adult,
			GenreIDs:     rawResult.GenreIDs,
		}

		// Normalize fields based on media type
		if rawResult.MediaType == "tv" {
			// For TV shows, use 'name' as title and 'first_air_date' as release_date
			normalized.Title = rawResult.Name
			normalized.OriginalTitle = rawResult.OriginalName
			normalized.ReleaseDate = rawResult.FirstAirDate
		} else if rawResult.MediaType == "movie" {
			// For movies, use the movie-specific fields
			normalized.Title = rawResult.Title
			normalized.OriginalTitle = rawResult.OriginalTitle
			normalized.ReleaseDate = rawResult.ReleaseDate
		}

		normalizedResults = append(normalizedResults, normalized)
	}

	// Create the final response
	searchResp := &TMDBMultiSearchResponse{
		Page:         rawResp.Page,
		Results:      normalizedResults,
		TotalPages:   rawResp.TotalPages,
		TotalResults: len(normalizedResults), // Use filtered count
	}

	log.Printf("🔍 TMDB Multi Search for '%s': Found %d results (%d movies/TV shows)",
		query, len(normalizedResults), len(normalizedResults))

	return searchResp, nil
}

// SearchMoviesOnly searches only for movies
func (t *TMDBService) SearchMoviesOnly(query string, page int) (*TMDBSearchResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if query == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	if page < 1 {
		page = 1
	}

	searchURL := fmt.Sprintf("%s/search/movie", t.baseURL)
	params := url.Values{}
	params.Add("query", query)
	params.Add("page", strconv.Itoa(page))
	params.Add("include_adult", "false")

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

	log.Printf("🎬 TMDB Movie Search for '%s': Found %d results", query, len(searchResp.Results))
	return &searchResp, nil
}

// SearchTVOnly searches only for TV shows
func (t *TMDBService) SearchTVOnly(query string, page int) (*TMDBTVSearchResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if query == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	if page < 1 {
		page = 1
	}

	searchURL := fmt.Sprintf("%s/search/tv", t.baseURL)
	params := url.Values{}
	params.Add("query", query)
	params.Add("page", strconv.Itoa(page))
	params.Add("include_adult", "false")

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

	var searchResp TMDBTVSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	log.Printf("📺 TMDB TV Search for '%s': Found %d results", query, len(searchResp.Results))
	return &searchResp, nil
}

// TMDBRelatedResponse represents the response for similar/recommended content
type TMDBRelatedResponse struct {
	Page         int         `json:"page"`
	Results      []TMDBMovie `json:"results"`
	TotalPages   int         `json:"total_pages"`
	TotalResults int         `json:"total_results"`
}

// TMDBTVRelatedResponse represents the response for similar/recommended TV content
type TMDBTVRelatedResponse struct {
	Page         int      `json:"page"`
	Results      []TMDBTV `json:"results"`
	TotalPages   int      `json:"total_pages"`
	TotalResults int      `json:"total_results"`
}

// GetSimilarMovies fetches movies similar to the given movie ID
func (t *TMDBService) GetSimilarMovies(movieID int, page int) (*TMDBRelatedResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if page < 1 {
		page = 1
	}

	requestURL := fmt.Sprintf("%s/movie/%d/similar", t.baseURL, movieID)
	params := url.Values{}
	params.Add("page", strconv.Itoa(page))
	params.Add("language", "en-US")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var relatedResp TMDBRelatedResponse
	if err := json.NewDecoder(resp.Body).Decode(&relatedResp); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Found %d similar movies for movie ID %d", len(relatedResp.Results), movieID)
	return &relatedResp, nil
}

// GetRecommendedMovies fetches movies recommended based on the given movie ID
func (t *TMDBService) GetRecommendedMovies(movieID int, page int) (*TMDBRelatedResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if page < 1 {
		page = 1
	}

	requestURL := fmt.Sprintf("%s/movie/%d/recommendations", t.baseURL, movieID)
	params := url.Values{}
	params.Add("page", strconv.Itoa(page))
	params.Add("language", "en-US")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var relatedResp TMDBRelatedResponse
	if err := json.NewDecoder(resp.Body).Decode(&relatedResp); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Found %d recommended movies for movie ID %d", len(relatedResp.Results), movieID)
	return &relatedResp, nil
}

// GetSimilarTVShows fetches TV shows similar to the given TV show ID
func (t *TMDBService) GetSimilarTVShows(tvID int, page int) (*TMDBTVRelatedResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if page < 1 {
		page = 1
	}

	requestURL := fmt.Sprintf("%s/tv/%d/similar", t.baseURL, tvID)
	params := url.Values{}
	params.Add("page", strconv.Itoa(page))
	params.Add("language", "en-US")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var relatedResp TMDBTVRelatedResponse
	if err := json.NewDecoder(resp.Body).Decode(&relatedResp); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Found %d similar TV shows for TV ID %d", len(relatedResp.Results), tvID)
	return &relatedResp, nil
}

// GetRecommendedTVShows fetches TV shows recommended based on the given TV show ID
func (t *TMDBService) GetRecommendedTVShows(tvID int, page int) (*TMDBTVRelatedResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if page < 1 {
		page = 1
	}

	requestURL := fmt.Sprintf("%s/tv/%d/recommendations", t.baseURL, tvID)
	params := url.Values{}
	params.Add("page", strconv.Itoa(page))
	params.Add("language", "en-US")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var relatedResp TMDBTVRelatedResponse
	if err := json.NewDecoder(resp.Body).Decode(&relatedResp); err != nil {
		return nil, err
	}

	log.Printf("✅ TMDB: Found %d recommended TV shows for TV ID %d", len(relatedResp.Results), tvID)
	return &relatedResp, nil
}

// GetRelatedMedia fetches both similar and recommended content for movies or TV shows
// If releaseYear > 0, it will filter and prioritize results from around that year (±2 years)
func (t *TMDBService) GetRelatedMedia(mediaID int, mediaType string, limit int, releaseYear int) ([]TMDBSearchResult, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	if limit <= 0 {
		limit = 20
	}

	var allResults []TMDBSearchResult

	if mediaType == "movie" {
		// Get similar movies
		similar, err := t.GetSimilarMovies(mediaID, 1)
		if err == nil && similar != nil {
			for _, movie := range similar.Results {
				if len(allResults) >= limit {
					break
				}
				result := TMDBSearchResult{
					ID:            movie.ID,
					Title:         movie.Title,
					OriginalTitle: movie.OriginalTitle,
					Overview:      movie.Overview,
					ReleaseDate:   movie.ReleaseDate,
					PosterPath:    movie.PosterPath,
					BackdropPath:  movie.BackdropPath,
					VoteAverage:   movie.VoteAverage,
					VoteCount:     movie.VoteCount,
					Popularity:    movie.Popularity,
					MediaType:     "movie",
					Adult:         movie.Adult,
					GenreIDs:      movie.GenreIDs,
				}
				allResults = append(allResults, result)
			}
		}

		// Get recommended movies if we need more
		if len(allResults) < limit {
			recommended, err := t.GetRecommendedMovies(mediaID, 1)
			if err == nil && recommended != nil {
				for _, movie := range recommended.Results {
					if len(allResults) >= limit {
						break
					}
					// Check if already exists
					exists := false
					for _, existing := range allResults {
						if existing.ID == movie.ID {
							exists = true
							break
						}
					}
					if !exists {
						result := TMDBSearchResult{
							ID:            movie.ID,
							Title:         movie.Title,
							OriginalTitle: movie.OriginalTitle,
							Overview:      movie.Overview,
							ReleaseDate:   movie.ReleaseDate,
							PosterPath:    movie.PosterPath,
							BackdropPath:  movie.BackdropPath,
							VoteAverage:   movie.VoteAverage,
							VoteCount:     movie.VoteCount,
							Popularity:    movie.Popularity,
							MediaType:     "movie",
							Adult:         movie.Adult,
							GenreIDs:      movie.GenreIDs,
						}
						allResults = append(allResults, result)
					}
				}
			}
		}
	} else if mediaType == "tv" {
		// Get similar TV shows
		similar, err := t.GetSimilarTVShows(mediaID, 1)
		if err == nil && similar != nil {
			for _, tv := range similar.Results {
				if len(allResults) >= limit {
					break
				}
				result := TMDBSearchResult{
					ID:            tv.ID,
					Title:         tv.Name,
					OriginalTitle: tv.OriginalName,
					Overview:      tv.Overview,
					ReleaseDate:   tv.FirstAirDate,
					PosterPath:    tv.PosterPath,
					BackdropPath:  tv.BackdropPath,
					VoteAverage:   tv.VoteAverage,
					VoteCount:     tv.VoteCount,
					Popularity:    tv.Popularity,
					MediaType:     "tv",
					Adult:         tv.Adult,
					GenreIDs:      tv.GenreIDs,
				}
				allResults = append(allResults, result)
			}
		}

		// Get recommended TV shows if we need more
		if len(allResults) < limit {
			recommended, err := t.GetRecommendedTVShows(mediaID, 1)
			if err == nil && recommended != nil {
				for _, tv := range recommended.Results {
					if len(allResults) >= limit {
						break
					}
					// Check if already exists
					exists := false
					for _, existing := range allResults {
						if existing.ID == tv.ID {
							exists = true
							break
						}
					}
					if !exists {
						result := TMDBSearchResult{
							ID:            tv.ID,
							Title:         tv.Name,
							OriginalTitle: tv.OriginalName,
							Overview:      tv.Overview,
							ReleaseDate:   tv.FirstAirDate,
							PosterPath:    tv.PosterPath,
							BackdropPath:  tv.BackdropPath,
							VoteAverage:   tv.VoteAverage,
							VoteCount:     tv.VoteCount,
							Popularity:    tv.Popularity,
							MediaType:     "tv",
							Adult:         tv.Adult,
							GenreIDs:      tv.GenreIDs,
						}
						allResults = append(allResults, result)
					}
				}
			}
		}
	}

	// Apply year-based filtering and sorting if year is provided
	if releaseYear > 0 {
		log.Printf("🗓️ TMDB: Sorting related media by proximity to year %d", releaseYear)
		
		// Score results by year proximity but DON'T filter them out
		type scoredResult struct {
			result   TMDBSearchResult
			yearDiff int // Absolute difference from target year
		}
		
		var scored []scoredResult
		for _, result := range allResults {
			var resultYear int
			if result.ReleaseDate != "" {
				// Extract year from release date (format: YYYY-MM-DD)
				if parsedTime, err := time.Parse("2006-01-02", result.ReleaseDate); err == nil {
					resultYear = parsedTime.Year()
				} else {
					// Try parsing just the year
					fmt.Sscanf(result.ReleaseDate[:4], "%d", &resultYear)
				}
			}
			
			yearDiff := 999 // Default high value for items without dates
			if resultYear > 0 {
				yearDiff = resultYear - releaseYear
				if yearDiff < 0 {
					yearDiff = -yearDiff // Absolute value
				}
			}
			
			scored = append(scored, scoredResult{
				result:   result,
				yearDiff: yearDiff,
			})
		}
		
		// Sort by year proximity (closest to target year first), then by popularity
		sort.Slice(scored, func(i, j int) bool {
			// Primary sort: year difference (smaller = closer)
			if scored[i].yearDiff != scored[j].yearDiff {
				return scored[i].yearDiff < scored[j].yearDiff
			}
			// Secondary sort: popularity (higher = better)
			return scored[i].result.Popularity > scored[j].result.Popularity
		})
		
		// Rebuild allResults from scored results
		allResults = make([]TMDBSearchResult, 0, len(scored))
		for _, s := range scored {
			allResults = append(allResults, s.result)
		}
		
		log.Printf("✅ TMDB: Found %d related %s items for ID %d (sorted by proximity to year %d)", 
			len(allResults), mediaType, mediaID, releaseYear)
	} else {
		// Original behavior: Sort results by release date (most recent first)
		sort.Slice(allResults, func(i, j int) bool {
			dateI := allResults[i].ReleaseDate
			dateJ := allResults[j].ReleaseDate

			// Handle empty dates - push them to the end
			if dateI == "" && dateJ == "" {
				return false
			}
			if dateI == "" {
				return false
			}
			if dateJ == "" {
				return true
			}

			// Parse dates and compare (newer dates come first)
			return dateI > dateJ
		})
		
		log.Printf("✅ TMDB: Found %d related %s items for ID %d (sorted by release date)", 
			len(allResults), mediaType, mediaID)
	}

	return allResults, nil
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// validateImagePath checks if an image path is valid and non-empty
func (t *TMDBService) validateImagePath(path string) bool {
	return path != "" && len(strings.TrimSpace(path)) > 0 && strings.HasPrefix(path, "/")
}

// buildImageURL safely constructs TMDB image URLs with validation
func (t *TMDBService) buildImageURL(path, size string) string {
	if !t.validateImagePath(path) {
		return ""
	}
	if size == "" {
		size = "w500" // default size
	}
	return "https://image.tmdb.org/t/p/" + size + path
}

// validateMetadata performs final validation on metadata before returning
func (t *TMDBService) validateMetadata(metadata *interfaces.MediaMetadata, title string) {
	issues := []string{}

	if metadata.PosterURL == "" {
		issues = append(issues, "missing poster URL")
	}
	if metadata.BackdropURL == "" {
		issues = append(issues, "missing backdrop URL")
	}
	if metadata.TrailerURL == "" {
		issues = append(issues, "missing trailer URL")
	}
	if metadata.Title == "" {
		issues = append(issues, "missing title")
	}
	if metadata.Year == 0 {
		issues = append(issues, "missing year")
	}

	if len(issues) > 0 {
		log.Printf("⚠️ Metadata validation for '%s': %s", title, strings.Join(issues, ", "))
	} else {
		log.Printf("✅ Metadata validation passed for '%s'", title)
	}
}

// UpcomingTVSeriesResponse represents the combined response for TV series
type UpcomingTVSeriesResponse struct {
	AiringToday    []TMDBTV  `json:"airing_today"`
	OnTheAir       []TMDBTV  `json:"on_the_air"`
	TrendingDaily  []TMDBTV  `json:"trending_daily"`
	TrendingWeekly []TMDBTV  `json:"trending_weekly"`
	CachedAt       time.Time `json:"cached_at"`
}

// GetUpcomingTVSeries fetches airing today, on the air, and trending TV series from TMDB
func (t *TMDBService) GetUpcomingTVSeries() (*UpcomingTVSeriesResponse, error) {
	if t.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	log.Printf("📺 Fetching TV series from TMDB...")

	// Fetch airing today TV shows
	airingToday, err := t.fetchAiringTodayTVShows()
	if err != nil {
		log.Printf("⚠️ Failed to fetch airing today TV shows: %v", err)
		airingToday = []TMDBTV{} // Continue with empty slice
	}

	// Fetch on the air TV shows
	onTheAir, err := t.fetchOnTheAirTVShows()
	if err != nil {
		log.Printf("⚠️ Failed to fetch on the air TV shows: %v", err)
		onTheAir = []TMDBTV{} // Continue with empty slice
	}

	// Fetch trending TV shows (daily)
	trendingDaily, err := t.fetchTrendingTVShows("day")
	if err != nil {
		log.Printf("⚠️ Failed to fetch daily trending TV shows: %v", err)
		trendingDaily = []TMDBTV{} // Continue with empty slice
	}

	// Fetch trending TV shows (weekly)
	trendingWeekly, err := t.fetchTrendingTVShows("week")
	if err != nil {
		log.Printf("⚠️ Failed to fetch weekly trending TV shows: %v", err)
		trendingWeekly = []TMDBTV{} // Continue with empty slice
	}

	response := &UpcomingTVSeriesResponse{
		AiringToday:    airingToday,
		OnTheAir:       onTheAir,
		TrendingDaily:  trendingDaily,
		TrendingWeekly: trendingWeekly,
		CachedAt:       time.Now(),
	}

	log.Printf("✅ Successfully fetched TV series: %d airing today, %d on the air, %d trending daily, %d trending weekly",
		len(airingToday), len(onTheAir), len(trendingDaily), len(trendingWeekly))

	return response, nil
}

// fetchAiringTodayTVShows fetches TV shows airing today
func (t *TMDBService) fetchAiringTodayTVShows() ([]TMDBTV, error) {
	requestURL := fmt.Sprintf("%s/tv/airing_today", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var searchResp TMDBTVSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}

// fetchOnTheAirTVShows fetches TV shows currently on the air
func (t *TMDBService) fetchOnTheAirTVShows() ([]TMDBTV, error) {
	requestURL := fmt.Sprintf("%s/tv/on_the_air", t.baseURL)
	params := url.Values{}
	params.Add("language", "en-US")
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var searchResp TMDBTVSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}

// fetchTrendingTVShows fetches trending TV shows for a given time window
func (t *TMDBService) fetchTrendingTVShows(timeWindow string) ([]TMDBTV, error) {
	requestURL := fmt.Sprintf("%s/trending/tv/%s", t.baseURL, timeWindow)
	params := url.Values{}
	params.Add("page", "1")

	req, err := http.NewRequest("GET", requestURL+"?"+params.Encode(), nil)
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

	var searchResp TMDBTVSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	// Limit to 20 results
	if len(searchResp.Results) > 20 {
		searchResp.Results = searchResp.Results[:20]
	}

	return searchResp.Results, nil
}
