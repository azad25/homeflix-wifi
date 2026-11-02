package services

import (
	"fmt"
	"strings"
	"testing"

	"homeflix-backend/internal/models"
)

func ratingsDB(t *testing.T) *TasteService {
	t.Helper()
	db := newTasteTestDB(t)
	if err := db.AutoMigrate(&models.TasteRating{}, &models.MyListItem{}); err != nil {
		t.Fatal(err)
	}
	return NewTasteService(db)
}

func hasTitle(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func allTitles(res *TasteResult) []string {
	var out []string
	for _, r := range res.Rows {
		out = append(out, titles(r.Items)...)
	}
	return out
}

func TestLikeWithoutHistoryPersonalises(t *testing.T) {
	svc := ratingsDB(t)
	db := svc.db
	nolan := []string{"Christian Bale", "Michael Caine"}
	liked := movie(db, t, "Dark Knight", 2008, "Christopher Nolan", nolan, []string{"Action", "Drama"}, "", 9)
	movie(db, t, "Prestige", 2006, "Christopher Nolan", []string{"Christian Bale", "Hugh Jackman"}, []string{"Drama", "Mystery"}, "", 8.5)
	movie(db, t, "Inception", 2010, "Christopher Nolan", []string{"Leonardo DiCaprio", "Michael Caine"}, []string{"Action", "Sci-Fi"}, "", 8.4)
	for i := 0; i < 8; i++ {
		movie(db, t, fmt.Sprintf("Romcom %d", i), 2015, "Someone Else", []string{fmt.Sprintf("Actor %d", i)}, []string{"Romance", "Comedy"}, "", 9.5)
	}
	if err := svc.SetRating("1", "movie", liked.ID, 1); err != nil {
		t.Fatal(err)
	}
	if got := svc.Rating("1", "movie", liked.ID); got != 1 {
		t.Fatalf("rating = %d", got)
	}
	res, err := svc.Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Personalized {
		t.Fatal("a like alone should personalise the rows")
	}
	top := rowByKind(res, "top-picks")
	if top == nil || !hasTitle([]string{"Prestige", "Inception"}, top.Items[0].Title) {
		t.Fatalf("top picks should lead with the liked director's film: %+v", top)
	}
	if hasTitle(allTitles(res), "Dark Knight") {
		t.Fatal("a liked (seen) title must not be recommended back")
	}
	found := false
	for _, r := range res.Rows {
		if strings.HasPrefix(r.Title, "Because You Liked Dark Knight") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected a 'Because You Liked' row, got %v", res.Rows)
	}
	// Re-rating updates in place; 0 clears.
	if err := svc.SetRating("1", "movie", liked.ID, 2); err != nil {
		t.Fatal(err)
	}
	var n int64
	db.Model(&models.TasteRating{}).Count(&n)
	if n != 1 || svc.Rating("1", "movie", liked.ID) != 2 {
		t.Fatalf("upsert failed: %d rows", n)
	}
	_ = svc.SetRating("1", "movie", liked.ID, 0)
	if svc.Rating("1", "movie", liked.ID) != 0 {
		t.Fatal("0 should clear the rating")
	}
}

func TestDislikeIsNeverRecommended(t *testing.T) {
	svc := ratingsDB(t)
	db := svc.db
	var romcoms []models.Media
	for i := 0; i < 4; i++ {
		romcoms = append(romcoms, movie(db, t, fmt.Sprintf("Romcom %d", i), 2015, "Someone Else", []string{"Same Actor"}, []string{"Romance"}, "", 9.9))
	}
	movie(db, t, "Heat", 1995, "Michael Mann", []string{"Al Pacino"}, []string{"Crime"}, "", 8)
	if err := svc.SetRating("1", "movie", romcoms[0].ID, -1); err != nil {
		t.Fatal(err)
	}
	// Nothing liked: fallback rows, still without the disliked title.
	res, err := svc.Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	if hasTitle(allTitles(res), "Romcom 0") {
		t.Fatalf("'not for me' title was recommended: %v", allTitles(res))
	}
	if err := svc.SetRating("1", "movie", 9999, 1); err != ErrRatingTarget {
		t.Fatalf("unknown title: %v", err)
	}
	if err := svc.SetRating("1", "movie", romcoms[1].ID, 5); err == nil {
		t.Fatal("out-of-range rating accepted")
	}
}

func TestMyListSteersRecommendations(t *testing.T) {
	svc := ratingsDB(t)
	db := svc.db
	listed := movie(db, t, "Alien", 1979, "Ridley Scott", []string{"Sigourney Weaver"}, []string{"Sci-Fi", "Horror"}, "Alien Collection", 8.5)
	movie(db, t, "Aliens", 1986, "James Cameron", []string{"Sigourney Weaver"}, []string{"Sci-Fi", "Action"}, "Alien Collection", 8.4)
	for i := 0; i < 6; i++ {
		movie(db, t, fmt.Sprintf("Drama %d", i), 2015, "Someone Else", []string{fmt.Sprintf("Actor %d", i)}, []string{"Drama"}, "", 9.5)
	}
	if err := db.Create(&models.MyListItem{UserID: 1, MediaID: listed.ID, MediaType: "movie"}).Error; err != nil {
		t.Fatal(err)
	}
	res, err := svc.Recommend("1", 10)
	if err != nil {
		t.Fatal(err)
	}
	top := rowByKind(res, "top-picks")
	if !res.Personalized || top == nil || !hasTitle(titles(top.Items)[:2], "Aliens") {
		t.Fatalf("My List should steer top picks toward the sequel: %+v", top)
	}
}
