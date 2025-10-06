package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Open the database
	dbPath := "./homeflix.db"
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		log.Fatalf("Database file does not exist at %s\n", dbPath)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v\n", err)
	}
	defer db.Close()

	// Get list of all tables
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
	if err != nil {
		log.Fatalf("Failed to query tables: %v\n", err)
	}
	defer rows.Close()

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("Failed to begin transaction: %v\n", err)
	}

	// Disable foreign keys
	_, err = tx.Exec("PRAGMA foreign_keys = OFF;")
	if err != nil {
		tx.Rollback()
		log.Fatalf("Failed to disable foreign keys: %v\n", err)
	}

	// Delete data from all tables
	var tableName string
	for rows.Next() {
		err = rows.Scan(&tableName)
		if err != nil {
			tx.Rollback()
			log.Fatalf("Failed to scan table name: %v\n", err)
		}

		// Skip sqlite_sequence table
		if tableName == "sqlite_sequence" {
			continue
		}

		_, err = tx.Exec(fmt.Sprintf("DELETE FROM %s;", tableName))
		if err != nil {
			tx.Rollback()
			log.Fatalf("Failed to delete from table %s: %v\n", tableName, err)
		}

		// Reset autoincrement counters for tables with autoincrement IDs
		_, err = tx.Exec(fmt.Sprintf("DELETE FROM sqlite_sequence WHERE name='%s';", tableName))
		if err != nil {
			// Ignore errors for tables without autoincrement
			if err.Error() != "no such table: sqlite_sequence" {
				tx.Rollback()
				log.Fatalf("Failed to reset sequence for table %s: %v\n", tableName, err)
			}
		}

		// For SQLite, VACUUM needs to be run separately after transaction
	}

	// Re-enable foreign keys
	_, err = tx.Exec("PRAGMA foreign_keys = ON;")
	if err != nil {
		tx.Rollback()
		log.Fatalf("Failed to enable foreign keys: %v\n", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		log.Fatalf("Failed to commit transaction: %v\n", err)
	}

	// Run VACUUM to reclaim space
	_, err = db.Exec("VACUUM;")
	if err != nil {
		log.Fatalf("Failed to vacuum database: %v\n", err)
	}

	log.Println("✅ Database cleared successfully!")
}
