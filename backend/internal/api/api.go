package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/storkenlorken/birdview/internal/models"
	"github.com/storkenlorken/birdview/internal/scanner"
	"github.com/storkenlorken/birdview/internal/scheduler"
)

type API struct {
	db        *sqlx.DB
	scanner   *scanner.Scanner
	scheduler *scheduler.Scheduler
	clients   map[chan scanner.ProgressUpdate]bool
	message   chan scanner.ProgressUpdate
	clientsMu sync.RWMutex
}

func NewAPI(db *sqlx.DB, s *scanner.Scanner, sched *scheduler.Scheduler) *API {
	api := &API{
		db:        db,
		scanner:   s,
		scheduler: sched,
		clients:   make(map[chan scanner.ProgressUpdate]bool),
		message:   make(chan scanner.ProgressUpdate, 100),
	}

	// Connect scanner to broadcaster (non-blocking)
	s.OnProgress = func(update scanner.ProgressUpdate) {
		select {
		case api.message <- update:
		default:
			// Drop if buffer is full (high traffic)
		}
	}

	// Start broadcaster
	go func() {
		for {
			msg := <-api.message
			api.clientsMu.RLock()
			for client := range api.clients {
				select {
				case client <- msg:
				default:
					// Client too slow, drop message
				}
			}
			api.clientsMu.RUnlock()
		}
	}()

	return api
}

func (a *API) RegisterRoutes(r chi.Router) {
	r.Get("/stats", a.getStats)
	r.Get("/history", a.getHistory)
	r.Get("/history/folder", a.getFolderHistory)
	r.Delete("/history/{id}", a.deleteSnapshot)
	r.Post("/scan/start", a.startScan)
	r.Get("/settings", a.getSettings)
	r.Post("/settings", a.updateSettings)
	r.Get("/events", a.getEvents)
	r.Get("/search", a.search)
}

// ... existing handlers ...

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var settings map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	tx, err := a.db.Beginx()
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	for k, v := range settings {
		valBytes, _ := json.Marshal(v)
		_, err = tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, string(valBytes))
		if err != nil {
			http.Error(w, "Failed to update settings", http.StatusInternalServerError)
			return
		}

		// Special handling for scan interval
		if k == "scan_interval_days" {
			// JSON numbers are float64 in Go map[string]interface{}
			var days int
			switch d := v.(type) {
			case float64:
				days = int(d)
			case int:
				days = d
			case string:
				// Sometimes numeric strings are sent
				if val, err := strconv.Atoi(d); err == nil {
					days = val
				}
			}

			if days > 0 {
				newInterval := time.Duration(days) * 24 * time.Hour
				a.scheduler.UpdateInterval(newInterval)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Failed to commit settings", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "Settings updated"})
}

func (a *API) getStats(w http.ResponseWriter, r *http.Request) {
	snapshotID := r.URL.Query().Get("id")
	var snapshot models.Snapshot
	hasSnapshot := true
	var err error

	if snapshotID != "" {
		err = a.db.Get(&snapshot, "SELECT * FROM snapshots WHERE id = ?", snapshotID)
	} else {
		err = a.db.Get(&snapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")
	}

	if err != nil {
		hasSnapshot = false
	}

	var folders []models.FolderSnapshot
	var topFiles []models.TopFile
	var categories []models.CategorySnapshot

	if hasSnapshot {
		// Get folder sizes for that snapshot
		a.db.Select(&folders, "SELECT * FROM folder_snapshots WHERE snapshot_id = ?", snapshot.ID)
		// Get top files
		a.db.Select(&topFiles, "SELECT * FROM top_files WHERE snapshot_id = ? ORDER BY size_bytes DESC", snapshot.ID)
		// Get categories
		a.db.Select(&categories, "SELECT * FROM category_snapshots WHERE snapshot_id = ?", snapshot.ID)
	}

	response := map[string]interface{}{
		"snapshot":      nil,
		"folders":       folders,
		"topFiles":      topFiles,
		"categories":    categories,
		"isScanning":    a.scanner.IsRunning,
		"filesScanned":  a.scanner.FilesScanned,
		"bytesScanned":  a.scanner.BytesScanned,
		"currentPath":   a.scanner.CurrentPath,
		"startTime":     a.scanner.StartTime,
		"nextScanTime":  a.scheduler.GetNextScanTime(),
		"dataPathError": a.scheduler.GetDataPathError(),
	}
	if hasSnapshot {
		response["snapshot"] = snapshot
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (a *API) getHistory(w http.ResponseWriter, r *http.Request) {
	var snapshots []models.Snapshot
	err := a.db.Select(&snapshots, "SELECT * FROM snapshots ORDER BY timestamp ASC")
	if err != nil {
		http.Error(w, "Failed to get history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshots)
}

func (a *API) getFolderHistory(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "Path is required", http.StatusBadRequest)
		return
	}

	type HistoryPoint struct {
		SnapshotID int       `db:"snapshot_id" json:"snapshotId"`
		Timestamp  time.Time `db:"timestamp" json:"timestamp"`
		SizeBytes  int64     `db:"size_bytes" json:"sizeBytes"`
	}
	var history []HistoryPoint

	query := `
		SELECT s.id as snapshot_id, s.timestamp, fs.size_bytes 
		FROM folder_snapshots fs
		JOIN snapshots s ON fs.snapshot_id = s.id
		WHERE fs.path = ?
		ORDER BY s.timestamp ASC
	`
	err := a.db.Select(&history, query, path)
	if err != nil {
		http.Error(w, "Failed to get folder history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func (a *API) deleteSnapshot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	_, err := a.db.Exec("DELETE FROM snapshots WHERE id = ?", id)
	if err != nil {
		http.Error(w, "Failed to delete snapshot", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "Snapshot deleted"})
}

func (a *API) startScan(w http.ResponseWriter, r *http.Request) {
	if a.scanner.IsRunning {
		http.Error(w, "Scan already in progress", http.StatusConflict)
		return
	}

	dataPath := os.Getenv("BIRDVIEW_DATA_PATH")
	if dataPath == "" {
		dataPath = "/data"
	}

	// Trigger async scan
	go func() {
		a.scanner.RunScan(dataPath)
	}()

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "Scan started"})
}

func (a *API) getSettings(w http.ResponseWriter, r *http.Request) {
	type Setting struct {
		Key   string `db:"key"`
		Value string `db:"value"`
	}
	var settings []Setting
	err := a.db.Select(&settings, "SELECT key, value FROM settings")
	if err != nil {
		http.Error(w, "Failed to get settings", http.StatusInternalServerError)
		return
	}

	res := make(map[string]interface{})
	for _, s := range settings {
		var val interface{}
		if err := json.Unmarshal([]byte(s.Value), &val); err == nil {
			res[s.Key] = val
		} else {
			res[s.Key] = s.Value
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (a *API) getEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	client := make(chan scanner.ProgressUpdate, 10)
	a.clientsMu.Lock()
	a.clients[client] = true
	a.clientsMu.Unlock()

	defer func() {
		a.clientsMu.Lock()
		delete(a.clients, client)
		a.clientsMu.Unlock()
		close(client)
	}()

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Send initial state
	if a.scanner.IsRunning {
		initial := scanner.ProgressUpdate{
			FilesScanned: a.scanner.FilesScanned,
			BytesScanned: a.scanner.BytesScanned,
			CurrentPath:  a.scanner.CurrentPath,
			IsRunning:    true,
			StartTime:    a.scanner.StartTime,
		}
		data, _ := json.Marshal(initial)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	for {
		select {
		case msg := <-client:
			data, _ := json.Marshal(msg)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (a *API) search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	// Find latest snapshot ID
	var snapshotID int
	err := a.db.Get(&snapshotID, "SELECT id FROM snapshots ORDER BY timestamp DESC LIMIT 1")
	if err != nil {
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	type SearchResult struct {
		Path      string `json:"path"`
		SizeBytes int64  `json:"sizeBytes"`
		Type      string `json:"type"` // 'folder' or 'file'
	}
	results := []SearchResult{}

	// Search folders
	var folders []struct {
		Path      string `db:"path"`
		SizeBytes int64  `db:"size_bytes"`
	}
	a.db.Select(&folders, "SELECT path, size_bytes FROM folder_snapshots WHERE snapshot_id = ? AND path LIKE ? LIMIT 5", snapshotID, "%"+query+"%")
	for _, f := range folders {
		results = append(results, SearchResult{Path: f.Path, SizeBytes: f.SizeBytes, Type: "folder"})
	}

	// Search files
	var files []struct {
		Path      string `db:"path"`
		SizeBytes int64  `db:"size_bytes"`
	}
	a.db.Select(&files, "SELECT path, size_bytes FROM top_files WHERE snapshot_id = ? AND path LIKE ? LIMIT 5", snapshotID, "%"+query+"%")
	for _, f := range files {
		results = append(results, SearchResult{Path: f.Path, SizeBytes: f.SizeBytes, Type: "file"})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
