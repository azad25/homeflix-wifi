package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"sync"
	"time"
)

// ProviderService handles streaming provider data from TMDB
type ProviderService struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	cache      sync.Map
}

// ProviderCacheEntry represents a cached provider response
type ProviderCacheEntry struct {
	data      interface{}
	fetchedAt time.Time
}

const providerCacheTTL = 24 * time.Hour // Cache provider responses for 24 hours

// Supported regions for provider data (combined availability)
var SupportedRegions = []string{"US", "IN", "BD"}

// Provider represents a streaming watch provider
type WatchProvider struct {
	ProviderID      int    `json:"provider_id"`
	ProviderName    string `json:"provider_name"`
	LogoPath        string `json:"logo_path"`
	DisplayPriority int    `json:"display_priority"`
	// Brand colors for UI theming
	PrimaryColor   string `json:"primary_color"`
	SecondaryColor string `json:"secondary_color"`
}

// ProviderColors maps provider IDs to their brand colors
var ProviderColors = map[int]struct {
	Primary   string
	Secondary string
}{
	8:   {Primary: "#E50914", Secondary: "#B20710"},   // Netflix - Red
	9:   {Primary: "#00A8E1", Secondary: "#146EB4"},   // Amazon Prime Video - Blue
	119: {Primary: "#00A8E1", Secondary: "#146EB4"},   // Amazon Prime Video (alternate)
	337: {Primary: "#0063E5", Secondary: "#040714"},   // Disney+ - Blue
	15:  {Primary: "#1CE783", Secondary: "#040405"},   // Hulu - Green
	318: {Primary: "#5822B4", Secondary: "#000000"},   // Max (HBO) - Purple
	350: {Primary: "#000000", Secondary: "#FFFFFF"},   // Apple TV+ - Black
	531: {Primary: "#6B5CE7", Secondary: "#1A1A2E"},   // Paramount+ - Purple
	386: {Primary: "#FFD700", Secondary: "#0057B8"},   // Peacock - Gold/Blue
	283: {Primary: "#DF0024", Secondary: "#000000"},   // Crunchyroll - Orange/Red
	192: {Primary: "#E6121D", Secondary: "#000000"},   // YouTube Premium - Red
}

// WatchProviderResponse represents TMDB watch provider list response
type WatchProviderResponse struct {
	Results []WatchProvider `json:"results"`
}

// ProviderAvailability represents where content is available
type ProviderAvailability struct {
	Link     string          `json:"link"`
	Flatrate []WatchProvider `json:"flatrate,omitempty"`
	Rent     []WatchProvider `json:"rent,omitempty"`
	Buy      []WatchProvider `json:"buy,omitempty"`
	Free     []WatchProvider `json:"free,omitempty"`
	Ads      []WatchProvider `json:"ads,omitempty"`
}

// ContentProvidersResponse represents TMDB content providers response
type ContentProvidersResponse struct {
	ID      int                          `json:"id"`
	Results map[string]ProviderAvailability `json:"results"`
}

// DiscoverResult represents a movie/TV from discover endpoint
type DiscoverResult struct {
	ID               int      `json:"id"`
	Title            string   `json:"title,omitempty"` // For movies
	Name             string   `json:"name,omitempty"`  // For TV
	Overview         string   `json:"overview"`
	PosterPath       string   `json:"poster_path"`
	BackdropPath     string   `json:"backdrop_path"`
	ReleaseDate      string   `json:"release_date,omitempty"`
	FirstAirDate     string   `json:"first_air_date,omitempty"`
	VoteAverage      float64  `json:"vote_average"`
	VoteCount        int      `json:"vote_count"`
	Popularity       float64  `json:"popularity"`
	GenreIDs         []int    `json:"genre_ids"`
	OriginalLanguage string   `json:"original_language"`
	MediaType        string   `json:"media_type,omitempty"`
}

// DiscoverResponse represents TMDB discover endpoint response
type DiscoverResponse struct {
	Page         int              `json:"page"`
	TotalPages   int              `json:"total_pages"`
	TotalResults int              `json:"total_results"`
	Results      []DiscoverResult `json:"results"`
}

// ProviderContentResponse combines content from multiple regions
type ProviderContentResponse struct {
	ProviderID   int              `json:"provider_id"`
	ProviderName string           `json:"provider_name"`
	Regions      []string         `json:"regions"`
	Page         int              `json:"page"`
	TotalPages   int              `json:"total_pages"`
	TotalResults int              `json:"total_results"`
	Results      []DiscoverResult `json:"results"`
}

// NewProviderService creates a new provider service instance
func NewProviderService() *ProviderService {
	apiKey := os.Getenv("TMDB_API_KEY")
	if apiKey == "" {
		log.Printf("⚠️ TMDB_API_KEY not set - Provider service will not function")
	} else {
		log.Printf("✅ Provider service initialized with TMDB API key")
	}

	return &ProviderService{
		apiKey:  apiKey,
		baseURL: "https://api.themoviedb.org/3",
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// getCachedData retrieves cached provider data
func (p *ProviderService) getCachedData(key string) (interface{}, bool) {
	if cached, ok := p.cache.Load(key); ok {
		entry := cached.(ProviderCacheEntry)
		if time.Since(entry.fetchedAt) < providerCacheTTL {
			fmt.Printf("⚡ Provider cache hit for: %s (%.1fh old)\n", key, time.Since(entry.fetchedAt).Hours())
			return entry.data, true
		}
		p.cache.Delete(key)
	}
	return nil, false
}

// setCachedData stores provider data in cache
func (p *ProviderService) setCachedData(key string, data interface{}) {
	p.cache.Store(key, ProviderCacheEntry{
		data:      data,
		fetchedAt: time.Now(),
	})
	fmt.Printf("💾 Provider data cached: %s\n", key)
}

// makeRequest performs an HTTP request to TMDB API
func (p *ProviderService) makeRequest(endpoint string, params url.Values) ([]byte, error) {
	if p.apiKey == "" {
		return nil, fmt.Errorf("TMDB API key not configured")
	}

	fullURL := fmt.Sprintf("%s%s?%s", p.baseURL, endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}

	var body []byte
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	return body, nil
}

// GetWatchProviders retrieves all available watch providers for a region
// Combines providers from all supported regions (US, IN, BD)
func (p *ProviderService) GetWatchProviders(mediaType string) ([]WatchProvider, error) {
	cacheKey := fmt.Sprintf("providers_%s_combined", mediaType)
	
	if cached, ok := p.getCachedData(cacheKey); ok {
		return cached.([]WatchProvider), nil
	}

	providerMap := make(map[int]WatchProvider)

	// Fetch providers from all supported regions
	for _, region := range SupportedRegions {
		params := url.Values{}
		params.Add("watch_region", region)

		endpoint := fmt.Sprintf("/watch/providers/%s", mediaType)
		body, err := p.makeRequest(endpoint, params)
		if err != nil {
			log.Printf("⚠️ Failed to get providers for region %s: %v", region, err)
			continue
		}

		var response WatchProviderResponse
		if err := json.Unmarshal(body, &response); err != nil {
			log.Printf("⚠️ Failed to parse providers for region %s: %v", region, err)
			continue
		}

		// Merge providers, keeping the one with lowest display priority
		for _, provider := range response.Results {
			// Add brand colors
			if colors, ok := ProviderColors[provider.ProviderID]; ok {
				provider.PrimaryColor = colors.Primary
				provider.SecondaryColor = colors.Secondary
			} else {
				// Default colors for unknown providers
				provider.PrimaryColor = "#1a1a1a"
				provider.SecondaryColor = "#333333"
			}

			if existing, ok := providerMap[provider.ProviderID]; ok {
				if provider.DisplayPriority < existing.DisplayPriority {
					providerMap[provider.ProviderID] = provider
				}
			} else {
				providerMap[provider.ProviderID] = provider
			}
		}
	}

	// Convert map to slice and sort by priority
	providers := make([]WatchProvider, 0, len(providerMap))
	for _, provider := range providerMap {
		providers = append(providers, provider)
	}

	sort.Slice(providers, func(i, j int) bool {
		return providers[i].DisplayPriority < providers[j].DisplayPriority
	})

	log.Printf("✅ Retrieved %d unique providers across regions %v", len(providers), SupportedRegions)
	p.setCachedData(cacheKey, providers)

	return providers, nil
}

// GetProviderByID retrieves a specific provider's details
func (p *ProviderService) GetProviderByID(providerID int, mediaType string) (*WatchProvider, error) {
	providers, err := p.GetWatchProviders(mediaType)
	if err != nil {
		return nil, err
	}

	for _, provider := range providers {
		if provider.ProviderID == providerID {
			return &provider, nil
		}
	}

	return nil, fmt.Errorf("provider with ID %d not found", providerID)
}

// DiscoverByProvider fetches content available on a specific provider
// Combines results from all supported regions (US, IN, BD)
func (p *ProviderService) DiscoverByProvider(providerID int, mediaType string, page int, sortBy string) (*ProviderContentResponse, error) {
	cacheKey := fmt.Sprintf("discover_%s_provider_%d_page_%d_sort_%s", mediaType, providerID, page, sortBy)
	
	if cached, ok := p.getCachedData(cacheKey); ok {
		return cached.(*ProviderContentResponse), nil
	}

	// Get provider info
	provider, err := p.GetProviderByID(providerID, mediaType)
	if err != nil {
		log.Printf("⚠️ Provider %d not found, continuing with discovery", providerID)
	}

	resultMap := make(map[int]DiscoverResult)
	var totalResults int
	var totalPages int

	// Fetch content from all supported regions
	for _, region := range SupportedRegions {
		params := url.Values{}
		params.Add("with_watch_providers", strconv.Itoa(providerID))
		params.Add("watch_region", region)
		params.Add("page", strconv.Itoa(page))
		if sortBy != "" {
			params.Add("sort_by", sortBy)
		} else {
			params.Add("sort_by", "popularity.desc")
		}

		endpoint := fmt.Sprintf("/discover/%s", mediaType)
		body, err := p.makeRequest(endpoint, params)
		if err != nil {
			log.Printf("⚠️ Failed to discover content for provider %d in %s: %v", providerID, region, err)
			continue
		}

		var response DiscoverResponse
		if err := json.Unmarshal(body, &response); err != nil {
			log.Printf("⚠️ Failed to parse discover response for provider %d in %s: %v", providerID, region, err)
			continue
		}

		// Merge results, avoiding duplicates
		for _, result := range response.Results {
			if _, exists := resultMap[result.ID]; !exists {
				result.MediaType = mediaType
				resultMap[result.ID] = result
			}
		}

		// Track totals (use max from any region)
		if response.TotalResults > totalResults {
			totalResults = response.TotalResults
		}
		if response.TotalPages > totalPages {
			totalPages = response.TotalPages
		}
	}

	// Convert map to slice
	results := make([]DiscoverResult, 0, len(resultMap))
	for _, result := range resultMap {
		results = append(results, result)
	}

	// Sort by popularity
	sort.Slice(results, func(i, j int) bool {
		return results[i].Popularity > results[j].Popularity
	})

	providerName := ""
	if provider != nil {
		providerName = provider.ProviderName
	}

	response := &ProviderContentResponse{
		ProviderID:   providerID,
		ProviderName: providerName,
		Regions:      SupportedRegions,
		Page:         page,
		TotalPages:   totalPages,
		TotalResults: totalResults,
		Results:      results,
	}

	log.Printf("✅ Discovered %d unique %s items for provider %d across regions", len(results), mediaType, providerID)
	p.setCachedData(cacheKey, response)

	return response, nil
}

// GetTrendingByProvider fetches trending content on a specific provider
func (p *ProviderService) GetTrendingByProvider(providerID int, mediaType string, page int) (*ProviderContentResponse, error) {
	return p.DiscoverByProvider(providerID, mediaType, page, "popularity.desc")
}

// GetPopularByProvider fetches popular content on a specific provider
func (p *ProviderService) GetPopularByProvider(providerID int, mediaType string, page int) (*ProviderContentResponse, error) {
	return p.DiscoverByProvider(providerID, mediaType, page, "vote_count.desc")
}

// GetTopRatedByProvider fetches top rated content on a specific provider
func (p *ProviderService) GetTopRatedByProvider(providerID int, mediaType string, page int) (*ProviderContentResponse, error) {
	return p.DiscoverByProvider(providerID, mediaType, page, "vote_average.desc")
}

// GetNewReleasesOnProvider fetches recently released content on a provider
func (p *ProviderService) GetNewReleasesOnProvider(providerID int, mediaType string, page int) (*ProviderContentResponse, error) {
	if mediaType == "movie" {
		return p.DiscoverByProvider(providerID, mediaType, page, "primary_release_date.desc")
	}
	return p.DiscoverByProvider(providerID, mediaType, page, "first_air_date.desc")
}

// GetContentProviders fetches where a specific movie/TV can be watched
// Returns combined availability across all supported regions
func (p *ProviderService) GetContentProviders(contentID int, mediaType string) (map[string]ProviderAvailability, error) {
	cacheKey := fmt.Sprintf("content_providers_%s_%d", mediaType, contentID)
	
	if cached, ok := p.getCachedData(cacheKey); ok {
		return cached.(map[string]ProviderAvailability), nil
	}

	endpoint := fmt.Sprintf("/%s/%d/watch/providers", mediaType, contentID)
	body, err := p.makeRequest(endpoint, url.Values{})
	if err != nil {
		return nil, err
	}

	var response ContentProvidersResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	// Filter to only include supported regions
	result := make(map[string]ProviderAvailability)
	for _, region := range SupportedRegions {
		if availability, ok := response.Results[region]; ok {
			// Add brand colors to providers
			addColorsToProviders(availability.Flatrate)
			addColorsToProviders(availability.Rent)
			addColorsToProviders(availability.Buy)
			addColorsToProviders(availability.Free)
			addColorsToProviders(availability.Ads)
			result[region] = availability
		}
	}

	log.Printf("✅ Retrieved providers for %s %d in %d regions", mediaType, contentID, len(result))
	p.setCachedData(cacheKey, result)

	return result, nil
}

// addColorsToProviders adds brand colors to a slice of providers
func addColorsToProviders(providers []WatchProvider) {
	for i := range providers {
		if colors, ok := ProviderColors[providers[i].ProviderID]; ok {
			providers[i].PrimaryColor = colors.Primary
			providers[i].SecondaryColor = colors.Secondary
		} else {
			providers[i].PrimaryColor = "#1a1a1a"
			providers[i].SecondaryColor = "#333333"
		}
	}
}

// GetAllProvidersWithContent returns providers that have content in any supported region
func (p *ProviderService) GetAllProvidersWithContent() ([]WatchProvider, error) {
	// Get movie providers
	movieProviders, err := p.GetWatchProviders("movie")
	if err != nil {
		return nil, err
	}

	// Get TV providers and merge
	tvProviders, err := p.GetWatchProviders("tv")
	if err != nil {
		return nil, err
	}

	// Merge providers
	providerMap := make(map[int]WatchProvider)
	for _, p := range movieProviders {
		providerMap[p.ProviderID] = p
	}
	for _, p := range tvProviders {
		if _, exists := providerMap[p.ProviderID]; !exists {
			providerMap[p.ProviderID] = p
		}
	}

	// Convert to slice and sort
	result := make([]WatchProvider, 0, len(providerMap))
	for _, provider := range providerMap {
		result = append(result, provider)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].DisplayPriority < result[j].DisplayPriority
	})

	return result, nil
}

// GetProviderLogoURL returns the full URL for a provider logo
func (p *ProviderService) GetProviderLogoURL(logoPath string) string {
	if logoPath == "" {
		return ""
	}
	return fmt.Sprintf("https://image.tmdb.org/t/p/w185%s", logoPath)
}

// BuildImageURL builds a full TMDB image URL
func (p *ProviderService) BuildImageURL(path string, size string) string {
	if path == "" {
		return ""
	}
	return fmt.Sprintf("https://image.tmdb.org/t/p/%s%s", size, path)
}
