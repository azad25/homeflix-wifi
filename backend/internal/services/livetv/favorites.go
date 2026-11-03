package livetv

import (
	"fmt"
	"sort"
	"sync"
)

// Favourite channels are kept on the server, so every app sees the same
// ones: the web app and the TV app get favourites at the top of
// GET /api/livetv/channels (marked "favorite": true), with the rest of the
// lineup below. Channel numbers don't change.

type favorites struct {
	mu  sync.RWMutex
	ids []string
	set map[string]bool
}

func (s *Service) loadFavorites() {
	s.favs.mu.Lock()
	defer s.favs.mu.Unlock()
	var ids []string
	_ = s.store.load("favorites.json", &ids)
	s.favs.ids, s.favs.set = nil, map[string]bool{}
	for _, id := range ids {
		if id != "" && !s.favs.set[id] {
			s.favs.set[id] = true
			s.favs.ids = append(s.favs.ids, id)
		}
	}
}

// Favorites returns favourite channel ids in the order they were added.
func (s *Service) Favorites() []string {
	s.favs.mu.RLock()
	defer s.favs.mu.RUnlock()
	return append([]string{}, s.favs.ids...)
}

func (s *Service) isFavorite(id string) bool {
	s.favs.mu.RLock()
	defer s.favs.mu.RUnlock()
	return s.favs.set[id]
}

// SetFavorites adds (on) or removes ids; unknown channels can't be added.
func (s *Service) SetFavorites(ids []string, on bool) ([]string, error) {
	if on {
		s.mu.RLock()
		known := s.byID
		s.mu.RUnlock()
		for _, id := range ids {
			if known != nil && known[id] == nil {
				return nil, fmt.Errorf("%w: %s", ErrNoChannel, id)
			}
		}
	}
	s.favs.mu.Lock()
	defer s.favs.mu.Unlock()
	if s.favs.set == nil {
		s.favs.set = map[string]bool{}
	}
	changed := false
	for _, id := range ids {
		if on && !s.favs.set[id] {
			s.favs.set[id] = true
			s.favs.ids = append(s.favs.ids, id)
			changed = true
		}
		if !on && s.favs.set[id] {
			delete(s.favs.set, id)
			for i, x := range s.favs.ids {
				if x == id {
					s.favs.ids = append(s.favs.ids[:i], s.favs.ids[i+1:]...)
					break
				}
			}
			changed = true
		}
	}
	if changed {
		if err := s.store.save("favorites.json", s.favs.ids); err != nil {
			return nil, err
		}
	}
	return append([]string{}, s.favs.ids...), nil
}

// favoritesFirst moves favourites to the top (in channel-number order)
// and keeps the rest in lineup order.
func favoritesFirst(list []ChannelView) {
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Favorite != list[j].Favorite {
			return list[i].Favorite
		}
		return list[i].Number < list[j].Number
	})
}
