package handlers

import (
	"net/http"
	"strconv"
	"sync"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// ProviderHandlers contains all provider-related API handlers

// GetAllProviders returns all available streaming providers
func GetAllProviders(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		providers, err := providerService.GetAllProvidersWithContent()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Build response with full logo URLs
		response := make([]gin.H, len(providers))
		for i, p := range providers {
			response[i] = gin.H{
				"id":              p.ProviderID,
				"name":            p.ProviderName,
				"logo_path":       p.LogoPath,
				"logo_url":        providerService.GetProviderLogoURL(p.LogoPath),
				"display_priority": p.DisplayPriority,
				"primary_color":   p.PrimaryColor,
				"secondary_color": p.SecondaryColor,
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"providers": response,
			"regions":   services.SupportedRegions,
		})
	}
}

// Cache for provider showcase
var (
	showcaseCache      gin.H
	showcaseCacheTime  int64
	showcaseCacheMutex sync.RWMutex
)

// GetProviderShowcase returns top providers with a sample of their trending content
func GetProviderShowcase(providerService *services.ProviderService, redisCache *services.RedisAssetCache) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check Redis cache if available
		if redisCache != nil {
			if cached, err := redisCache.GetShowcaseCache(); err == nil && cached != nil {
				c.JSON(http.StatusOK, cached)
				return
			}
		}

		// Get top 8 providers
		providers, err := providerService.GetAllProvidersWithContent()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Limit to top 8 for showcase
		if len(providers) > 8 {
			providers = providers[:8]
		}

		type ShowcaseItem struct {
			Provider services.WatchProvider `json:"provider"`
			Content  []services.DiscoverResult `json:"content"`
		}

		results := make([]ShowcaseItem, len(providers))
		var wg sync.WaitGroup

		for i, p := range providers {
			wg.Add(1)
			go func(index int, provider services.WatchProvider) {
				defer wg.Done()
				
				// Fetch trending movies and TV shows concurrently
				var movies, tvShows *services.ProviderContentResponse
				var errMovie, errTV error
				var wgContent sync.WaitGroup

				wgContent.Add(2)
				go func() {
					defer wgContent.Done()
					movies, errMovie = providerService.GetTrendingByProvider(provider.ProviderID, "movie", 1)
				}()
				go func() {
					defer wgContent.Done()
					tvShows, errTV = providerService.GetTrendingByProvider(provider.ProviderID, "tv", 1)
				}()
				wgContent.Wait()

				combinedResults := []services.DiscoverResult{}
				
				// Process Movies
				if errMovie == nil && movies != nil {
					for _, m := range movies.Results {
						m.PosterPath = providerService.BuildImageURL(m.PosterPath, "w500")
						m.BackdropPath = providerService.BuildImageURL(m.BackdropPath, "w1280")
						m.MediaType = "movie"
						combinedResults = append(combinedResults, m)
					}
				}

				// Process TV Shows
				if errTV == nil && tvShows != nil {
					for _, t := range tvShows.Results {
						t.PosterPath = providerService.BuildImageURL(t.PosterPath, "w500")
						t.BackdropPath = providerService.BuildImageURL(t.BackdropPath, "w1280")
						t.MediaType = "tv"
						combinedResults = append(combinedResults, t)
					}
				}

				// Interleave or sort results? Simple interleave for variety
				mixedResults := []services.DiscoverResult{}
				//maxLen := len(combinedResults)
				// Basic shuffle/mix logic (taking top 5 movies, top 5 tv, or mixing)
				// Let's rely on popularity sort implicitly if we merged? No, they are separate lists.
				// Let's just take top 10 mixed (e.g. 1 movie, 1 tv, etc)
				
				mIdx, tIdx := 0, 0
				var mRes, tRes []services.DiscoverResult
				if errMovie == nil && movies != nil { mRes = movies.Results }
				if errTV == nil && tvShows != nil { tRes = tvShows.Results }

				for len(mixedResults) < 15 && (mIdx < len(mRes) || tIdx < len(tRes)) {
					if mIdx < len(mRes) {
						m := mRes[mIdx]
						m.PosterPath = providerService.BuildImageURL(m.PosterPath, "w500")
						m.BackdropPath = providerService.BuildImageURL(m.BackdropPath, "w1280")
						m.MediaType = "movie"
						mixedResults = append(mixedResults, m)
						mIdx++
					}
					if tIdx < len(tRes) {
						t := tRes[tIdx]
						t.PosterPath = providerService.BuildImageURL(t.PosterPath, "w500")
						t.BackdropPath = providerService.BuildImageURL(t.BackdropPath, "w1280")
						t.MediaType = "tv"
						mixedResults = append(mixedResults, t)
						tIdx++
					}
				}

				results[index] = ShowcaseItem{
					Provider: provider,
					Content:  mixedResults,
				}
				results[index].Provider.LogoPath = providerService.GetProviderLogoURL(provider.LogoPath)
			}(i, p)
		}

		wg.Wait()

		response := gin.H{
			"showcase": results,
		}

		// Update Redis cache if available
		if redisCache != nil {
			go redisCache.SetShowcaseCache(response)
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetProviderByID returns a specific provider's details
func GetProviderByID(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		provider, err := providerService.GetProviderByID(id, "movie")
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"id":              provider.ProviderID,
			"name":            provider.ProviderName,
			"logo_path":       provider.LogoPath,
			"logo_url":        providerService.GetProviderLogoURL(provider.LogoPath),
			"display_priority": provider.DisplayPriority,
			"primary_color":   provider.PrimaryColor,
			"secondary_color": provider.SecondaryColor,
			"regions":         services.SupportedRegions,
		})
	}
}

// GetProviderMovies returns movies available on a specific provider
func GetProviderMovies(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		sortBy := c.DefaultQuery("sort_by", "popularity.desc")

		content, err := providerService.DiscoverByProvider(id, "movie", page, sortBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs to results
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetProviderTV returns TV shows available on a specific provider
func GetProviderTV(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		sortBy := c.DefaultQuery("sort_by", "popularity.desc")

		content, err := providerService.DiscoverByProvider(id, "tv", page, sortBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs to results
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetProviderTrending returns trending content on a specific provider
func GetProviderTrending(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		mediaType := c.DefaultQuery("type", "movie")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

		content, err := providerService.GetTrendingByProvider(id, mediaType, page)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetProviderPopular returns popular content on a specific provider
func GetProviderPopular(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		mediaType := c.DefaultQuery("type", "movie")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

		content, err := providerService.GetPopularByProvider(id, mediaType, page)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetProviderTopRated returns top rated content on a specific provider
func GetProviderTopRated(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		mediaType := c.DefaultQuery("type", "movie")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

		content, err := providerService.GetTopRatedByProvider(id, mediaType, page)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetProviderNewReleases returns new releases on a specific provider
func GetProviderNewReleases(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		mediaType := c.DefaultQuery("type", "movie")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

		content, err := providerService.GetNewReleasesOnProvider(id, mediaType, page)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Add full image URLs
		for i := range content.Results {
			content.Results[i].PosterPath = providerService.BuildImageURL(content.Results[i].PosterPath, "w500")
			content.Results[i].BackdropPath = providerService.BuildImageURL(content.Results[i].BackdropPath, "w1280")
		}

		c.JSON(http.StatusOK, content)
	}
}

// GetContentProviders returns where specific content can be watched
func GetContentProviders(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaType := c.Param("type")
		if mediaType != "movie" && mediaType != "tv" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media type. Use 'movie' or 'tv'"})
			return
		}

		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid content ID"})
			return
		}

		availability, err := providerService.GetContentProviders(id, mediaType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"id":           id,
			"media_type":   mediaType,
			"availability": availability,
		})
	}
}

// GetProviderContent returns all content (movies + TV) for a provider
func GetProviderContent(providerService *services.ProviderService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider ID"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))

		// Get both movies and TV shows
		movies, moviesErr := providerService.DiscoverByProvider(id, "movie", page, "popularity.desc")
		tvShows, tvErr := providerService.DiscoverByProvider(id, "tv", page, "popularity.desc")

		if moviesErr != nil && tvErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch content"})
			return
		}

		// Build image URLs for movies
		movieResults := []services.DiscoverResult{}
		if moviesErr == nil {
			for i := range movies.Results {
				movies.Results[i].PosterPath = providerService.BuildImageURL(movies.Results[i].PosterPath, "w500")
				movies.Results[i].BackdropPath = providerService.BuildImageURL(movies.Results[i].BackdropPath, "w1280")
				// Fetch trailer for top 10 items only (for hero carousel)
				if i < 10 {
					movies.Results[i].TrailerURL = providerService.GetTrailerURL(movies.Results[i].ID, "movie")
				}
			}
			movieResults = movies.Results
		}

		// Build image URLs for TV shows
		tvResults := []services.DiscoverResult{}
		if tvErr == nil {
			for i := range tvShows.Results {
				tvShows.Results[i].PosterPath = providerService.BuildImageURL(tvShows.Results[i].PosterPath, "w500")
				tvShows.Results[i].BackdropPath = providerService.BuildImageURL(tvShows.Results[i].BackdropPath, "w1280")
				// Fetch trailer for top 10 items only (for hero carousel)
				if i < 10 {
					tvShows.Results[i].TrailerURL = providerService.GetTrailerURL(tvShows.Results[i].ID, "tv")
				}
			}
			tvResults = tvShows.Results
		}

		// Get provider info
		provider, _ := providerService.GetProviderByID(id, "movie")
		providerInfo := gin.H{
			"id":   id,
			"name": "",
		}
		if provider != nil {
			providerInfo = gin.H{
				"id":              provider.ProviderID,
				"name":            provider.ProviderName,
				"logo_url":        providerService.GetProviderLogoURL(provider.LogoPath),
				"primary_color":   provider.PrimaryColor,
				"secondary_color": provider.SecondaryColor,
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"provider": providerInfo,
			"movies":   movieResults,
			"tv_shows": tvResults,
			"page":     page,
			"regions":  services.SupportedRegions,
		})
	}
}
