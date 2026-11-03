package libgen

import (
	"errors"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Media struct {
	ID    uint
	Title string
}
type User struct {
	ID   uint
	Name string
}

func TestGenerationTracksLibraryWritesOnly(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&Media{}, &User{})
	Watch(db)
	Watch(db) // idempotent

	step := func(name string, want bool, f func()) {
		t.Helper()
		g := Gen()
		f()
		if got := Gen() != g; got != want {
			t.Errorf("%s: changed=%v, want %v", name, got, want)
		}
	}
	step("create media", true, func() { db.Create(&Media{Title: "a"}) })
	step("update media", true, func() { db.Model(&Media{}).Where("id = 1").Update("title", "b") })
	step("select media", false, func() { var m []Media; db.Find(&m) })
	step("raw select", false, func() { var n int; db.Raw("SELECT count(*) FROM media").Scan(&n) })
	step("exec update", true, func() { db.Exec("UPDATE media SET title = 'c'") })
	step("user write", false, func() { db.Create(&User{Name: "x"}) })
	step("delete media", true, func() { db.Delete(&Media{}, 1) })
}

func TestMemo(t *testing.T) {
	var m Memo[int]
	calls := 0
	load := func() (int, error) { calls++; return calls, nil }
	if v, _ := m.Get(time.Minute, load); v != 1 {
		t.Fatal(v)
	}
	if v, _ := m.Get(time.Minute, load); v != 1 || calls != 1 {
		t.Fatal("not cached")
	}
	Bump()
	if v, _ := m.Get(time.Minute, load); v != 2 {
		t.Fatal("not rebuilt after library change")
	}
	if v, _ := m.Get(0, load); v != 3 {
		t.Fatal("ttl ignored")
	}
	if _, err := m.Get(0, func() (int, error) { return 0, errors.New("x") }); err == nil {
		t.Fatal("error swallowed")
	}
	if v, _ := m.Get(time.Minute, load); v != 3 {
		t.Fatalf("error was cached: %d", v)
	}
}
