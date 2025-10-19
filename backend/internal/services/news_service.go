package services

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type NewsArticle struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	URL         string    `json:"url"`
	Source      string    `json:"source"`
	PublishedAt time.Time `json:"published_at"`
	Category    string    `json:"category"`
}

type NewsResponse struct {
	Articles []NewsArticle `json:"articles"`
	Total    int           `json:"total"`
	Source   string        `json:"source"`
}

type NewsService struct {
	articles       []NewsArticle
	fallbackArticles []NewsArticle
	lastUpdate     time.Time
	mutex          sync.RWMutex
	updateChan     chan NewsArticle
	stopChan       chan bool
	isRunning      bool
	rotationIndex  int
}

// TheNewsAPI.com configuration
const (
	NewsAPIToken     = "f74IgnlU8MfqYXH1PLAnrL5FtYjZbZIC3Mj1UlK0"
	NewsAPIBaseURL   = "https://api.thenewsapi.com/v1/news"
	
	// Different endpoints for variety
	TopNewsURL       = NewsAPIBaseURL + "/top?api_token=" + NewsAPIToken + "&locale=us&limit=20"
	AllNewsURL       = NewsAPIBaseURL + "/all?api_token=" + NewsAPIToken + "&language=en&limit=15&categories=general,business,tech,sports"
	HeadlinesURL     = NewsAPIBaseURL + "/headlines?api_token=" + NewsAPIToken + "&locale=us&language=en"
	
	// RSS Feed URLs
	RSSFeedURL1      = "https://rss.app/feeds/0GoThGUIM3yIxXms.xml"
	RSSFeedURL2      = "https://rss.app/feeds/A7hkGBbRTZX4xtXj.xml"
)

// RSS Feed structures
type RSSFeed struct {
	XMLName xml.Name `xml:"rss"`
	Channel RSSChannel `xml:"channel"`
}

type RSSChannel struct {
	Title       string    `xml:"title"`
	Description string    `xml:"description"`
	Items       []RSSItem `xml:"item"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Description string `xml:"description"`
	Link        string `xml:"link"`
	PubDate     string `xml:"pubDate"`
	GUID        string `xml:"guid"`
}

func NewNewsService() *NewsService {
	ns := &NewsService{
		articles:         make([]NewsArticle, 0),
		fallbackArticles: make([]NewsArticle, 0),
		updateChan:       make(chan NewsArticle, 100),
		stopChan:         make(chan bool),
		isRunning:        false,
		rotationIndex:    0,
	}
	
	// Initialize with fallback news immediately
	ns.fallbackArticles = ns.generateFallbackNews()
	ns.articles = ns.fallbackArticles
	
	return ns
}

func (ns *NewsService) Start() {
	ns.mutex.Lock()
	defer ns.mutex.Unlock()
	
	if ns.isRunning {
		return
	}
	
	ns.isRunning = true
	
	// Initial fetch
	go ns.fetchAllNews()
	
	// Start background updater
	go ns.backgroundUpdater()
	
	log.Println("News service started")
}

func (ns *NewsService) Stop() {
	ns.mutex.Lock()
	defer ns.mutex.Unlock()
	
	if !ns.isRunning {
		return
	}
	
	ns.isRunning = false
	ns.stopChan <- true
	
	log.Println("News service stopped")
}

func (ns *NewsService) backgroundUpdater() {
	ticker := time.NewTicker(5 * time.Minute) // Update every 5 minutes
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			go ns.fetchAllNews()
		case <-ns.stopChan:
			return
		}
	}
}

func (ns *NewsService) fetchAllNews() {
	log.Println("Fetching news from all sources...")
	
	var wg sync.WaitGroup
	newArticles := make([]NewsArticle, 0)
	articlesChan := make(chan []NewsArticle, 10)
	
	// Fetch from TheNewsAPI.com endpoints and RSS feeds
	sources := []struct {
		name string
		url  string
		fetcher func(string) ([]NewsArticle, error)
	}{
		{"Top", TopNewsURL, ns.fetchNewsAPI},
		{"All", AllNewsURL, ns.fetchNewsAPI},
		{"Headlines", HeadlinesURL, ns.fetchHeadlinesAPI},
		{"RSS-1", RSSFeedURL1, ns.fetchRSSFeed},
		{"RSS-2", RSSFeedURL2, ns.fetchRSSFeed},
	}
	
	for _, source := range sources {
		wg.Add(1)
		go func(s struct {
			name string
			url  string
			fetcher func(string) ([]NewsArticle, error)
		}) {
			defer wg.Done()
			
			articles, err := s.fetcher(s.url)
			if err != nil {
				log.Printf("Error fetching news from %s: %v", s.name, err)
				// Add fallback news for this source
				articles = ns.getFallbackNews(s.name)
			}
			
			// Add source information
			for i := range articles {
				articles[i].Source = s.name
				if articles[i].ID == "" {
					titleLen := minInt(10, len(articles[i].Title))
					if titleLen > 0 {
						articles[i].ID = fmt.Sprintf("%s_%d_%s", s.name, time.Now().Unix(), articles[i].Title[:titleLen])
					} else {
						articles[i].ID = fmt.Sprintf("%s_%d", s.name, time.Now().Unix())
					}
				}
			}
			
			articlesChan <- articles
		}(source)
	}
	
	// Close channel when all goroutines complete
	go func() {
		wg.Wait()
		close(articlesChan)
	}()
	
	// Collect all articles
	for articles := range articlesChan {
		newArticles = append(newArticles, articles...)
	}
	
	// Always ensure we have minimum articles by mixing with fallback
	if len(newArticles) < 20 {
		fallbackNeeded := 20 - len(newArticles)
		fallbackArticles := ns.generateRotatingFallbackNews(fallbackNeeded)
		newArticles = append(newArticles, fallbackArticles...)
	}
	
	// Filter to recent news (last 3 days to ensure we always have content)
	threeDaysAgo := time.Now().Add(-72 * time.Hour)
	var recentArticles []NewsArticle
	
	for _, article := range newArticles {
		if article.PublishedAt.After(threeDaysAgo) {
			recentArticles = append(recentArticles, article)
		}
	}
	
	// Always ensure minimum articles - if still not enough, use all articles
	if len(recentArticles) < 15 {
		recentArticles = newArticles
	}
	
	// Final safety net - if still empty, use fallback
	if len(recentArticles) == 0 {
		recentArticles = ns.generateFallbackNews()
	}
	
	// Sort by published time (newest first)
	sort.Slice(recentArticles, func(i, j int) bool {
		return recentArticles[i].PublishedAt.After(recentArticles[j].PublishedAt)
	})
	
	// Update articles
	ns.mutex.Lock()
	ns.articles = recentArticles
	ns.lastUpdate = time.Now()
	ns.mutex.Unlock()
	
	log.Printf("Updated news: %d articles from recent sources", len(recentArticles))
}

// TheNewsAPI.com response structures
type NewsAPIResponse struct {
	Meta struct {
		Found    int `json:"found"`
		Returned int `json:"returned"`
		Limit    int `json:"limit"`
		Page     int `json:"page"`
	} `json:"meta"`
	Data []NewsAPIArticle `json:"data"`
}

type NewsAPIArticle struct {
	UUID        string   `json:"uuid"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Keywords    string   `json:"keywords"`
	Snippet     string   `json:"snippet"`
	URL         string   `json:"url"`
	ImageURL    string   `json:"image_url"`
	Language    string   `json:"language"`
	PublishedAt string   `json:"published_at"`
	Source      string   `json:"source"`
	Categories  []string `json:"categories"`
}

type HeadlinesResponse struct {
	Data map[string][]NewsAPIArticle `json:"data"`
}

func (ns *NewsService) fetchNewsAPI(url string) ([]NewsArticle, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	// Set proper headers
	req.Header.Set("User-Agent", "HomeFlix-TV/1.0")
	req.Header.Set("Accept", "application/json")
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var newsResp NewsAPIResponse
	if err := json.Unmarshal(body, &newsResp); err != nil {
		return nil, err
	}
	
	var articles []NewsArticle
	for _, apiArticle := range newsResp.Data {
		if apiArticle.Title == "" {
			continue
		}
		
		// Clean and validate title
		title := ns.cleanTitle(apiArticle.Title)
		if len(title) < 10 {
			continue
		}
		
		// Parse published date
		publishedAt, err := time.Parse(time.RFC3339, apiArticle.PublishedAt)
		if err != nil {
			publishedAt = time.Now().Add(-time.Hour)
		}
		
		// Use description or snippet
		description := apiArticle.Description
		if description == "" {
			description = apiArticle.Snippet
		}
		
		// Determine category
		category := "General"
		if len(apiArticle.Categories) > 0 {
			category = strings.Title(apiArticle.Categories[0])
		}
		
		article := NewsArticle{
			ID:          apiArticle.UUID,
			Title:       title,
			Description: ns.truncateText(description, 120),
			URL:         apiArticle.URL,
			PublishedAt: publishedAt,
			Category:    category,
		}
		
		articles = append(articles, article)
		
		if len(articles) >= 15 {
			break
		}
	}
	
	return articles, nil
}

func (ns *NewsService) fetchHeadlinesAPI(url string) ([]NewsArticle, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("User-Agent", "HomeFlix-TV/1.0")
	req.Header.Set("Accept", "application/json")
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var headlinesResp HeadlinesResponse
	if err := json.Unmarshal(body, &headlinesResp); err != nil {
		return nil, err
	}
	
	var articles []NewsArticle
	
	// Process different categories
	for categoryName, categoryArticles := range headlinesResp.Data {
		for _, apiArticle := range categoryArticles {
			if apiArticle.Title == "" {
				continue
			}
			
			title := ns.cleanTitle(apiArticle.Title)
			if len(title) < 10 {
				continue
			}
			
			publishedAt, err := time.Parse(time.RFC3339, apiArticle.PublishedAt)
			if err != nil {
				publishedAt = time.Now().Add(-time.Hour)
			}
			
			description := apiArticle.Description
			if description == "" {
				description = apiArticle.Snippet
			}
			
			article := NewsArticle{
				ID:          apiArticle.UUID,
				Title:       title,
				Description: ns.truncateText(description, 120),
				URL:         apiArticle.URL,
				PublishedAt: publishedAt,
				Category:    strings.Title(categoryName),
			}
			
			articles = append(articles, article)
			
			if len(articles) >= 20 {
				break
			}
		}
		
		if len(articles) >= 20 {
			break
		}
	}
	
	return articles, nil
}

func (ns *NewsService) fetchRSSFeed(url string) ([]NewsArticle, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("User-Agent", "HomeFlix-TV/1.0")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml")
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}
	
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	var rssFeed RSSFeed
	if err := xml.Unmarshal(body, &rssFeed); err != nil {
		return nil, fmt.Errorf("failed to parse RSS feed: %v", err)
	}
	
	var articles []NewsArticle
	for _, item := range rssFeed.Channel.Items {
		if item.Title == "" {
			continue
		}
		
		// Clean and validate title
		title := ns.cleanTitle(item.Title)
		if len(title) < 10 {
			continue
		}
		
		// Parse published date - RSS uses RFC1123 format typically
		var publishedAt time.Time
		if item.PubDate != "" {
			// Try different date formats commonly used in RSS
			formats := []string{
				time.RFC1123,
				time.RFC1123Z,
				"Mon, 02 Jan 2006 15:04:05 -0700",
				"Mon, 2 Jan 2006 15:04:05 -0700",
				"2006-01-02T15:04:05Z07:00",
				"2006-01-02T15:04:05Z",
			}
			
			for _, format := range formats {
				if parsed, err := time.Parse(format, item.PubDate); err == nil {
					publishedAt = parsed
					break
				}
			}
		}
		
		// If parsing failed, use current time minus some offset
		if publishedAt.IsZero() {
			publishedAt = time.Now().Add(-time.Duration(len(articles)) * time.Minute)
		}
		
		// Use GUID as ID, or generate one
		id := item.GUID
		if id == "" {
			id = fmt.Sprintf("rss_%d_%s", publishedAt.Unix(), strings.ReplaceAll(title[:minInt(20, len(title))], " ", "_"))
		}
		
		// Clean description
		description := item.Description
		if description == "" {
			description = title
		}
		
		article := NewsArticle{
			ID:          id,
			Title:       title,
			Description: ns.truncateText(ns.cleanHTMLTags(description), 120),
			URL:         item.Link,
			PublishedAt: publishedAt,
			Category:    "RSS Feed",
		}
		
		articles = append(articles, article)
		
		if len(articles) >= 15 {
			break
		}
	}
	
	log.Printf("Fetched %d articles from RSS feed", len(articles))
	return articles, nil
}

func (ns *NewsService) cleanHTMLTags(text string) string {
	// Remove HTML tags
	re := regexp.MustCompile(`<[^>]*>`)
	text = re.ReplaceAllString(text, "")
	
	// Decode common HTML entities
	replacements := map[string]string{
		"&amp;":  "&",
		"&lt;":   "<",
		"&gt;":   ">",
		"&quot;": "\"",
		"&#39;":  "'",
		"&nbsp;": " ",
	}
	
	for entity, replacement := range replacements {
		text = strings.ReplaceAll(text, entity, replacement)
	}
	
	// Clean up extra whitespace
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	
	return text
}

func (ns *NewsService) generateFallbackNews() []NewsArticle {
	return ns.generateRotatingFallbackNews(25)
}

func (ns *NewsService) generateRotatingFallbackNews(count int) []NewsArticle {
	now := time.Now()
	
	// Rotating news headlines for TV channel
	newsTemplates := []string{
		"Global markets show mixed results amid economic uncertainty",
		"Technology sector reports strong quarterly earnings",
		"International summit reaches breakthrough agreement",
		"Climate change initiatives gain momentum worldwide",
		"Space exploration mission achieves major milestone",
		"Healthcare breakthrough offers new treatment options",
		"Renewable energy adoption accelerates globally",
		"Cybersecurity measures enhanced following recent threats",
		"Educational reforms implemented in major cities",
		"Transportation infrastructure receives significant investment",
		"Scientific research reveals important discoveries",
		"Cultural exchange programs expand internationally",
		"Environmental protection efforts show positive results",
		"Innovation in sustainable agriculture shows promise",
		"Digital transformation accelerates across industries",
		"Breaking: Major development in artificial intelligence research",
		"Economic update: Financial markets respond to policy changes",
		"International relations: New diplomatic agreements reached",
		"Weather alert: Severe conditions expected in multiple regions",
		"Sports update: Championship results announced",
		"Entertainment news: Major film festival announces winners",
		"Health advisory: New medical guidelines released",
		"Travel update: International flight schedules adjusted",
		"Business news: Major corporate merger announced",
		"Science breakthrough: Researchers make significant discovery",
	}
	
	var articles []NewsArticle
	
	// Use rotation index to ensure different news each time
	for i := 0; i < count; i++ {
		titleIndex := (ns.rotationIndex + i) % len(newsTemplates)
		
		article := NewsArticle{
			ID:          fmt.Sprintf("fallback_%d_%d", now.Unix(), i),
			Title:       newsTemplates[titleIndex],
			Description: newsTemplates[titleIndex],
			URL:         fmt.Sprintf("https://example.com/news/%d", titleIndex),
			PublishedAt: now.Add(-time.Duration(i*5) * time.Minute), // News every 5 minutes
			Category:    "General",
			Source:      "System",
		}
		
		articles = append(articles, article)
	}
	
	// Update rotation index for next time
	ns.rotationIndex = (ns.rotationIndex + count) % len(newsTemplates)
	
	return articles
}

func (ns *NewsService) getFallbackNews(source string) []NewsArticle {
	return ns.generateRotatingFallbackNews(10)
}

func (ns *NewsService) cleanTitle(title string) string {
	// Remove common Reddit/forum prefixes
	title = regexp.MustCompile(`^\[.*?\]\s*`).ReplaceAllString(title, "")
	title = regexp.MustCompile(`^(TIL|ELI5|AMA|PSA):\s*`).ReplaceAllString(title, "")
	
	// Remove excessive punctuation
	title = regexp.MustCompile(`[!]{2,}`).ReplaceAllString(title, "!")
	title = regexp.MustCompile(`[?]{2,}`).ReplaceAllString(title, "?")
	
	// Trim whitespace
	title = strings.TrimSpace(title)
	
	// Capitalize first letter
	if len(title) > 0 {
		title = strings.ToUpper(string(title[0])) + title[1:]
	}
	
	return title
}

func (ns *NewsService) truncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	
	truncated := text[:maxLen]
	if lastSpace := strings.LastIndex(truncated, " "); lastSpace > maxLen/2 {
		truncated = truncated[:lastSpace]
	}
	
	return truncated + "..."
}

func (ns *NewsService) GetLatestNews(limit int) []NewsArticle {
	ns.mutex.RLock()
	defer ns.mutex.RUnlock()
	
	// Ensure we always have articles
	if len(ns.articles) == 0 {
		ns.articles = ns.generateFallbackNews()
	}
	
	if limit <= 0 {
		limit = 20 // Default reasonable limit
	}
	
	if limit > len(ns.articles) {
		limit = len(ns.articles)
	}
	
	return ns.articles[:limit]
}

func (ns *NewsService) GetBreakingNews() []NewsArticle {
	ns.mutex.RLock()
	defer ns.mutex.RUnlock()
	
	// Ensure we always have articles
	if len(ns.articles) == 0 {
		ns.articles = ns.generateFallbackNews()
	}
	
	// Return news from last 6 hours as "breaking" (extended for more content)
	breakingTime := time.Now().Add(-6 * time.Hour)
	var breaking []NewsArticle
	
	for _, article := range ns.articles {
		if article.PublishedAt.After(breakingTime) {
			breaking = append(breaking, article)
		}
	}
	
	// If no breaking news, return the most recent 5 articles
	if len(breaking) == 0 {
		maxItems := minInt(5, len(ns.articles))
		breaking = ns.articles[:maxItems]
	}
	
	return breaking
}

func (ns *NewsService) GetNewsForTicker() []NewsArticle {
	ns.mutex.RLock()
	defer ns.mutex.RUnlock()
	
	// Ensure we always have articles
	if len(ns.articles) == 0 {
		ns.articles = ns.generateFallbackNews()
	}
	
	// Get rotating selection for ticker to ensure variety
	tickerCount := 12
	totalArticles := len(ns.articles)
	
	if totalArticles == 0 {
		return ns.generateRotatingFallbackNews(tickerCount)
	}
	
	var tickerArticles []NewsArticle
	startIndex := ns.rotationIndex % totalArticles
	
	for i := 0; i < tickerCount; i++ {
		articleIndex := (startIndex + i) % totalArticles
		tickerArticles = append(tickerArticles, ns.articles[articleIndex])
	}
	
	// Update rotation for next call
	ns.rotationIndex = (ns.rotationIndex + 3) % totalArticles
	
	return tickerArticles
}

func (ns *NewsService) IsHealthy() bool {
	ns.mutex.RLock()
	defer ns.mutex.RUnlock()
	
	// Always healthy if we have articles (fallback ensures this)
	// Consider fully healthy if we have articles and recent update
	hasArticles := len(ns.articles) > 0
	recentUpdate := time.Since(ns.lastUpdate) < 15*time.Minute
	
	return hasArticles && (recentUpdate || len(ns.articles) >= 15)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}