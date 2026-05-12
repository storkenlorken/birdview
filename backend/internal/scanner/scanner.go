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
	"syscall"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/storkenlorken/birdview/internal/models"
)
 
type ProgressUpdate struct {
	FilesScanned int64     `json:"filesScanned"`
	BytesScanned int64     `json:"bytesScanned"`
	CurrentPath  string    `json:"currentPath"`
	IsRunning    bool      `json:"isRunning"`
	StartTime    time.Time `json:"startTime"`
}

type Scanner struct {
	db           *sqlx.DB
	IsRunning    bool
	FilesScanned int64
	BytesScanned int64
	CurrentPath  string
	StartTime    time.Time
	OnProgress   func(ProgressUpdate)
	scanMu       sync.Mutex
}

func NewScanner(db *sqlx.DB) *Scanner {
	return &Scanner{
		db: db,
	}
}

func (s *Scanner) RunScan(basePath string) error {
	s.scanMu.Lock()
	if s.IsRunning {
		s.scanMu.Unlock()
		return fmt.Errorf("scan already in progress")
	}
	s.IsRunning = true
	s.scanMu.Unlock()

	s.FilesScanned = 0
	s.BytesScanned = 0
	s.StartTime = time.Now()
	if s.OnProgress != nil {
		s.OnProgress(ProgressUpdate{IsRunning: true, StartTime: s.StartTime})
	}
	defer func() {
		s.scanMu.Lock()
		s.IsRunning = false
		s.scanMu.Unlock()
		
		if s.OnProgress != nil {
			s.OnProgress(ProgressUpdate{IsRunning: false})
		}
	}()

	log.Printf("Starting optimized concurrent scan on %s", basePath)

	// Get exclusions from DB
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
	
	// Work management
	work := make(chan string, 100000)
	pending := sync.WaitGroup{}
	numWorkers := 8
	
	// Stats tracking
	var statsMu sync.Mutex
	folderStats := make(map[string]*models.FolderResult)
	topFiles := make(map[string][]models.TopFileResult)
	categories := make(map[string]*models.CategoryResult)
	
	lastReport := time.Now()

	for i := 0; i < numWorkers; i++ {
		go func() {
			for path := range work {
				// Open directory
				f, err := os.Open(path)
				if err != nil {
					log.Printf("Error opening %s: %v", path, err)
					pending.Done()
					continue
				}
				entries, err := f.ReadDir(-1)
				f.Close()
				
				if err != nil {
					log.Printf("Error reading %s: %v", path, err)
					pending.Done()
					continue
				}

				var dirSize int64
				var dirFiles int

				for _, d := range entries {
					name := d.Name()
					if name == "." || name == ".." { continue }
					
					excluded := false
					for _, ex := range exclusions {
						if name == ex {
							excluded = true
							break
						}
					}
					if excluded { continue }

					fullPath := filepath.Join(path, name)
					if d.IsDir() {
						pending.Add(1)
						select {
						case work <- fullPath:
						default:
							// Buffer overflow safety
							go func(p string) { work <- p }(fullPath)
						}
					} else {
						info, err := d.Info()
						if err != nil { continue }
						var size int64
						if stat, ok := info.Sys().(*syscall.Stat_t); ok {
							size = stat.Blocks * 512
						} else {
							size = info.Size()
						}
						
						atomic.AddInt64(&totalSize, size)
						atomic.AddInt64(&totalFiles, 1)
						atomic.AddInt64(&s.FilesScanned, 1)
						atomic.AddInt64(&s.BytesScanned, size)
						
						dirSize += size
						dirFiles++

						statsMu.Lock()
						s.updateFileStats(fullPath, size, topFiles, categories)
						statsMu.Unlock()
					}
				}

				statsMu.Lock()
				folderStats[path] = &models.FolderResult{
					Path:      path,
					SizeBytes: dirSize,
					FileCount: dirFiles,
				}
				
				// Report progress every 500ms
				if time.Since(lastReport) > 500*time.Millisecond && s.OnProgress != nil {
					s.CurrentPath = path
					s.OnProgress(ProgressUpdate{
						FilesScanned: atomic.LoadInt64(&s.FilesScanned),
						BytesScanned: atomic.LoadInt64(&s.BytesScanned),
						CurrentPath:  path,
						IsRunning:    true,
						StartTime:    s.StartTime,
					})
					lastReport = time.Now()
				}
				statsMu.Unlock()
				
				pending.Done()
			}
		}()
	}

	pending.Add(1)
	work <- basePath
	pending.Wait()
	close(work)

	log.Printf("Scan walk finished. Propagating sizes...")
	s.propagateSizes(folderStats)

	durationMs := time.Since(startTime).Milliseconds()
	log.Printf("Optimized scan completed in %d ms. Found %d files.", durationMs, totalFiles)

	return s.saveSnapshot(totalSize, int(totalFiles), durationMs, folderStats, topFiles, categories)
}

func (s *Scanner) updateFileStats(path string, size int64, topFiles map[string][]models.TopFileResult, categories map[string]*models.CategoryResult) {
	// 1. Determine Category
	lowerPath := strings.ToLower(path)
	ext := strings.ToLower(filepath.Ext(path))
	cat := ""

	// Priority Heuristics (Path-based "Purpose")
	if strings.Contains(lowerPath, "/timemachine/") || strings.Contains(lowerPath, "/backups/") || 
	   strings.Contains(lowerPath, ".sparsebundle/") || strings.Contains(lowerPath, ".backupbundle/") {
		cat = "Backups"
	} else if strings.Contains(lowerPath, "/docker/") || strings.Contains(lowerPath, "/.plex/") {
		cat = "System"
	}

	// Extension-based ("Format") if no priority match
	if cat == "" {
		switch ext {
		case ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".m2ts": cat = "Video"
		case ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma": cat = "Audio"
		case ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".tiff", ".heic", ".heif": cat = "Images"
		case ".zip", ".tar", ".gz", ".rar", ".7z", ".iso", ".bz2", ".xz", ".dmg", ".pkg", ".deb", ".rpm", ".zim", ".pst", ".ost": cat = "Archives"
		case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".rtf": cat = "Documents"
		case ".bak", ".old", ".tmp": cat = "Backups"
		case ".db", ".sqlite", ".sqlite3", ".sql", ".log", ".env", ".json", ".yaml", ".yml", ".xml", ".conf", ".config": cat = "System"
		default: cat = "Other"
		}
	}

	// 2. Per-Category Top Files (Keep top 50 per category)
	catTop := topFiles[cat]
	if len(catTop) < 50 || size > catTop[len(catTop)-1].SizeBytes {
		catTop = append(catTop, models.TopFileResult{Path: path, SizeBytes: size, Category: cat})
		sort.Slice(catTop, func(i, j int) bool {
			return catTop[i].SizeBytes > catTop[j].SizeBytes
		})
		if len(catTop) > 50 {
			catTop = catTop[:50]
		}
		topFiles[cat] = catTop
	}

	// 3. Update Category Stats
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

func (s *Scanner) saveSnapshot(totalSize int64, totalFiles int, durationMs int64, folderStats map[string]*models.FolderResult, topFiles map[string][]models.TopFileResult, categories map[string]*models.CategoryResult) error {
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

	// Batch insert folders
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

	// Batch insert top files (all categories)
	stmt, err = tx.Preparex("INSERT INTO top_files (snapshot_id, path, size_bytes, category) VALUES (?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("failed to prepare top files statement: %w", err)
	}
	for _, catList := range topFiles {
		for _, f := range catList {
			_, err = stmt.Exec(snapshotID, f.Path, f.SizeBytes, f.Category)
			if err != nil {
				stmt.Close()
				return fmt.Errorf("failed to execute top file insert: %w", err)
			}
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
