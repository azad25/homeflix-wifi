package models

import "time"

// TasteRating is a Netflix-style thumbs rating of a movie or a whole series.
// It feeds the personalised recommendations (TasteService): liked titles
// steer what's recommended, "not for me" titles are never recommended.
type TasteRating struct {
	ID       uint   `json:"-" gorm:"primaryKey"`
	UserID   string `json:"-" gorm:"size:64;not null;uniqueIndex:idx_taste_rating_target"`
	Kind     string `json:"kind" gorm:"size:16;not null;uniqueIndex:idx_taste_rating_target"` // "movie" | "series"
	TargetID uint   `json:"id" gorm:"not null;uniqueIndex:idx_taste_rating_target"`
	// -1 not for me, 1 like, 2 love
	Value     int       `json:"rating" gorm:"not null"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	RatingDislike = -1
	RatingLike    = 1
	RatingLove    = 2
)
