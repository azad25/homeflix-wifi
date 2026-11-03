package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Community board: feature requests, issues and shared titles are GitHub
// Issues on the HomeFlix repository; votes are 👍 reactions. Every HomeFlix
// server reads the same public list (cached), so everyone sees the same
// board. Closed issues show as "Shipped" for 60 days; a release closes the
// issues its notes mention (.github/workflows/close-released-issues.yml).

const communityRepo = "azad25/homeflix-wifi"

type CommunityPost struct {
	Number    int       `json:"number"`
	Kind      string    `json:"kind"` // feature | issue | share | other
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	URL       string    `json:"url"`
	Author    string    `json:"author"`
	Avatar    string    `json:"avatar"`
	Votes     int       `json:"votes"`
	Comments  int       `json:"comments"`
	CreatedAt time.Time `json:"created_at"`
	ClosedAt  time.Time `json:"closed_at,omitempty"`
}

type CommunityBoard struct {
	Repo     string          `json:"repo"`
	Open     []CommunityPost `json:"open"`
	Shipped  []CommunityPost `json:"shipped"`
	Members  int             `json:"members"` // distinct people who posted
	Stars    int             `json:"stars"`
	Updated  time.Time       `json:"updated"`
	NewIssue string          `json:"new_issue"` // base URL for posting
	Error    string          `json:"error,omitempty"`
}

var community struct {
	mu    sync.Mutex
	board *CommunityBoard
	at    time.Time
}

type ghIssue struct {
	Number      int       `json:"number"`
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	HTMLURL     string    `json:"html_url"`
	Comments    int       `json:"comments"`
	CreatedAt   time.Time `json:"created_at"`
	ClosedAt    time.Time `json:"closed_at"`
	StateReason string    `json:"state_reason"`
	PullRequest *struct{} `json:"pull_request"`
	User        struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	} `json:"user"`
	Labels []struct {
		Name string `json:"name"`
	} `json:"labels"`
	Reactions struct {
		PlusOne int `json:"+1"`
	} `json:"reactions"`
}

func ghGet(url string, out interface{}) error {
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "HomeFlix-Server")
	if tok := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok) // optional: higher rate limit
	}
	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GitHub returned %s", resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func postKind(is ghIssue) string {
	for _, l := range is.Labels {
		switch strings.ToLower(l.Name) {
		case "feature", "enhancement", "feature request":
			return "feature"
		case "bug", "issue":
			return "issue"
		case "share", "recommendation":
			return "share"
		}
	}
	t := strings.ToLower(is.Title)
	switch {
	case strings.HasPrefix(t, "[feature]"):
		return "feature"
	case strings.HasPrefix(t, "[bug]"), strings.HasPrefix(t, "[issue]"):
		return "issue"
	case strings.HasPrefix(t, "[share]"):
		return "share"
	}
	return "other"
}

func toPost(is ghIssue) CommunityPost {
	title := is.Title
	for _, p := range []string{"[Feature]", "[Bug]", "[Issue]", "[Share]", "[feature]", "[bug]", "[issue]", "[share]"} {
		title = strings.TrimSpace(strings.TrimPrefix(title, p))
	}
	body := is.Body
	if len(body) > 400 {
		body = body[:400] + "…"
	}
	return CommunityPost{
		Number: is.Number, Kind: postKind(is), Title: title, Body: body, URL: is.HTMLURL,
		Author: is.User.Login, Avatar: is.User.AvatarURL, Votes: is.Reactions.PlusOne,
		Comments: is.Comments, CreatedAt: is.CreatedAt, ClosedAt: is.ClosedAt,
	}
}

func loadCommunity() *CommunityBoard {
	base := "https://api.github.com/repos/" + communityRepo
	b := &CommunityBoard{Repo: communityRepo, Open: []CommunityPost{}, Shipped: []CommunityPost{}, Updated: time.Now(),
		NewIssue: "https://github.com/" + communityRepo + "/issues/new"}
	people := map[string]bool{}

	var open []ghIssue
	if err := ghGet(base+"/issues?state=open&per_page=100", &open); err != nil {
		b.Error = err.Error()
		return b
	}
	for _, is := range open {
		if is.PullRequest != nil {
			continue
		}
		people[is.User.Login] = true
		b.Open = append(b.Open, toPost(is))
	}
	sort.SliceStable(b.Open, func(i, j int) bool {
		if b.Open[i].Votes != b.Open[j].Votes {
			return b.Open[i].Votes > b.Open[j].Votes
		}
		return b.Open[i].CreatedAt.After(b.Open[j].CreatedAt)
	})

	since := time.Now().AddDate(0, 0, -60).UTC().Format(time.RFC3339)
	var closed []ghIssue
	if ghGet(base+"/issues?state=closed&per_page=50&sort=updated&since="+since, &closed) == nil {
		for _, is := range closed {
			if is.PullRequest != nil || is.StateReason == "not_planned" || is.StateReason == "duplicate" {
				continue
			}
			people[is.User.Login] = true
			b.Shipped = append(b.Shipped, toPost(is))
		}
		sort.SliceStable(b.Shipped, func(i, j int) bool { return b.Shipped[i].ClosedAt.After(b.Shipped[j].ClosedAt) })
	}

	var repo struct {
		Stars int `json:"stargazers_count"`
	}
	if ghGet(base, &repo) == nil {
		b.Stars = repo.Stars
	}
	b.Members = len(people)
	return b
}

// GetCommunity — GET /api/community (?refresh=1 bypasses the 10-minute cache)
func GetCommunity() gin.HandlerFunc {
	return func(c *gin.Context) {
		community.mu.Lock()
		defer community.mu.Unlock()
		fresh := community.board != nil && time.Since(community.at) < 10*time.Minute
		if !fresh || (c.Query("refresh") == "1" && time.Since(community.at) > time.Minute) {
			b := loadCommunity()
			if b.Error == "" || community.board == nil {
				community.board, community.at = b, time.Now()
			} else {
				community.board.Error = b.Error // keep showing the last good board
			}
		}
		c.Header("Cache-Control", "private, max-age=60")
		c.JSON(http.StatusOK, community.board)
	}
}
