package services

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm/clause"

	"homeflix-backend/internal/models"
)

// Weights of explicit signals, on the same scale as a finished, recent watch (≈1).
const (
	tasteWeightLove    = 1.6
	tasteWeightLike    = 1.0
	tasteWeightDislike = -1.2
	tasteWeightMyList  = 0.5
)

// ErrRatingTarget is returned for an unknown movie/series or kind.
var ErrRatingTarget = errors.New("unknown title")

func validRatingKind(kind string) bool { return kind == "movie" || kind == "series" }

// SetRating stores a thumbs rating (-1 not for me, 1 like, 2 love); 0 clears it.
func (s *TasteService) SetRating(userID, kind string, id uint, value int) error {
	if !validRatingKind(kind) || id == 0 {
		return ErrRatingTarget
	}
	if value < models.RatingDislike || value > models.RatingLove {
		return fmt.Errorf("rating must be -1, 0, 1 or 2")
	}
	var n int64
	if kind == "series" {
		s.db.Model(&models.Series{}).Where("id = ?", id).Count(&n)
	} else {
		s.db.Model(&models.Media{}).Where("id = ?", id).Count(&n)
	}
	if n == 0 {
		return ErrRatingTarget
	}
	where := s.db.Where("user_id = ? AND kind = ? AND target_id = ?", userID, kind, id)
	if value == 0 {
		return where.Delete(&models.TasteRating{}).Error
	}
	r := models.TasteRating{UserID: userID, Kind: kind, TargetID: id, Value: value, UpdatedAt: time.Now()}
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "kind"}, {Name: "target_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&r).Error
}

// Rating returns the user's rating of a title (0 = not rated).
func (s *TasteService) Rating(userID, kind string, id uint) int {
	var r models.TasteRating
	if err := s.db.Where("user_id = ? AND kind = ? AND target_id = ?", userID, kind, id).First(&r).Error; err != nil {
		return 0
	}
	return r.Value
}

// Ratings lists the user's ratings, newest first.
func (s *TasteService) Ratings(userID string) ([]models.TasteRating, error) {
	var out []models.TasteRating
	err := s.db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&out).Error
	return out, err
}

// withExplicitSignals folds thumbs ratings and My List into the watch signals.
//   - Love / Like: a strong positive (they know they enjoyed it), never re-recommended.
//   - Not for me: negative, and never recommended, even if they watched it.
//   - My List: a lighter positive — they want it, so more like it is welcome.
func (s *TasteService) withExplicitSignals(idx *tasteIndex, userID string, now time.Time, watched []tasteSignal) []tasteSignal {
	byKey := map[string]*tasteSignal{}
	order := []string{}
	for i := range watched {
		sg := watched[i]
		byKey[sg.unit.key] = &sg
		order = append(order, sg.unit.key)
	}
	get := func(u *tasteUnit, at time.Time) (*tasteSignal, bool) {
		if sg, ok := byKey[u.key]; ok {
			return sg, true
		}
		sg := &tasteSignal{unit: u, lastWatched: at}
		byKey[u.key] = sg
		order = append(order, u.key)
		return sg, false
	}

	var ratings []models.TasteRating
	if err := s.db.Where("user_id = ?", userID).Find(&ratings).Error; err == nil {
		for _, r := range ratings {
			prefix := "m:"
			if r.Kind == "series" {
				prefix = "s:"
			}
			u := idx.byKey[fmt.Sprintf("%s%d", prefix, r.TargetID)]
			if u == nil {
				continue
			}
			sg, existed := get(u, r.UpdatedAt)
			switch {
			case r.Value < 0:
				sg.weight, sg.engagement, sg.liked = tasteWeightDislike, 0, false
			default:
				w := tasteWeightLike
				if r.Value >= models.RatingLove {
					w = tasteWeightLove
				}
				if existed && sg.weight > 0 {
					w += 0.5 * sg.weight
				}
				sg.weight = w * recencyDecayFloor(r.UpdatedAt, now)
				sg.engagement = 1 // rated = seen; don't recommend it back
				sg.liked = true
			}
			if r.UpdatedAt.After(sg.lastWatched) {
				sg.lastWatched = r.UpdatedAt
			}
		}
	}

	// My List (CollectionService) keys users by number; this service by string.
	if uid, err := strconv.ParseUint(userID, 10, 32); err == nil {
		var items []models.MyListItem
		if err := s.db.Where("user_id = ?", uint(uid)).Find(&items).Error; err == nil && len(items) > 0 {
			var mediaIDs []uint
			for _, it := range items {
				if it.MediaType != MyListSeries {
					mediaIDs = append(mediaIDs, it.MediaID)
				}
			}
			seriesOf := map[uint]*uint{}
			if len(mediaIDs) > 0 {
				var refs []struct {
					ID       uint
					SeriesID *uint
				}
				s.db.Model(&models.Media{}).Select("id", "series_id").Where("id IN ?", mediaIDs).Scan(&refs)
				for _, r := range refs {
					seriesOf[r.ID] = r.SeriesID
				}
			}
			for _, it := range items {
				key := fmt.Sprintf("m:%d", it.MediaID)
				if it.MediaType == MyListSeries {
					key = fmt.Sprintf("s:%d", it.MediaID)
				} else if sid := seriesOf[it.MediaID]; sid != nil {
					key = fmt.Sprintf("s:%d", *sid)
				}
				u := idx.byKey[key]
				if u == nil {
					continue
				}
				sg, existed := get(u, it.AddedAt)
				if sg.weight < 0 {
					continue // rated "not for me": the rating wins
				}
				if existed {
					sg.weight += 0.3 * tasteWeightMyList
				} else {
					sg.weight = tasteWeightMyList * recencyDecayFloor(it.AddedAt, now)
				}
			}
		}
	}

	out := make([]tasteSignal, 0, len(order))
	for _, k := range order {
		out = append(out, *byKey[k])
	}
	return out
}

// recencyDecayFloor fades explicit signals more slowly than watches: a like
// from a year ago still counts for something.
func recencyDecayFloor(at, now time.Time) float64 {
	d := recencyDecay(at, now)
	if d < 0.4 {
		return 0.4
	}
	return d
}
