package api

import (
	"encoding/json"
	"net/http"
	"os"
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
}

func NewAPI(db *sqlx.DB, s *scanner.Scanner, sched *scheduler.Scheduler) *API {
	return &API{
		db:        db,
		scanner:   s,
		scheduler: sched,
	}
}

func (a *API) RegisterRoutes(r chi.Router) {
	r.Get("/stats", a.getStats)
	r.Get("/history", a.getHistory)
	r.Get("/history/folder", a.getFolderHistory)
	r.Delete("/history/{id}", a.deleteSnapshot)
	r.Post("/scan/start", a.startScan)
	r.Get("/settings", a.getSettings)
}

func (a *API) getStats(w http.ResponseWriter, r *http.Request) {
	// Get latest snapshot
	var snapshot models.Snapshot
	hasSnapshot := true
	err := a.db.Get(&snapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")
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
		"snapshot":     nil,
		"folders":      folders,
		"topFiles":     topFiles,
		"categories":   categories,
		"isScanning":   a.scanner.IsRunning,
		"filesScanned": a.scanner.FilesScanned,
		"bytesScanned": a.scanner.BytesScanned,
		"currentPath":  a.scanner.CurrentPath,
		"startTime":    a.scanner.StartTime,
		"nextScanTime": a.scheduler.NextScanTime,
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
		Timestamp time.Time `db:"timestamp" json:"timestamp"`
		SizeBytes int64     `db:"size_bytes" json:"sizeBytes"`
	}
	var history []HistoryPoint

	query := `
		SELECT s.timestamp, fs.size_bytes 
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
