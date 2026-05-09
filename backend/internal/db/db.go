package db

import (
	"fmt"
	"log"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

func InitDB(dbPath string) (*sqlx.DB, error) {
	// Enable WAL mode and foreign keys for better concurrency and integrity
	db, err := sqlx.Connect("sqlite", fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)", dbPath))
	if err != nil {
		return nil, err
	}

	if err := createSchema(db); err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	if err := seedSettings(db); err != nil {
		return nil, fmt.Errorf("failed to seed settings: %w", err)
	}

	return db, nil
}

func createSchema(db *sqlx.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		total_size_bytes INTEGER NOT NULL,
		total_files INTEGER NOT NULL,
		duration_ms INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS folder_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		snapshot_id INTEGER NOT NULL,
		path TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		file_count INTEGER NOT NULL,
		FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
	);

	-- Indexes for faster lookups
	CREATE INDEX IF NOT EXISTS idx_folder_snapshots_snapshot_id ON folder_snapshots(snapshot_id);
	CREATE INDEX IF NOT EXISTS idx_folder_snapshots_path ON folder_snapshots(path);
	`

	_, err := db.Exec(schema)
	return err
}

func seedSettings(db *sqlx.DB) error {
	// Check if exclusions exist
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM settings WHERE key = 'exclusions'")
	if err != nil {
		return err
	}

	// Default exclusions requested by user
	if count == 0 {
		defaultExclusions := `[".git", ".DS_Store", "node_modules", "venv", ".venv"]`
		_, err = db.Exec("INSERT INTO settings (key, value) VALUES ('exclusions', ?)", defaultExclusions)
		if err != nil {
			log.Printf("Warning: Could not seed default exclusions: %v", err)
		}
	}
	return nil
}
