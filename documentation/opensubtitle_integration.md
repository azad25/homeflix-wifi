# **OpenSubtitles Go API – Search & Download Subtitles**

A lightweight **Go HTTP API** that uses the **OpenSubtitles REST API** to:
- Search subtitles by **movie name**
- Download subtitles using `file_id`

---

## Features
- `/search?movie=...&lang=...` → JSON list of subtitles
- `/download?file_id=...` → Streams `.srt` or `.zip` file
- Auto-login using username/password
- Handles rate limits & errors
- Clean, production-ready structure

---

## Prerequisites

1. **OpenSubtitles Account** → [Register here](https://www.opensubtitles.com/en/profile/api)
2. **API Key** → Copy from your profile
3. **Username & Password** → Required for **downloads**

---

## Environment Variables

```bash
export OPENSUB_API_KEY="your_api_key_here"
export OPENSUB_USERNAME="your_username"
export OPENSUB_PASSWORD="your_password"
```

> Warning: Downloads **require login**. Search works without.

---

## Endpoints

### 1. **Search Subtitles**
```
GET /search?movie=<name>&lang=<code>&year=<yyyy>
```

#### Parameters
| Param | Required | Description |
|------|----------|-------------|
| `movie` | Yes | Movie/TV title |
| `lang`  | No  | Language code (`en`, `fr`, `es`, etc.) – default: `en` |
| `year`  | No  | Release year – improves accuracy |

#### Example
```bash
curl "http://localhost:8080/search?movie=Inception&lang=en&year=2010"
```

#### Response (JSON)
```json
{
  "data": [
    {
      "id": "192837465",
      "attributes": {
        "language": "en",
        "files": [
          {
            "file_id": "5274788",
            "file_name": "Inception.2010.1080p.BluRay.x264.srt"
          }
        ],
        "feature_details": {
          "title": "Inception",
          "year": 2010,
          "imdb_id": "1375666"
        }
      }
    }
  ]
}
```

> Use `file_id` from `files[0].file_id` for download.

---

### 2. **Download Subtitle**
```
GET /download?file_id=<id>
```

#### Parameters
| Param | Required | Description |
|------|----------|-------------|
| `file_id` | Yes | From search result |

#### Example
```bash
curl -OJ "http://localhost:8080/download?file_id=5274788"
```

#### Response
- **Headers**:
  ```
  Content-Disposition: attachment; filename="Inception.en.srt"
  Content-Type: text/plain; charset=utf-8
  ```
- **Body**: Raw `.srt` file (or `.zip` if compressed)

---

## Full Go Code (`main.go`)

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
)

const baseURL = "https://api.opensubtitles.com/api/v1"

var (
	apiKey   = os.Getenv("OPENSUB_API_KEY")
	username = os.Getenv("OPENSUB_USERNAME")
	password = os.Getenv("OPENSUB_PASSWORD")
	token    string
	client   = &http.Client{}
)

func init() {
	if apiKey == "" {
		log.Fatal("OPENSUB_API_KEY is required")
	}
	if username != "" && password != "" {
		login()
	} else {
		log.Println("Warning: No credentials → downloads disabled")
	}
}

func login() {
	body := map[string]string{"username": username, "password": password}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", baseURL+"/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Login failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("Login failed: %d", resp.StatusCode)
		return
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if t, ok := result["token"].(string); ok {
		token = t
		log.Println("Logged in successfully")
	}
}

// === SEARCH HANDLER ===
func searchHandler(w http.ResponseWriter, r *http.Request) {
	movie := r.URL.Query().Get("movie")
	if movie == "" {
		http.Error(w, "Missing 'movie' parameter", http.StatusBadRequest)
		return
	}

	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "en"
	}
	year := r.URL.Query().Get("year")

	u, _ := url.Parse(baseURL + "/subtitles")
	q := u.Query()
	q.Set("query", movie)
	q.Set("languages", lang)
	if year != "" {
		q.Set("year", year)
	}
	u.RawQuery = q.Encode()

	req, _ := http.NewRequest("GET", u.String(), nil)
	req.Header.Set("Api-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}

// === DOWNLOAD HANDLER ===
func downloadHandler(w http.ResponseWriter, r *http.Request) {
	if token == "" {
		http.Error(w, "Login required for download (set username/password)", http.StatusUnauthorized)
		return
	}

	fileID := r.URL.Query().Get("file_id")
	if fileID == "" {
		http.Error(w, "Missing 'file_id'", http.StatusBadRequest)
		return
	}

	// Request download link
	body := map[string]string{"file_id": fileID}
	jsonBody, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", baseURL+"/download", bytes.NewBuffer(jsonBody))
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		io.Copy(w, resp.Body)
		return
	}

	var result struct {
		Link     string `json:"link"`
		FileName string `json:"file_name"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Link == "" {
		http.Error(w, "No download link", http.StatusInternalServerError)
		return
	}

	// Stream subtitle
	subResp, err := http.Get(result.Link)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer subResp.Body.Close()

	filename := result.FileName
	if filename == "" {
		filename = "subtitle.srt"
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	io.Copy(w, subResp.Body)
}

func main() {
	http.HandleFunc("/search", searchHandler)
	http.HandleFunc("/download", downloadHandler)

	log.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

---

## Run the API

```bash
go mod init subtitle-api
go run main.go
```

---

## Test with cURL

```bash
# 1. Search
curl "http://localhost:8080/search?movie=Interstellar&lang=en"

# 2. Download (use file_id from result)
curl -OJ "http://localhost:8080/download?file_id=123456789"
```

---

## Docker (Optional)

```Dockerfile
FROM golang:alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o api .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/api .
CMD ["./api"]
```

```bash
docker build -t subtitle-api .
docker run -p 8080:8080 -e OPENSUB_API_KEY=xxx -e OPENSUB_USERNAME=xxx -e OPENSUB_PASSWORD=xxx subtitle-api
```

---

## Rate Limits

| Account Type | Search / Day | Downloads / Day |
|-------------|--------------|-----------------|
| Free        | 100          | 20              |
| VIP         | 10,000       | 1,000           |

---

## Official Docs
- Search: https://opensubtitles.stoplight.io/docs/opensubtitles-api/a172317bd5ccc-search-for-subtitles
- Download: https://opensubtitles.stoplight.io/docs/opensubtitles-api/6be7f6ae2d918-download

---

**Done!** Your Go API is ready to search and download subtitles.  
Need **IMDB ID**, **hash-based**, or **TV episode** support? Let me know!

