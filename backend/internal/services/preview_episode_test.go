package services

import (
	"testing"

	"homeflix-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestAttachPreviewEpisodes(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	if err != nil {
		t.Skip(err)
	}
	if err := db.AutoMigrate(&models.Series{}, &models.Media{}); err != nil {
		t.Fatal(err)
	}
	ip := func(v int) *int { return &v }
	up := func(v uint) *uint { return &v }
	db.Create(&models.Series{ID: 1, Title: "A", UUID: "a"})
	db.Create(&models.Series{ID: 2, Title: "B", UUID: "b"})
	eps := []models.Media{
		{Title: "s1e1", Type: "episode", FilePath: "/x/1", SeriesID: up(1), SeasonNumber: ip(1), EpisodeNumber: ip(1)},
		{Title: "s2e3", Type: "episode", FilePath: "/x/2", SeriesID: up(1), SeasonNumber: ip(2), EpisodeNumber: ip(3)},
		{Title: "s2e9 missing", Type: "episode", FilePath: "", SeriesID: up(1), SeasonNumber: ip(2), EpisodeNumber: ip(9)},
		{Title: "legacy", Type: "episode", FilePath: "/x/3", SeriesID: up(1), Season: ip(1), Episode: ip(8)},
	}
	for i := range eps {
		eps[i].UUID = eps[i].Title
		if err := db.Create(&eps[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	var series []models.Series
	db.Order("id").Find(&series)
	if err := attachPreviewEpisodes(db, series); err != nil {
		t.Fatal(err)
	}
	if series[0].PreviewEpisodeID != eps[1].ID {
		t.Fatalf("show A: got %d want %d", series[0].PreviewEpisodeID, eps[1].ID)
	}
	if series[1].PreviewEpisodeID != 0 {
		t.Fatalf("show B has no episodes, got %d", series[1].PreviewEpisodeID)
	}
}
