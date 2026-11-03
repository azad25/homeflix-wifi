// Package libgen tracks a "library generation": a counter that changes
// whenever a library table (media, series, seasons, genres and their joins)
// is written through GORM. Anything derived from the library can be cached
// against it and is rebuilt only after the library actually changes.
//
//	var catalog libgen.Memo[[]models.Media]
//	list, err := catalog.Get(5*time.Minute, loadCatalog)
package libgen

import (
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
)

var gen atomic.Uint64

// Gen returns the current library generation.
func Gen() uint64 { return gen.Load() }

// Bump marks the library as changed (for writes that bypass GORM).
func Bump() { gen.Add(1) }

var tables = []string{"media", "series", "seasons", "genres", "media_genres", "series_genres"}

func touchesLibrary(table, sql string) bool {
	t := strings.Trim(strings.ToLower(table), "`\"")
	for _, x := range tables {
		if t == x {
			return true
		}
	}
	if sql == "" {
		return false
	}
	s := strings.ToLower(strings.TrimSpace(sql))
	if strings.HasPrefix(s, "select") || strings.HasPrefix(s, "pragma") || strings.HasPrefix(s, "with") && !strings.Contains(s, "update") && !strings.Contains(s, "insert") && !strings.Contains(s, "delete") {
		return false
	}
	for _, x := range tables {
		if strings.Contains(s, x) {
			return true
		}
	}
	return false
}

var watched sync.Map // *gorm.DB -> struct{}

// Watch registers GORM callbacks on db so every create, update, delete and
// raw write to a library table bumps the generation. Safe to call twice.
func Watch(db *gorm.DB) {
	if db == nil {
		return
	}
	if _, dup := watched.LoadOrStore(db, struct{}{}); dup {
		return
	}
	after := func(tx *gorm.DB) {
		if tx.Error != nil || tx.Statement == nil {
			return
		}
		if touchesLibrary(tx.Statement.Table, tx.Statement.SQL.String()) {
			Bump()
		}
	}
	cb := db.Callback()
	_ = cb.Create().After("gorm:create").Register("libgen:create", after)
	_ = cb.Update().After("gorm:update").Register("libgen:update", after)
	_ = cb.Delete().After("gorm:delete").Register("libgen:delete", after)
	_ = cb.Raw().After("gorm:raw").Register("libgen:raw", after)
}

// Memo caches one value until the library changes or ttl passes. Concurrent
// callers during a rebuild wait for it instead of each rebuilding.
type Memo[T any] struct {
	mu  sync.Mutex
	ok  bool
	gen uint64
	at  time.Time
	val T
}

// Get returns the cached value, rebuilding it with load when the library
// generation moved or ttl expired. Errors are not cached.
func (m *Memo[T]) Get(ttl time.Duration, load func() (T, error)) (T, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	g := Gen()
	if m.ok && m.gen == g && time.Since(m.at) < ttl {
		return m.val, nil
	}
	v, err := load()
	if err != nil {
		return v, err
	}
	m.val, m.gen, m.at, m.ok = v, g, time.Now(), true
	return v, nil
}

// Reset drops the cached value.
func (m *Memo[T]) Reset() {
	m.mu.Lock()
	m.ok = false
	m.mu.Unlock()
}
