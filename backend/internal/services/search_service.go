package services

import (
	"fmt"
	"log"
	"strings"
	"time"

	"homeflix-backend/internal/models"

	"gorm.io/gorm"
)

// SearchService provides indexed library search. It uses SQLite FTS5 (BM25
// ranking, prefix matching) when the driver supports it, and falls back to
// indexed LIKE queries otherwise. Either way, search is a bounded SQL query -
// it never loads the whole library into memory per keystroke like the old
// smart search did.
type SearchService struct {
	db  *gorm.DB
	fts bool
}

// SearchHit is one ranked result: a movie (Media) or a series.
type SearchHit struct {
	Kind  string // "movie" or "series"
	RefID uint
}

func NewSearchService(db *gorm.DB) *SearchService {
	s := &SearchService{db: db}

	// FTS5 availability depends on the sqlite build; detect at runtime
	err := db.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS media_search
		USING fts5(kind UNINDEXED, ref_id UNINDEXED, title, description, genres)`).Error
	if err == nil {
		s.fts = true
		log.Printf("🔎 Search service: FTS5 index enabled")
	} else {
		log.Printf("🔎 Search service: FTS5 unavailable (%v) - using indexed LIKE fallback", err)
	}

	// Build the index now and refresh periodically (rebuild of ~1k rows
	// takes milliseconds; a ticker keeps it in sync with scans)
	if s.fts {
		go func() {
			s.RebuildIndex()
			for range time.Tick(15 * time.Minute) {
				s.RebuildIndex()
			}
		}()
	}
	return s
}

// RebuildIndex refreshes the FTS index from the media and series tables.
func (s *SearchService) RebuildIndex() {
	if !s.fts {
		return
	}
	start := time.Now()
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`DELETE FROM media_search`).Error; err != nil {
			return err
		}
		if err := tx.Exec(`INSERT INTO media_search (kind, ref_id, title, description, genres)
			SELECT 'movie', id, title, COALESCE(description,''), COALESCE(genre_names,'')
			FROM media WHERE type = 'movie' AND deleted_at IS NULL`).Error; err != nil {
			return err
		}
		return tx.Exec(`INSERT INTO media_search (kind, ref_id, title, description, genres)
			SELECT 'series', id, title, COALESCE(description,''), COALESCE(genre_names,'')
			FROM series WHERE deleted_at IS NULL`).Error
	})
	if err != nil {
		log.Printf("⚠️ Search index rebuild failed: %v", err)
		return
	}
	log.Printf("🔎 Search index rebuilt in %v", time.Since(start))
}

// ftsQuery converts free text into a safe FTS5 prefix query:
// `dark kni` -> `"dark"* "kni"*`
func ftsQuery(query string) string {
	fields := strings.Fields(query)
	terms := make([]string, 0, len(fields))
	for _, f := range fields {
		f = strings.ReplaceAll(f, `"`, "")
		if f == "" {
			continue
		}
		terms = append(terms, fmt.Sprintf(`"%s"*`, f))
	}
	return strings.Join(terms, " ")
}

// Search returns ranked hits for a query, bounded by limit.
func (s *SearchService) Search(query string, limit int) ([]SearchHit, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 50
	}

	var hits []SearchHit

	if s.fts {
		match := ftsQuery(query)
		if match == "" {
			return nil, nil
		}
		rows, err := s.db.Raw(`SELECT kind, ref_id FROM media_search
			WHERE media_search MATCH ?
			ORDER BY bm25(media_search, 0.0, 0.0, 10.0, 2.0, 4.0)
			LIMIT ?`, match, limit).Rows()
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var h SearchHit
			if err := rows.Scan(&h.Kind, &h.RefID); err == nil {
				hits = append(hits, h)
			}
		}
		return hits, nil
	}

	// LIKE fallback: prefix matches rank above substring matches
	like := "%" + strings.ToLower(query) + "%"
	prefix := strings.ToLower(query) + "%"
	rows, err := s.db.Raw(`
		SELECT 'movie' AS kind, id AS ref_id,
			CASE WHEN lower(title) LIKE ? THEN 0 ELSE 1 END AS rank
		FROM media WHERE type = 'movie' AND deleted_at IS NULL
			AND (lower(title) LIKE ? OR lower(genre_names) LIKE ?)
		UNION ALL
		SELECT 'series', id,
			CASE WHEN lower(title) LIKE ? THEN 0 ELSE 1 END
		FROM series WHERE deleted_at IS NULL
			AND (lower(title) LIKE ? OR lower(genre_names) LIKE ?)
		ORDER BY rank, ref_id DESC LIMIT ?`,
		prefix, like, like, prefix, like, like, limit).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var h SearchHit
		var rank int
		if err := rows.Scan(&h.Kind, &h.RefID, &rank); err == nil {
			hits = append(hits, h)
		}
	}
	return hits, nil
}

// LoadResults hydrates hits into API-shaped results, preserving rank order.
// Movies come back as models.Media; series as the map shape the frontend
// already expects from search.
func (s *SearchService) LoadResults(hits []SearchHit) []interface{} {
	var movieIDs, seriesIDs []uint
	for _, h := range hits {
		if h.Kind == "movie" {
			movieIDs = append(movieIDs, h.RefID)
		} else {
			seriesIDs = append(seriesIDs, h.RefID)
		}
	}

	movies := make(map[uint]models.Media)
	if len(movieIDs) > 0 {
		var rows []models.Media
		if err := s.db.Preload("Genres").Where("id IN ?", movieIDs).Find(&rows).Error; err == nil {
			for _, m := range rows {
				movies[m.ID] = m
			}
		}
	}
	series := make(map[uint]models.Series)
	if len(seriesIDs) > 0 {
		var rows []models.Series
		if err := s.db.Preload("Genres").Where("id IN ?", seriesIDs).Find(&rows).Error; err == nil {
			for _, sr := range rows {
				series[sr.ID] = sr
			}
		}
	}

	results := make([]interface{}, 0, len(hits))
	for _, h := range hits {
		if h.Kind == "movie" {
			if m, ok := movies[h.RefID]; ok {
				results = append(results, m)
			}
		} else if sr, ok := series[h.RefID]; ok {
			results = append(results, map[string]interface{}{
				"id":                sr.ID,
				"title":             sr.Title,
				"description":       sr.Description,
				"type":              "tv",
				"year":              sr.Year,
				"rating":            sr.Rating,
				"genres":            sr.Genres,
				"genre_names":       sr.GenreNames,
				"poster_path":       sr.PosterPath,
				"tmdb_poster_url":   sr.TMDBPosterURL,
				"tmdb_backdrop_url": sr.TMDBBackdropURL,
				"logo_path":         sr.LogoPath,
				"series_id":         sr.ID,
			})
		}
	}
	return results
}
