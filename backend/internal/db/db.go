package db

import (
	"fmt"
	"log"
	"os"
	"strconv"

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

	if err := migrateSchema(db); err != nil {
		return nil, fmt.Errorf("failed to migrate schema: %w", err)
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

	CREATE TABLE IF NOT EXISTS top_files (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		snapshot_id INTEGER NOT NULL,
		path TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		category TEXT NOT NULL DEFAULT 'Other',
		FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS category_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		snapshot_id INTEGER NOT NULL,
		category TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		file_count INTEGER NOT NULL,
		FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
	);

	-- Indexes for faster lookups
	CREATE INDEX IF NOT EXISTS idx_folder_snapshots_snapshot_id ON folder_snapshots(snapshot_id);
	CREATE INDEX IF NOT EXISTS idx_folder_snapshots_path ON folder_snapshots(path);
	CREATE INDEX IF NOT EXISTS idx_top_files_snapshot_id ON top_files(snapshot_id);
	CREATE INDEX IF NOT EXISTS idx_category_snapshots_snapshot_id ON category_snapshots(snapshot_id);
	`

	_, err := db.Exec(schema)
	return err
}

func migrateSchema(db *sqlx.DB) error {
	// Check if top_files has category column
	var count int
	err := db.Get(&count, "SELECT count(*) FROM pragma_table_info('top_files') WHERE name='category'")
	if err != nil {
		// Fallback for older sqlite versions
		rows, err := db.Query("PRAGMA table_info(top_files)")
		if err != nil {
			return err
		}
		defer rows.Close()
		
		found := false
		for rows.Next() {
			var cid int
			var name, dtype string
			var notnull, pk int
			var dfltValue interface{}
			if err := rows.Scan(&cid, &name, &dtype, &notnull, &dfltValue, &pk); err != nil {
				continue
			}
			if name == "category" {
				found = true
				break
			}
		}
		if !found {
			_, err = db.Exec("ALTER TABLE top_files ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'")
			if err != nil {
				return err
			}
			_, err = db.Exec("CREATE INDEX IF NOT EXISTS idx_top_files_category ON top_files(category)")
			return err
		}
		return nil
	}

	if count == 0 {
		log.Println("Migrating database: Adding category column to top_files")
		_, err = db.Exec("ALTER TABLE top_files ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'")
		if err != nil {
			return err
		}
		_, err = db.Exec("CREATE INDEX IF NOT EXISTS idx_top_files_category ON top_files(category)")
		return err
	}

	return nil
}

func seedSettings(db *sqlx.DB) error {
	// 1. Exclusions
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM settings WHERE key = 'exclusions'")
	if err == nil && count == 0 {
		defaultExclusions := `[".git", ".DS_Store", "node_modules", "venv", ".venv"]`
		_, err = db.Exec("INSERT INTO settings (key, value) VALUES ('exclusions', ?)", defaultExclusions)
		if err != nil {
			log.Printf("Warning: Could not seed default exclusions: %v", err)
		}
	}

	// 2. Scan Interval
	err = db.Get(&count, "SELECT COUNT(*) FROM settings WHERE key = 'scan_interval_days'")
	if err == nil && count == 0 {
		// Get from env or default to 7
		intervalDays := 7
		if envDays := os.Getenv("BIRDVIEW_SCAN_INTERVAL_DAYS"); envDays != "" {
			if val, err := strconv.Atoi(envDays); err == nil && val > 0 {
				intervalDays = val
			}
		}
		_, err = db.Exec("INSERT INTO settings (key, value) VALUES ('scan_interval_days', ?)", fmt.Sprintf("%d", intervalDays))
		if err != nil {
			log.Printf("Warning: Could not seed default scan interval: %v", err)
		}
	}

	return nil
}
