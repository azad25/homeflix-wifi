package services

import (
	"testing"

	"homeflix-backend/internal/models"
)

// A show's episodes must never include another show's episode whose media id
// happens to equal this show's id (it made every show preview the wrong clip).
func TestEpisodesOnlyBelongToTheirSeries(t *testing.T) {
	db := newTasteTestDB(t)
	if err := db.AutoMigrate(&models.Subtitle{}); err != nil {
		t.Fatal(err)
	}
	a := models.Series{UUID: "a", Title: "Show A"}
	b := models.Series{UUID: "b", Title: "Show B"}
	db.Create(&a)
	db.Create(&b)
	one := 1
	// Media id == a.ID, but it's an episode of show B.
	stray := models.Media{UUID: "stray", Title: "B S1E1", Type: "episode", SeriesID: &b.ID, SeasonNumber: &one, FilePath: "/b1"}
	stray.ID = a.ID
	if err := db.Create(&stray).Error; err != nil {
		t.Fatal(err)
	}
	own := models.Media{UUID: "own", Title: "A S1E1", Type: "episode", SeriesID: &a.ID, SeasonNumber: &one, FilePath: "/a1"}
	db.Create(&own)

	eps, err := NewMediaService(db).GetEpisodesBySeriesAndSeason(a.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(eps) != 1 || eps[0].Title != "A S1E1" {
		var got []string
		for _, e := range eps {
			got = append(got, e.Title)
		}
		t.Fatalf("show A episodes = %v", got)
	}
}
