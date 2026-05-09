package scanner

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/storken/birdview/internal/models"
)

type Scanner struct {
	db        *sqlx.DB
	scanMutex sync.Mutex
	IsRunning bool
}

func NewScanner(db *sqlx.DB) *Scanner {
	return &Scanner{
		db: db,
	}
}

func (s *Scanner) RunScan(basePath string) error {
	if !s.scanMutex.TryLock() {
		return fmt.Errorf("scan already in progress")
	}
	s.IsRunning = true
	defer func() {
		s.IsRunning = false
		s.scanMutex.Unlock()
	}()

	startTime := time.Now()
	log.Printf("Starting scan on %s", basePath)

	// Get exclusions from DB
	var exclusionsStr string
	err := s.db.Get(&exclusionsStr, "SELECT value FROM settings WHERE key = 'exclusions'")
	var exclusions []string
	if err == nil {
		json.Unmarshal([]byte(exclusionsStr), &exclusions)
	}

	folderStats := make(map[string]*models.FolderResult)
	folderStats[basePath] = &models.FolderResult{Path: basePath}

	var totalSize int64
	var totalFiles int

	// Recursively walk directory
	err = filepath.WalkDir(basePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			log.Printf("Warning: error accessing path %q: %v\n", path, err)
			return nil // Continue scanning other files
		}

		// Check exclusions
		name := d.Name()
		for _, ex := range exclusions {
			if name == ex {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		if d.IsDir() {
			if _, exists := folderStats[path]; !exists {
				folderStats[path] = &models.FolderResult{Path: path}
			}
			return nil
		}

		// It's a file
		info, err := d.Info()
		if err != nil {
			return nil
		}

		size := info.Size()
		totalSize += size
		totalFiles++

		// Add size to all parent directories up to basePath
		dir := filepath.Dir(path)
		for {
			if _, exists := folderStats[dir]; !exists {
				folderStats[dir] = &models.FolderResult{Path: dir}
			}
			folderStats[dir].SizeBytes += size
			folderStats[dir].FileCount++

			if dir == basePath || dir == "/" || dir == "." {
				break
			}
			dir = filepath.Dir(dir)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("error walking directory: %w", err)
	}

	durationMs := time.Since(startTime).Milliseconds()
	log.Printf("Scan completed in %d ms. Found %d files. Total Size: %d bytes", durationMs, totalFiles, totalSize)

	return s.saveSnapshot(totalSize, totalFiles, durationMs, folderStats)
}

func (s *Scanner) saveSnapshot(totalSize int64, totalFiles int, durationMs int64, folderStats map[string]*models.FolderResult) error {
	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert snapshot
	res, err := tx.Exec("INSERT INTO snapshots (total_size_bytes, total_files, duration_ms) VALUES (?, ?, ?)", totalSize, totalFiles, durationMs)
	if err != nil {
		return fmt.Errorf("failed to insert snapshot: %w", err)
	}
	snapshotID, _ := res.LastInsertId()

	// Prepare statement for batch inserts
	stmt, err := tx.Preparex("INSERT INTO folder_snapshots (snapshot_id, path, size_bytes, file_count) VALUES (?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, stat := range folderStats {
		_, err = stmt.Exec(snapshotID, stat.Path, stat.SizeBytes, stat.FileCount)
		if err != nil {
			return fmt.Errorf("failed to execute folder insert: %w", err)
		}
	}

	return tx.Commit()
}
