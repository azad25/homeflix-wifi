package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"homeflix-backend/internal/models"
)

func newTasteTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Genre{}, &models.Series{}, &models.Season{}, &models.Media{}, &models.PlaybackProgress{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func movie(db *gorm.DB, t *testing.T, title string, year int, director string, cast []string, genres []string, collection string, rating float64) models.Media {
	t.Helper()
	m := models.Media{
		UUID: title, Title: title, Type: "movie", Year: year, Director: []string{director}, Stars: cast,
		GenreNames: genres, Collection: collection, Rating: rating, Language: "en", FilePath: "/m/" + title,
	}
	if err := db.Create(&m).Error; err != nil {
		t.Fatal(err)
	}
	return m
}

func watch(db *gorm.DB, t *testing.T, m models.Media, progress float64, ago time.Duration) {
	t.Helper()
	p := models.PlaybackProgress{UserID: "1", MediaID: m.ID, Progress: progress, Completed: progress >= 95, LastWatched: time.Now().Add(-ago)}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
}

func rowByKind(res *TasteResult, kind string) *TasteRow {
	for i := range res.Rows {
		if res.Rows[i].Kind == kind {
			return &res.Rows[i]
		}
	}
	return nil
}

func titles(items []TasteItem) []string {
	out := []string{}
	for _, it := range items {
		out = append(out, it.Title)
	}
	return out
}

func TestTasteLearnsDirectorCastAndFranchise(t *testing.T) {
	db := newTasteTestDB(t)
	nolan := []string{"Christian Bale", "Michael Caine"}
	d1 := movie(db, t, "Dark Knight", 2008, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "The Dark Knight Collection", 9)
	movie(db, t, "Dark Knight Rises", 2012, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "The Dark Knight Collection", 8)
	movie(db, t, "Prestige", 2006, "Christopher Nolan", []string{"Christian Bale", "Hugh Jackman"}, []string{"Drama", "Mystery"}, "", 8.5)
	movie(db, t, "Inception", 2010, "Christopher Nolan", []string{"Leonardo DiCaprio", "Michael Caine"}, []string{"Action", "Sci-Fi"}, "", 8.8)
	// Popular but unrelated titles must not outrank taste matches.
	for i := 0; i < 8; i++ {
		movie(db, t, fmt.Sprintf("Romcom %d", i), 2015, "Someone Else", []string{fmt.Sprintf("Actor %d", i)}, []string{"Romance", "Comedy"}, "", 9.5)
	}
	watch(db, t, d1, 100, 2*24*time.Hour)

	res, err := NewTasteService(db).Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Personalized {
		t.Fatalf("expected personalized result, got fallback: %+v", res)
	}
	top := rowByKind(res, "top-picks")
	if top == nil || len(top.Items) < 3 {
		t.Fatalf("missing top picks: %+v", res.Rows)
	}
	for i := 0; i < 3; i++ {
		if strings.HasPrefix(top.Items[i].Title, "Romcom") {
			t.Fatalf("unrelated title ranked in top 3: %v", titles(top.Items))
		}
	}
	for _, it := range top.Items {
		if it.Title == "Dark Knight" {
			t.Fatalf("already-watched title recommended: %v", titles(top.Items))
		}
		if it.Reason == "" && !strings.HasPrefix(it.Title, "Romcom") {
			t.Errorf("missing reason for %s", it.Title)
		}
	}
	col := rowByKind(res, "collection")
	if col == nil || col.Items[0].Title != "Dark Knight Rises" {
		t.Fatalf("expected franchise continuation row, got %+v", col)
	}
	if rowByKind(res, "because") == nil {
		t.Errorf("expected a 'Because You Watched' row: %+v", res.Rows)
	}
	if rowByKind(res, "director") == nil && rowByKind(res, "actor") == nil {
		t.Errorf("expected a people row (director/actor): %+v", res.Rows)
	}
}

func TestTasteAbandonedTitlesCountAgainst(t *testing.T) {
	db := newTasteTestDB(t)
	liked := movie(db, t, "Space Opera", 2019, "Dir A", []string{"Star A"}, []string{"Sci-Fi"}, "", 7)
	movie(db, t, "Space Opera 2", 2021, "Dir A", []string{"Star A"}, []string{"Sci-Fi"}, "", 7)
	hated := movie(db, t, "Slasher", 2019, "Dir H", []string{"Star H"}, []string{"Horror"}, "", 7)
	movie(db, t, "Slasher Returns", 2021, "Dir H", []string{"Star H"}, []string{"Horror"}, "", 9)
	watch(db, t, liked, 100, 24*time.Hour)
	watch(db, t, hated, 3, 10*24*time.Hour) // abandoned after a few minutes

	res, err := NewTasteService(db).Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	top := rowByKind(res, "top-picks")
	if top == nil || top.Items[0].Title != "Space Opera 2" {
		t.Fatalf("expected liked sequel first, got %+v", top)
	}
	for _, it := range top.Items {
		if it.Title == "Slasher" {
			t.Fatalf("abandoned title should not be recommended again: %v", titles(top.Items))
		}
	}
}

func TestTasteFallbackWithoutHistory(t *testing.T) {
	db := newTasteTestDB(t)
	movie(db, t, "A", 2020, "D", []string{"S"}, []string{"Drama"}, "", 6)
	movie(db, t, "B", 2021, "D2", []string{"S2"}, []string{"Drama"}, "", 9)
	res, err := NewTasteService(db).Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if res.Personalized || len(res.Rows) == 0 || res.Rows[0].Items[0].Title != "B" {
		t.Fatalf("unexpected fallback: %+v", res)
	}
}

func TestTasteHouseholdFallbackAndSeriesRollup(t *testing.T) {
	db := newTasteTestDB(t)
	s1 := models.Series{UUID: "s1", Title: "Crime Show", GenreNames: []string{"Crime", "Drama"}, Network: "HBO"}
	s2 := models.Series{UUID: "s2", Title: "Other Crime Show", GenreNames: []string{"Crime", "Drama"}, Network: "HBO"}
	s3 := models.Series{UUID: "s3", Title: "Kids Show", GenreNames: []string{"Kids"}, Network: "Cartoon"}
	for _, s := range []*models.Series{&s1, &s2, &s3} {
		if err := db.Create(s).Error; err != nil {
			t.Fatal(err)
		}
	}
	for i := 1; i <= 4; i++ {
		ep := models.Media{UUID: fmt.Sprintf("e%d", i), Title: fmt.Sprintf("Ep %d", i), Type: "episode", SeriesID: &s1.ID, Stars: []string{"Lead Actor"}, FilePath: fmt.Sprintf("/tv/e%d", i)}
		if err := db.Create(&ep).Error; err != nil {
			t.Fatal(err)
		}
		// Recorded under another user id: household fallback must pick it up.
		db.Create(&models.PlaybackProgress{UserID: "anonymous", MediaID: ep.ID, Progress: 100, Completed: true, LastWatched: time.Now()})
	}
	other := models.Media{UUID: "o1", Title: "Other Ep", Type: "episode", SeriesID: &s2.ID, Stars: []string{"Lead Actor"}, FilePath: "/tv/o1"}
	db.Create(&other)

	res, err := NewTasteService(db).Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	top := rowByKind(res, "top-picks")
	if top == nil || top.Items[0].Title != "Other Crime Show" || top.Items[0].Type != "series" {
		t.Fatalf("expected series-level recommendation from household history, got %+v", res.Rows)
	}
	for _, it := range top.Items {
		if it.Title == "Crime Show" {
			t.Fatalf("watched series recommended again")
		}
	}

	sim, err := NewTasteService(db).Similar("series", s1.ID, 5)
	if err != nil || len(sim) == 0 || sim[0].Title != "Other Crime Show" {
		t.Fatalf("more-like-this failed: %v %+v", err, sim)
	}
}
