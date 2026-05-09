package scanner

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/storken/birdview/internal/models"
)

type Scanner struct {
	db           *sqlx.DB
	scanMutex    sync.Mutex
	IsRunning    bool
	FilesScanned int64
	BytesScanned int64
	CurrentPath  string
	StartTime    time.Time
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
	s.FilesScanned = 0
	s.BytesScanned = 0
	s.StartTime = time.Now()
	defer func() {
		s.IsRunning = false
		s.scanMutex.Unlock()
	}()

	log.Printf("Starting optimized concurrent scan on %s", basePath)

	// Get exclusions
	var exclusionsStr string
	err := s.db.Get(&exclusionsStr, "SELECT value FROM settings WHERE key = 'exclusions'")
	var exclusions []string
	if err == nil {
		json.Unmarshal([]byte(exclusionsStr), &exclusions)
	}

	// Clear current path if scan fails or finishes
	defer func() {
		s.CurrentPath = ""
	}()

	return s.startConcurrentScan(basePath, exclusions)
}

func (s *Scanner) startConcurrentScan(basePath string, exclusions []string) error {
	startTime := time.Now()
	
	// Thread-safe accumulators
	var totalSize int64
	var totalFiles int64
	
	mu := sync.Mutex{}
	folderStats := make(map[string]*models.FolderResult) // Stores DIRECT size initially
	topFiles := make([]models.TopFileResult, 0, 51)
	categories := make(map[string]*models.CategoryResult)

	// Work management
	work := make(chan string, 10000)
	pending := sync.WaitGroup{}

	numWorkers := 16
	for i := 0; i < numWorkers; i++ {
		go func() {
			for path := range work {
				s.CurrentPath = path
				entries, err := os.ReadDir(path)
				if err != nil {
					pending.Done()
					continue
				}

				var dirDirectSize int64
				var dirDirectFiles int

				for _, d := range entries {
					name := d.Name()
					
					// Check exclusions
					excluded := false
					for _, ex := range exclusions {
						if name == ex {
							excluded = true
							break
						}
					}
					if excluded {
						continue
					}

					fullPath := filepath.Join(path, name)
					if d.IsDir() {
						pending.Add(1)
						select {
						case work <- fullPath:
						default:
							// Fail-safe if channel is full (unlikely with 10k buffer)
							go func(p string) { work <- p }(fullPath)
						}
					} else {
						info, err := d.Info()
						if err != nil {
							continue
						}
						size := info.Size()
						atomic.AddInt64(&totalSize, size)
						atomic.AddInt64(&totalFiles, 1)
						atomic.AddInt64(&s.FilesScanned, 1)
						atomic.AddInt64(&s.BytesScanned, size)
						
						dirDirectSize += size
						dirDirectFiles++

						// Track categories & top files (protected by mutex)
						mu.Lock()
						s.updateFileStats(fullPath, size, &topFiles, categories)
						mu.Unlock()
					}
				}

				mu.Lock()
				folderStats[path] = &models.FolderResult{
					Path:      path,
					SizeBytes: dirDirectSize,
					FileCount: dirDirectFiles,
				}
				mu.Unlock()
				
				pending.Done()
			}
		}()
	}

	pending.Add(1)
	work <- basePath
	
	// Wait for all workers to finish
	pending.Wait()
	close(work)

	// PROPAGATION: Bottom-up size aggregation
	log.Printf("Scan walk finished. Propagating sizes for %d folders...", len(folderStats))
	s.propagateSizes(folderStats)

	durationMs := time.Since(startTime).Milliseconds()
	log.Printf("Optimized scan completed in %d ms. Found %d files.", durationMs, totalFiles)

	return s.saveSnapshot(totalSize, int(totalFiles), durationMs, folderStats, topFiles, categories)
}

func (s *Scanner) updateFileStats(path string, size int64, topFiles *[]models.TopFileResult, categories map[string]*models.CategoryResult) {
	// Top Files
	if len(*topFiles) < 50 || size > (*topFiles)[len(*topFiles)-1].SizeBytes {
		*topFiles = append(*topFiles, models.TopFileResult{Path: path, SizeBytes: size})
		sort.Slice(*topFiles, func(i, j int) bool {
			return (*topFiles)[i].SizeBytes > (*topFiles)[j].SizeBytes
		})
		if len(*topFiles) > 50 {
			*topFiles = (*topFiles)[:50]
		}
	}

	// Categories
	ext := strings.ToLower(filepath.Ext(path))
	cat := "Other"
	
	// First check by extension
	switch ext {
	case ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".m2ts": cat = "Video"
	case ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma": cat = "Audio"
	case ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".tiff", ".heic", ".heif": cat = "Images"
	case ".zip", ".tar", ".gz", ".rar", ".7z", ".iso", ".bz2", ".xz", ".dmg", ".pkg", ".deb", ".rpm": cat = "Archives"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".rtf": cat = "Documents"
	case ".bak", ".old", ".tmp", ".bundle", ".sparsebundle", ".backupbundle", ".backupdb", ".vhd", ".vhdx", ".qcow2", ".img": cat = "Backups"
	case ".db", ".sqlite", ".sqlite3", ".sql", ".log", ".env", ".json", ".yaml", ".yml", ".xml", ".conf", ".config": cat = "System"
	}

	// If still "Other", try path-based heuristic (good for Time Machine and generic backup folders)
	if cat == "Other" {
		lowerPath := strings.ToLower(path)
		if strings.Contains(lowerPath, "timemachine") || strings.Contains(lowerPath, ".sparsebundle") || strings.Contains(lowerPath, "backup") {
			cat = "Backups"
		} else if strings.Contains(lowerPath, "docker/") || strings.Contains(lowerPath, "/.plex/") {
			cat = "System"
		}
	}

	if _, exists := categories[cat]; !exists {
		categories[cat] = &models.CategoryResult{Category: cat}
	}
	categories[cat].SizeBytes += size
	categories[cat].FileCount++
}

func (s *Scanner) propagateSizes(folderStats map[string]*models.FolderResult) {
	// Get all paths and sort by depth (longest first)
	paths := make([]string, 0, len(folderStats))
	for p := range folderStats {
		paths = append(paths, p)
	}
	
	// Sort by number of slashes descending (deepest first)
	sort.Slice(paths, func(i, j int) bool {
		return strings.Count(paths[i], "/") > strings.Count(paths[j], "/")
	})

	for _, path := range paths {
		if path == "/" || path == "." {
			continue
		}
		
		parent := filepath.Dir(path)
		if parentStat, exists := folderStats[parent]; exists {
			parentStat.SizeBytes += folderStats[path].SizeBytes
			parentStat.FileCount += folderStats[path].FileCount
		}
	}
}

func (s *Scanner) saveSnapshot(totalSize int64, totalFiles int, durationMs int64, folderStats map[string]*models.FolderResult, topFiles []models.TopFileResult, categories map[string]*models.CategoryResult) error {
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

	// Batch insert folders - using a larger batch size for performance
	stmt, err := tx.Preparex("INSERT INTO folder_snapshots (snapshot_id, path, size_bytes, file_count) VALUES (?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("failed to prepare folder statement: %w", err)
	}
	for _, stat := range folderStats {
		_, err = stmt.Exec(snapshotID, stat.Path, stat.SizeBytes, stat.FileCount)
		if err != nil {
			stmt.Close()
			return fmt.Errorf("failed to execute folder insert: %w", err)
		}
	}
	stmt.Close()

	// Batch insert top files
	stmt, err = tx.Preparex("INSERT INTO top_files (snapshot_id, path, size_bytes) VALUES (?, ?, ?)")
	if err != nil {
		return fmt.Errorf("failed to prepare top files statement: %w", err)
	}
	for _, f := range topFiles {
		_, err = stmt.Exec(snapshotID, f.Path, f.SizeBytes)
		if err != nil {
			stmt.Close()
			return fmt.Errorf("failed to execute top file insert: %w", err)
		}
	}
	stmt.Close()

	// Batch insert categories
	stmt, err = tx.Preparex("INSERT INTO category_snapshots (snapshot_id, category, size_bytes, file_count) VALUES (?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("failed to prepare categories statement: %w", err)
	}
	for _, c := range categories {
		_, err = stmt.Exec(snapshotID, c.Category, c.SizeBytes, c.FileCount)
		if err != nil {
			stmt.Close()
			return fmt.Errorf("failed to execute category insert: %w", err)
		}
	}
	stmt.Close()

	return tx.Commit()
}
