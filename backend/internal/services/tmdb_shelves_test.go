package services

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestShelfAndTrailer(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		switch r.URL.Path {
		case "/trending/all/week":
			fmt.Fprint(w, `{"results":[
				{"id":1,"media_type":"movie","title":"Heat","backdrop_path":"/h.jpg","release_date":"1995-12-15","vote_average":8.3},
				{"id":2,"media_type":"tv","name":"Severance","backdrop_path":"/s.jpg","first_air_date":"2022-02-18"},
				{"id":3,"media_type":"person","name":"Someone"},
				{"id":4,"media_type":"movie","title":"No Art"}]}`)
		case "/movie/1/videos":
			fmt.Fprint(w, `{"results":[
				{"key":"teaser1","site":"YouTube","type":"Teaser","official":true},
				{"key":"fan","site":"YouTube","type":"Trailer","official":false},
				{"key":"official","site":"YouTube","type":"Trailer","official":true},
				{"key":"vimeo","site":"Vimeo","type":"Trailer","official":true}]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	shelfCache.Range(func(k, _ interface{}) bool { shelfCache.Delete(k); return true })
	tm := &TMDBService{apiKey: "k", baseURL: srv.URL, httpClient: srv.Client()}

	items, title, err := tm.Shelf("trending", 1)
	if err != nil || title != "Trending This Week" || len(items) != 2 || items[1].Title != "Severance" || items[1].MediaType != "tv" || items[1].Date != "2022-02-18" {
		t.Fatalf("shelf %v %q %+v", err, title, items)
	}
	tm.Shelf("trending", 1)
	if calls != 1 {
		t.Fatalf("shelf not cached (%d calls)", calls)
	}
	if key, err := tm.Trailer("movie", 1); err != nil || key != "official" {
		t.Fatalf("trailer %q %v", key, err)
	}
	if _, _, err := tm.Shelf("nope", 1); err == nil {
		t.Fatal("unknown shelf accepted")
	}
}
