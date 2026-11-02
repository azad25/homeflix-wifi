package services

import (
	"fmt"
	"testing"
	"time"

	"homeflix-backend/internal/models"
)

func chartTitles(res *ChartResult) []string {
	var out []string
	for _, it := range res.Items {
		out = append(out, it.Title)
	}
	return out
}

func TestTop10RanksRecentPlays_rollsUpEpisodes_fillsFromCatalog(t *testing.T) {
	db := newTasteTestDB(t)
	svc := NewTasteService(db)
	now := time.Now()
	a := movie(db, t, "Watched Twice", 2020, "A", []string{"X"}, []string{"Drama"}, "", 6)
	b := movie(db, t, "Sampled", 2020, "B", []string{"Y"}, []string{"Drama"}, "", 6)
	old := movie(db, t, "Old Favourite", 2020, "C", []string{"Z"}, []string{"Drama"}, "", 6)
	for i := 0; i < 12; i++ {
		movie(db, t, fmt.Sprintf("Catalog %02d", i), 2020, "D", []string{"W"}, []string{"Drama"}, "", 5+float64(i)/4)
	}
	show := models.Series{UUID: "show", Title: "Binge Show", Year: 2024}
	if err := db.Create(&show).Error; err != nil {
		t.Fatal(err)
	}
	var eps []models.Media
	for i := 1; i <= 4; i++ {
		ep := models.Media{UUID: fmt.Sprintf("ep%d", i), Title: fmt.Sprintf("Ep %d", i), Type: "episode", SeriesID: &show.ID, FilePath: fmt.Sprintf("/e/%d", i)}
		if err := db.Create(&ep).Error; err != nil {
			t.Fatal(err)
		}
		eps = append(eps, ep)
	}
	play := func(user string, m models.Media, progress float64, ago time.Duration) {
		p := models.PlaybackProgress{UserID: user, MediaID: m.ID, Progress: progress, Completed: progress >= 95, LastWatched: now.Add(-ago)}
		if err := db.Create(&p).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, ep := range eps {
		play("1", ep, 100, 10*time.Hour) // binged a whole show yesterday
	}
	play("1", a, 100, 2*time.Hour)
	play("2", a, 90, 30*time.Hour)
	play("1", b, 3, time.Hour)
	play("1", old, 100, 200*24*time.Hour) // outside the 7- and 30-day windows

	all, err := svc.Chart("all", 10, now)
	if err != nil {
		t.Fatal(err)
	}
	got := chartTitles(all)
	// Two viewers outrank one binge; this week's plays outrank an old favourite.
	if len(got) != 10 || got[0] != "Watched Twice" || got[1] != "Binge Show" || got[2] != "Sampled" || got[3] != "Old Favourite" {
		t.Fatalf("chart = %v", got)
	}
	if all.Items[0].Rank != 1 || all.Items[9].Rank != 10 {
		t.Fatal("ranks not set")
	}
	if all.Source != "mixed" {
		t.Fatalf("source = %s", all.Source)
	}
	for _, it := range all.Items {
		if it.Type == "movie" && it.Title == "Ep 1" {
			t.Fatal("episodes must roll up into their show")
		}
	}

	movies, _ := svc.Chart("movie", 10, now)
	for _, it := range movies.Items {
		if it.Type != "movie" {
			t.Fatalf("movie chart has %s %q", it.Type, it.Title)
		}
	}
	if chartTitles(movies)[0] != "Watched Twice" {
		t.Fatalf("movie chart = %v", chartTitles(movies))
	}
	shows, _ := svc.Chart("series", 10, now)
	if len(shows.Items) != 1 || shows.Items[0].Title != "Binge Show" {
		t.Fatalf("show chart = %v", chartTitles(shows))
	}
}

func TestForYouUniqueAndKind(t *testing.T) {
	db := newTasteTestDB(t)
	svc := NewTasteService(db)
	nolan := []string{"Christian Bale", "Michael Caine"}
	d1 := movie(db, t, "Dark Knight", 2008, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "The Dark Knight Collection", 9)
	movie(db, t, "Dark Knight Rises", 2012, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "The Dark Knight Collection", 8)
	movie(db, t, "Prestige", 2006, "Christopher Nolan", []string{"Christian Bale", "Hugh Jackman"}, []string{"Drama", "Mystery"}, "", 8.5)
	movie(db, t, "Inception", 2010, "Christopher Nolan", []string{"Leonardo DiCaprio", "Michael Caine"}, []string{"Action", "Sci-Fi"}, "", 8.8)
	for i := 0; i < 8; i++ {
		movie(db, t, fmt.Sprintf("Action %d", i), 2015, "Someone", []string{"Christian Bale"}, []string{"Action"}, "", 7)
	}
	if err := db.Create(&models.Series{UUID: "s", Title: "Action Show", GenreNames: []string{"Action", "Drama"}}).Error; err != nil {
		t.Fatal(err)
	}
	watch(db, t, d1, 100, 24*time.Hour)

	res, err := svc.RecommendWith("1", RecommendOptions{PerRow: 10, Unique: true})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]string{}
	for _, r := range res.Rows {
		for _, it := range r.Items {
			k := it.Type + it.Title
			if prev, ok := seen[k]; ok {
				t.Fatalf("%q is in %q and %q", it.Title, prev, r.Title)
			}
			seen[k] = r.Title
		}
	}
	if len(res.Rows) < 2 {
		t.Fatalf("too few rows: %v", res.Rows)
	}

	movies, _ := svc.RecommendWith("1", RecommendOptions{PerRow: 10, Kind: "movie"})
	for _, r := range movies.Rows {
		for _, it := range r.Items {
			if it.Type != "movie" {
				t.Fatalf("kind=movie returned %s %q in %q", it.Type, it.Title, r.Title)
			}
		}
	}
	shows, _ := svc.RecommendWith("1", RecommendOptions{PerRow: 10, Kind: "series"})
	for _, r := range shows.Rows {
		for _, it := range r.Items {
			if it.Type != "series" {
				t.Fatalf("kind=series returned %s %q", it.Type, it.Title)
			}
		}
	}
}

func TestNewForYouRow(t *testing.T) {
	db := newTasteTestDB(t)
	svc := NewTasteService(db)
	nolan := []string{"Christian Bale", "Michael Caine"}
	d1 := movie(db, t, "Dark Knight", 2008, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "", 9)
	fresh := []string{"Tenet", "Oppenheimer", "Interstellar"}
	for _, title := range fresh {
		movie(db, t, title, 2020, "Christopher Nolan", []string{"Michael Caine"}, []string{"Drama"}, "", 8)
	}
	older := movie(db, t, "Memento", 2000, "Christopher Nolan", []string{"Guy Pearce"}, []string{"Mystery"}, "", 8.4)
	db.Model(&older).Update("created_at", time.Now().Add(-200*24*time.Hour))
	watch(db, t, d1, 100, 24*time.Hour)
	res, err := svc.RecommendWith("1", RecommendOptions{PerRow: 10})
	if err != nil {
		t.Fatal(err)
	}
	row := rowByKind(res, "new-for-you")
	if row == nil {
		t.Fatalf("no New for You row: %v", res.Rows)
	}
	for _, it := range row.Items {
		if it.Title == "Memento" {
			t.Fatal("New for You should only hold recent additions")
		}
	}
}
