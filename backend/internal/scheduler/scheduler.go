package scheduler

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/storkenlorken/birdview/internal/models"
	"github.com/storkenlorken/birdview/internal/scanner"
)

type Scheduler struct {
	scanner       *scanner.Scanner
	db            *sqlx.DB
	ticker        *time.Ticker
	quit          chan struct{}
	NextScanTime  time.Time
	DataPathError string
	dataPath      string
	interval      time.Duration
}

func NewScheduler(s *scanner.Scanner, db *sqlx.DB) *Scheduler {
	return &Scheduler{
		scanner: s,
		db:      db,
		quit:    make(chan struct{}),
	}
}

func (s *Scheduler) Start(interval time.Duration, dataPath string) {
	s.interval = interval
	s.dataPath = dataPath

	go func() {
		// Check if we already have a recent scan in the DB
		var lastSnapshot models.Snapshot
		err := s.db.Get(&lastSnapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")

		shouldScanNow := true
		if err == nil {
			timeSinceLastScan := time.Since(lastSnapshot.Timestamp)
			if timeSinceLastScan < s.interval {
				log.Printf("Last scan was %v ago (Interval: %v). Skipping startup scan.", timeSinceLastScan.Round(time.Minute), s.interval)
				shouldScanNow = false
			}
		}

		if shouldScanNow {
			if err := validateDataPath(s.dataPath); err != nil {
				s.DataPathError = err.Error()
				log.Printf("Data path validation failed: %v — skipping scan.", err)
			} else {
				s.DataPathError = ""
				log.Println("Running initial scan...")
				if err := s.scanner.RunScan(s.dataPath); err != nil {
					log.Printf("Initial scan failed: %v", err)
				} else {
					log.Println("Initial scan completed successfully.")
				}
			}
		}

		s.NextScanTime = time.Now().Add(s.interval)
		s.ticker = time.NewTicker(s.interval)
		for {
			select {
			case <-s.ticker.C:
				log.Println("Starting scheduled scan...")
				if err := validateDataPath(s.dataPath); err != nil {
					s.DataPathError = err.Error()
					log.Printf("Data path validation failed: %v — skipping scheduled scan.", err)
				} else {
					s.DataPathError = ""
					if err := s.scanner.RunScan(s.dataPath); err != nil {
						log.Printf("Scheduled scan failed: %v", err)
					} else {
						log.Println("Scheduled scan completed successfully.")
					}
				}
				s.NextScanTime = time.Now().Add(s.interval)
			case <-s.quit:
				if s.ticker != nil {
					s.ticker.Stop()
				}
				return
			}
		}
	}()
}

func (s *Scheduler) UpdateInterval(interval time.Duration) {
	log.Printf("Updating scan interval to %v", interval)
	s.interval = interval
	if s.ticker != nil {
		s.ticker.Reset(interval)
	}
	s.NextScanTime = time.Now().Add(interval)
}

func (s *Scheduler) Stop() {
	if s.quit != nil {
		close(s.quit)
	}
}

// validateDataPath checks that the given path exists, is a directory, and is readable.
func validateDataPath(path string) error {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return fmt.Errorf("path %q does not exist — check your volume mount in docker-compose.yml", path)
	}
	if err != nil {
		return fmt.Errorf("cannot access %q: %v", path, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%q is not a directory", path)
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return fmt.Errorf("cannot read %q: %v — check PUID/PGID permissions", path, err)
	}
	if len(entries) == 0 {
		return fmt.Errorf("%q is empty — is your volume mounted correctly?", path)
	}
	return nil
}
