package db

import (
	"fmt"
	"sync"
	"time"
	
	"gorm.io/gorm"
)

type DBManager struct {
	db      *gorm.DB
	mu      sync.Mutex
	inTx    bool
	retries int
}

func NewDBManager(db *gorm.DB) *DBManager {
	return &DBManager{
		db:      db,
		retries: 3,
	}
}

// WithTx executes a function within a transaction with retry logic
func (m *DBManager) WithTx(fn func(tx *gorm.DB) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var lastErr error
	for i := 0; i < m.retries; i++ {
		tx := m.db.Begin()
		if tx.Error != nil {
			lastErr = tx.Error
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}

		err := fn(tx)
		if err != nil {
			tx.Rollback()
			if isRetryableError(err) {
				lastErr = err
				time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
				continue
			}
			return err
		}

		if err := tx.Commit().Error; err != nil {
			lastErr = err
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}

		return nil
	}

	return fmt.Errorf("max retries reached, last error: %v", lastErr)
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	// Add more SQLite specific error checks here
	return true
}

// WithReadOnly executes a read-only operation with retry logic
func (m *DBManager) WithReadOnly(fn func(db *gorm.DB) error) error {
	var lastErr error
	for i := 0; i < m.retries; i++ {
		err := fn(m.db)
		if err == nil {
			return nil
		}
		if !isRetryableError(err) {
			return err
		}
		lastErr = err
		time.Sleep(time.Duration(i+1) * 50 * time.Millisecond)
	}
	return fmt.Errorf("max retries reached, last error: %v", lastErr)
}
