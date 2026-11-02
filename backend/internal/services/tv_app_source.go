package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TVAppSource fetches HomeFlix TV app builds from the TV app's GitHub repo,
// where every release commits a signed APK under apk/ (e.g. on branch v5:
// apk/homeflix-tv-v5.apk) and bumps versionCode in app/build.gradle.kts.
//
// Configuration (all optional):
//
//	HOMEFLIX_TV_APP_REPO    owner/name            (default azad25/homeflix-tv-app)
//	HOMEFLIX_TV_APP_BRANCH  branch to follow      (default: the repo's default branch)
//	HOMEFLIX_TV_APP_APK     APK path in the repo  (default: the .apk found in apk/)
type TVAppSource struct {
	Repo    string
	Branch  string
	APKPath string

	APIBase string // https://api.github.com
	RawBase string // https://raw.githubusercontent.com
	Client  *http.Client

	mu        sync.Mutex
	cached    *TVAppRemote
	cachedAt  time.Time
	cachedErr error
}

// TVAppRemote is the newest TV app build in the repo.
type TVAppRemote struct {
	Repo          string `json:"repo"`
	Branch        string `json:"branch"`
	Commit        string `json:"commit,omitempty"`
	CommitMessage string `json:"commit_message,omitempty"`
	CommitDate    string `json:"commit_date,omitempty"`
	APKPath       string `json:"apk_path"`
	Size          int64  `json:"size,omitempty"`
	VersionCode   int64  `json:"version_code"`
	VersionName   string `json:"version_name"`
	DownloadURL   string `json:"download_url"`
}

const defaultTVAppRepo = "azad25/homeflix-tv-app"

var (
	repoNameRe     = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)
	gradleCodeRe   = regexp.MustCompile(`versionCode\s*=\s*(\d+)`)
	gradleNameRe   = regexp.MustCompile(`versionName\s*=\s*"([^"]+)"`)
	errNoRemoteAPK = errors.New("no APK found in the TV app repository")
)

// NewTVAppSource reads the optional HOMEFLIX_TV_APP_* settings.
func NewTVAppSource() *TVAppSource {
	repo := strings.TrimSpace(os.Getenv("HOMEFLIX_TV_APP_REPO"))
	if !repoNameRe.MatchString(repo) {
		repo = defaultTVAppRepo
	}
	return &TVAppSource{
		Repo:    repo,
		Branch:  strings.TrimSpace(os.Getenv("HOMEFLIX_TV_APP_BRANCH")),
		APKPath: strings.Trim(strings.TrimSpace(os.Getenv("HOMEFLIX_TV_APP_APK")), "/"),
		APIBase: "https://api.github.com",
		RawBase: "https://raw.githubusercontent.com",
		Client:  &http.Client{},
	}
}

func (s *TVAppSource) get(ctx context.Context, url string, accept string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "HomeFlix-Server")
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
			return nil, fmt.Errorf("GitHub rate limit reached, try again later (HTTP %d)", resp.StatusCode)
		}
		return nil, fmt.Errorf("GET %s: HTTP %d", url, resp.StatusCode)
	}
	return resp, nil
}

func (s *TVAppSource) getJSON(ctx context.Context, url string, v interface{}) error {
	resp, err := s.get(ctx, url, "application/vnd.github+json")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(v)
}

func (s *TVAppSource) getText(ctx context.Context, url string) (string, error) {
	resp, err := s.get(ctx, url, "")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return string(b), err
}

// Check looks up the newest build in the repo (cached for a minute so the
// settings page can't exhaust GitHub's anonymous rate limit).
func (s *TVAppSource) Check(ctx context.Context, force bool) (*TVAppRemote, error) {
	s.mu.Lock()
	if !force && time.Since(s.cachedAt) < time.Minute && (s.cached != nil || s.cachedErr != nil) {
		r, err := s.cached, s.cachedErr
		s.mu.Unlock()
		return r, err
	}
	s.mu.Unlock()

	r, err := s.check(ctx)
	s.mu.Lock()
	s.cached, s.cachedErr, s.cachedAt = r, err, time.Now()
	s.mu.Unlock()
	return r, err
}

func (s *TVAppSource) check(ctx context.Context) (*TVAppRemote, error) {
	r := &TVAppRemote{Repo: s.Repo, Branch: s.Branch}
	api := strings.TrimRight(s.APIBase, "/") + "/repos/" + s.Repo

	// The GitHub API (60 anonymous requests/hour) gives the branch head and
	// the APK's exact path. Without it, raw files still work: "HEAD" is the
	// default branch and the APK name follows the version.
	apiOK := true
	if r.Branch == "" {
		var repo struct {
			DefaultBranch string `json:"default_branch"`
		}
		if err := s.getJSON(ctx, api, &repo); err != nil || repo.DefaultBranch == "" {
			apiOK = false
		} else {
			r.Branch = repo.DefaultBranch
		}
	}

	// Pin everything to the branch head commit: raw.githubusercontent caches
	// branch URLs for minutes, a commit URL is always consistent.
	ref := r.Branch
	if ref == "" {
		ref = "HEAD"
	}
	if apiOK {
		var head struct {
			SHA    string `json:"sha"`
			Commit struct {
				Message   string `json:"message"`
				Committer struct {
					Date string `json:"date"`
				} `json:"committer"`
			} `json:"commit"`
		}
		if err := s.getJSON(ctx, api+"/commits/"+escapeRef(ref), &head); err == nil && head.SHA != "" {
			ref = head.SHA
			r.Commit = head.SHA
			r.CommitMessage = strings.TrimSpace(strings.SplitN(head.Commit.Message, "\n", 2)[0])
			r.CommitDate = head.Commit.Committer.Date
		} else {
			apiOK = false
		}
	}

	raw := strings.TrimRight(s.RawBase, "/") + "/" + s.Repo + "/" + ref + "/"
	gradle, gradleErr := s.getText(ctx, raw+"app/build.gradle.kts")
	if gradleErr == nil {
		if m := gradleCodeRe.FindStringSubmatch(gradle); m != nil {
			r.VersionCode, _ = strconv.ParseInt(m[1], 10, 64)
		}
		if m := gradleNameRe.FindStringSubmatch(gradle); m != nil {
			r.VersionName = m[1]
		}
	}

	r.APKPath = s.APKPath
	if r.APKPath == "" && apiOK {
		var files []struct {
			Name string `json:"name"`
			Path string `json:"path"`
			Type string `json:"type"`
			Size int64  `json:"size"`
		}
		if err := s.getJSON(ctx, api+"/contents/apk?ref="+escapeRef(ref), &files); err == nil {
			for _, f := range files {
				if f.Type == "file" && strings.EqualFold(path.Ext(f.Name), ".apk") {
					r.APKPath, r.Size = f.Path, f.Size
					break
				}
			}
			if r.APKPath == "" {
				return nil, errNoRemoteAPK
			}
		}
	}
	if r.APKPath == "" {
		// apk/homeflix-tv-v<major>.apk, the repo's naming convention
		major := strings.SplitN(r.VersionName, ".", 2)[0]
		if major == "" {
			if gradleErr != nil {
				return nil, fmt.Errorf("can't reach the TV app repository: %w", gradleErr)
			}
			return nil, errNoRemoteAPK
		}
		r.APKPath = "apk/homeflix-tv-v" + major + ".apk"
	}
	if r.Branch == "" {
		r.Branch = "default branch"
	}
	r.DownloadURL = raw + r.APKPath
	return r, nil
}

func escapeRef(ref string) string {
	// Branch names like release/v5 keep their slash in GitHub API paths.
	return strings.ReplaceAll(ref, " ", "%20")
}

// TVAppFetchResult is returned by FetchLatest.
type TVAppFetchResult struct {
	Release *TVAppRelease `json:"release"`
	Updated bool          `json:"updated"`
	Message string        `json:"message"`
}

// FetchLatest downloads the repo's newest APK and publishes it when it is
// newer than what the server has (connected TVs are told to update).
func (u *TVAppUpdates) FetchLatest(ctx context.Context, src *TVAppSource) (*TVAppFetchResult, error) {
	remote, err := src.Check(ctx, true)
	if err != nil {
		return nil, err
	}
	if cur := u.Latest(); cur != nil && remote.VersionCode > 0 && remote.VersionCode <= cur.VersionCode {
		return &TVAppFetchResult{Release: cur, Message: fmt.Sprintf("The server already has the newest TV app (%s)", cur.VersionName)}, nil
	}

	resp, err := src.get(ctx, remote.DownloadURL, "application/octet-stream")
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if err := os.MkdirAll(u.Dir, 0o755); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp(u.Dir, ".github-*.tmp")
	if err != nil {
		return nil, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	n, err := io.Copy(tmp, io.LimitReader(resp.Body, 512<<20))
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	if remote.Size > 0 && n != remote.Size {
		return nil, fmt.Errorf("download incomplete (%d of %d bytes)", n, remote.Size)
	}

	// The APK itself is the source of truth (gradle may be bumped before the
	// APK is rebuilt): never republish an older or equal build.
	info, err := ReadAPKInfo(tmpPath)
	if err != nil || info.Package != TVAppPackage {
		return nil, ErrNotTVApp
	}
	if cur := u.Latest(); cur != nil && info.VersionCode <= cur.VersionCode {
		return &TVAppFetchResult{Release: cur, Message: fmt.Sprintf("The repository's APK (%s) isn't newer than the server's (%s)", info.VersionName, cur.VersionName)}, nil
	}

	f, err := os.Open(tmpPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	rel, err := u.Publish(f, remote.CommitMessage)
	if err != nil {
		return nil, err
	}
	return &TVAppFetchResult{Release: rel, Updated: true, Message: fmt.Sprintf("Published TV app %s - connected TVs were told to update", rel.VersionName)}, nil
}
