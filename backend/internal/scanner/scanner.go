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
	
	// Thread-safe status
	isRunning    atomic.Bool
	filesScanned atomic.Int64
	bytesScanned atomic.Int64
	currentPath  atomic.Value // holds string
	startTime    atomic.Value // holds time.Time
	
	OnProgress   func(ProgressUpdate)
	scanMu       sync.Mutex
}

func NewScanner(db *sqlx.DB) *Scanner {
	s := &Scanner{
		db: db,
	}
	s.currentPath.Store("")
	s.startTime.Store(time.Time{})
	return s
}

func (s *Scanner) GetStatus() ProgressUpdate {
	startTime, _ := s.startTime.Load().(time.Time)
	currentPath, _ := s.currentPath.Load().(string)
	
	return ProgressUpdate{
		FilesScanned: s.filesScanned.Load(),
		BytesScanned: s.bytesScanned.Load(),
		CurrentPath:  currentPath,
		IsRunning:    s.isRunning.Load(),
		StartTime:    startTime,
	}
}

func (s *Scanner) RunScan(basePath string) error {
	s.scanMu.Lock()
	if s.isRunning.Load() {
		s.scanMu.Unlock()
		return fmt.Errorf("scan already in progress")
	}
	s.isRunning.Store(true)
	s.scanMu.Unlock()

	s.filesScanned.Store(0)
	s.bytesScanned.Store(0)
	startTime := time.Now()
	s.startTime.Store(startTime)
	
	if s.OnProgress != nil {
		s.OnProgress(ProgressUpdate{IsRunning: true, StartTime: startTime})
	}
	defer func() {
		s.isRunning.Store(false)
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
		s.currentPath.Store("")
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
	numWorkers := 16 
	
	// Stats tracking
	var statsMu sync.Mutex
	folderStats := make(map[string]*models.FolderResult)
	topFiles := make(map[string][]models.TopFileResult)
	categories := make(map[string]*models.CategoryResult)
	
	// Symlink Loop Protection: Track visited Inodes
	visitedInodes := sync.Map{}
	
	lastReport := time.Now()

	for i := 0; i < numWorkers; i++ {
		go func() {
			for path := range work {
				// 1. Resolve path (following symlinks)
				info, err := os.Stat(path)
				if err != nil {
					// Silent skip for broken symlinks or restricted folders
					pending.Done()
					continue
				}

				// If it's not a directory, skip it (should have been handled in the parent's loop)
				if !info.IsDir() {
					pending.Done()
					continue
				}

				// Check for circular references (via hard links, bind mounts, or symlinks)
				if stat, ok := info.Sys().(*syscall.Stat_t); ok {
					inode := stat.Ino
					if _, seen := visitedInodes.LoadOrStore(inode, true); seen {
						pending.Done()
						continue
					}
				}

				// 2. Open directory
				f, err := os.Open(path)
				if err != nil {
					pending.Done()
					continue
				}
				entries, err := f.ReadDir(-1)
				f.Close()
				
				if err != nil {
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
					
					// If it's a directory OR a symlink (which might point to a directory)
					if d.IsDir() || (d.Type()&os.ModeSymlink != 0) {
						pending.Add(1)
						work <- fullPath
					} else {
						finfo, err := d.Info()
						if err != nil { continue }
						var size int64
						if stat, ok := finfo.Sys().(*syscall.Stat_t); ok {
							size = stat.Blocks * 512
						} else {
							size = finfo.Size()
						}
						
						atomic.AddInt64(&totalSize, size)
						atomic.AddInt64(&totalFiles, 1)
						s.filesScanned.Add(1)
						s.bytesScanned.Add(size)
						
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
				
				if time.Since(lastReport) > 500*time.Millisecond && s.OnProgress != nil {
					s.currentPath.Store(path)
					s.OnProgress(ProgressUpdate{
						FilesScanned: s.filesScanned.Load(),
						BytesScanned: s.bytesScanned.Load(),
						CurrentPath:  path,
						IsRunning:    true,
						StartTime:    startTime,
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
	log.Printf("Scan completed in %d ms. Found %d files.", durationMs, totalFiles)

	return s.saveSnapshot(totalSize, int(totalFiles), durationMs, folderStats, topFiles, categories)
}

func (s *Scanner) updateFileStats(path string, size int64, topFiles map[string][]models.TopFileResult, categories map[string]*models.CategoryResult) {
	lowerPath := strings.ToLower(path)
	ext := strings.ToLower(filepath.Ext(path))
	cat := ""

	if strings.Contains(lowerPath, "/timemachine/") || strings.Contains(lowerPath, "/backups/") || 
	   strings.Contains(lowerPath, ".sparsebundle/") || strings.Contains(lowerPath, ".backupbundle/") {
		cat = "Backups"
	} else if strings.Contains(lowerPath, "/docker/") || strings.Contains(lowerPath, "/.plex/") {
		cat = "System"
	}

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

	if _, exists := categories[cat]; !exists {
		categories[cat] = &models.CategoryResult{Category: cat}
	}
	categories[cat].SizeBytes += size
	categories[cat].FileCount++
}

func (s *Scanner) propagateSizes(folderStats map[string]*models.FolderResult) {
	paths := make([]string, 0, len(folderStats))
	for p := range folderStats {
		paths = append(paths, p)
	}
	
	sort.Slice(paths, func(i, j int) bool {
		return strings.Count(paths[i], "/") > strings.Count(paths[j], "/")
	})

	for _, path := range paths {
		if path == "/" || path == "." { continue }
		
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

	res, err := tx.Exec("INSERT INTO snapshots (total_size_bytes, total_files, duration_ms) VALUES (?, ?, ?)", totalSize, totalFiles, durationMs)
	if err != nil {
		return fmt.Errorf("failed to insert snapshot: %w", err)
	}
	snapshotID, _ := res.LastInsertId()

	// Optimized Batch Insert for Folders
	var folderQuery strings.Builder
	folderQuery.WriteString("INSERT INTO folder_snapshots (snapshot_id, path, size_bytes, file_count) VALUES ")
	values := make([]interface{}, 0, 800)
	count := 0
	
	// Convert map to slice for stable iteration
	statsList := make([]*models.FolderResult, 0, len(folderStats))
	for _, s := range folderStats {
		statsList = append(statsList, s)
	}

	for i, stat := range statsList {
		if count > 0 {
			folderQuery.WriteString(", ")
		}
		folderQuery.WriteString("(?, ?, ?, ?)")
		values = append(values, snapshotID, stat.Path, stat.SizeBytes, stat.FileCount)
		count++

		if count >= 200 || i == len(statsList)-1 {
			_, err = tx.Exec(folderQuery.String(), values...)
			if err != nil {
				return fmt.Errorf("failed to batch insert folders: %w", err)
			}
			folderQuery.Reset()
			folderQuery.WriteString("INSERT INTO folder_snapshots (snapshot_id, path, size_bytes, file_count) VALUES ")
			values = values[:0]
			count = 0
		}
	}

	// Batch insert top files
	var topQuery strings.Builder
	topQuery.WriteString("INSERT INTO top_files (snapshot_id, path, size_bytes, category) VALUES ")
	topValues := make([]interface{}, 0, 800)
	count = 0
	
	allTopFiles := []models.TopFileResult{}
	for _, list := range topFiles {
		allTopFiles = append(allTopFiles, list...)
	}

	for i, f := range allTopFiles {
		if count > 0 {
			topQuery.WriteString(", ")
		}
		topQuery.WriteString("(?, ?, ?, ?)")
		topValues = append(topValues, snapshotID, f.Path, f.SizeBytes, f.Category)
		count++

		if count >= 200 || i == len(allTopFiles)-1 {
			_, err = tx.Exec(topQuery.String(), topValues...)
			if err != nil {
				return fmt.Errorf("failed to batch insert top files: %w", err)
			}
			topQuery.Reset()
			topQuery.WriteString("INSERT INTO top_files (snapshot_id, path, size_bytes, category) VALUES ")
			topValues = topValues[:0]
			count = 0
		}
	}

	// Batch insert categories (small enough for single insert)
	for _, c := range categories {
		_, err = tx.Exec("INSERT INTO category_snapshots (snapshot_id, category, size_bytes, file_count) VALUES (?, ?, ?, ?)", snapshotID, c.Category, c.SizeBytes, c.FileCount)
		if err != nil {
			return fmt.Errorf("failed to insert category: %w", err)
		}
	}

	return tx.Commit()
}
