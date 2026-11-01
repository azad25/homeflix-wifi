package database

import (
	"context"
	"path/filepath"
	"testing"
)

// Every pooled connection must get busy_timeout and the bounded cache, not
// just the one that happened to run the startup PRAGMAs.
func TestInitializeConfiguresEveryConnection(t *testing.T) {
	db, err := Initialize(filepath.Join(t.TempDir(), "homeflix.db"))
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for i := 0; i < 4; i++ {
		conn, err := sqlDB.Conn(ctx) // hold each so the pool opens new ones
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		var busy, cache int
		if err := conn.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&busy); err != nil {
			t.Fatal(err)
		}
		if err := conn.QueryRowContext(ctx, "PRAGMA cache_size").Scan(&cache); err != nil {
			t.Fatal(err)
		}
		if busy != 5000 {
			t.Errorf("conn %d: busy_timeout=%d, want 5000", i, busy)
		}
		if cache != -65536 {
			t.Errorf("conn %d: cache_size=%d, want -65536", i, cache)
		}
	}
}
