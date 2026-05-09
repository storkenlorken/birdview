package api

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/storken/birdview/internal/models"
	"github.com/storken/birdview/internal/scanner"
)

type API struct {
	db      *sqlx.DB
	scanner *scanner.Scanner
}

func NewAPI(db *sqlx.DB, s *scanner.Scanner) *API {
	return &API{
		db:      db,
		scanner: s,
	}
}

func (a *API) RegisterRoutes(r chi.Router) {
	r.Get("/stats", a.getStats)
	r.Get("/history", a.getHistory)
	r.Post("/scan/start", a.startScan)
	r.Get("/settings", a.getSettings)
}

func (a *API) getStats(w http.ResponseWriter, r *http.Request) {
	// Get latest snapshot
	var snapshot models.Snapshot
	err := a.db.Get(&snapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")
	if err != nil {
		http.Error(w, "No snapshots found", http.StatusNotFound)
		return
	}

	// Get folder sizes for that snapshot
	var folders []models.FolderSnapshot
	err = a.db.Select(&folders, "SELECT * FROM folder_snapshots WHERE snapshot_id = ?", snapshot.ID)
	if err != nil {
		http.Error(w, "Failed to get folders", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"snapshot": snapshot,
		"folders":  folders,
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
