package scheduler

import (
	"fmt"
	"log"
	"os"
	"sync"
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
	
	// Protected by mu
	mu            sync.RWMutex
	nextScanTime  time.Time
	dataPathError string
	
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

// Thread-safe getters for protected fields
func (s *Scheduler) GetNextScanTime() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.nextScanTime
}

func (s *Scheduler) GetDataPathError() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dataPathError
}

func (s *Scheduler) Start(interval time.Duration, dataPath string) {
	s.interval = interval
	s.dataPath = dataPath

	go func() {
		// 1. Calculate the actual time remaining until the next scan
		var lastSnapshot models.Snapshot
		err := s.db.Get(&lastSnapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")

		initialDelay := time.Duration(0)
		if err == nil {
			timeSinceLastScan := time.Since(lastSnapshot.Timestamp)
			if timeSinceLastScan < s.interval {
				initialDelay = s.interval - timeSinceLastScan
				log.Printf("Last scan was %v ago. Next scheduled scan in %v.", timeSinceLastScan.Round(time.Minute), initialDelay.Round(time.Minute))
			} else {
				log.Printf("Last scan was %v ago (> %v). Starting immediate scan.", timeSinceLastScan.Round(time.Minute), s.interval)
			}
		}

		s.mu.Lock()
		s.nextScanTime = time.Now().Add(initialDelay)
		s.mu.Unlock()

		// 2. Handle initial delay before starting the regular ticker
		if initialDelay > 0 {
			select {
			case <-time.After(initialDelay):
				// Ready for first scan
			case <-s.quit:
				return
			}
		}

		// 3. Main Loop
		s.ticker = time.NewTicker(s.interval)
		
		// Run first scan immediately if we didn't wait (or after delay)
		s.runScheduledScan()

		for {
			select {
			case <-s.ticker.C:
				s.runScheduledScan()
			case <-s.quit:
				if s.ticker != nil {
					s.ticker.Stop()
				}
				return
			}
		}
	}()
}

func (s *Scheduler) runScheduledScan() {
	log.Println("Starting scheduled scan...")
	if err := validateDataPath(s.dataPath); err != nil {
		s.mu.Lock()
		s.dataPathError = err.Error()
		s.mu.Unlock()
		log.Printf("Data path validation failed: %v", err)
	} else {
		s.mu.Lock()
		s.dataPathError = ""
		s.mu.Unlock()
		
		if err := s.scanner.RunScan(s.dataPath); err != nil {
			log.Printf("Scheduled scan failed: %v", err)
		} else {
			log.Println("Scheduled scan completed successfully.")
		}
	}
	
	s.mu.Lock()
	s.nextScanTime = time.Now().Add(s.interval)
	s.mu.Unlock()
}

func (s *Scheduler) UpdateInterval(interval time.Duration) {
	log.Printf("Updating scan interval to %v", interval)
	s.interval = interval
	if s.ticker != nil {
		s.ticker.Reset(interval)
	}
	s.mu.Lock()
	s.nextScanTime = time.Now().Add(interval)
	s.mu.Unlock()
}

func (s *Scheduler) Stop() {
	if s.quit != nil {
		close(s.quit)
	}
}

func validateDataPath(path string) error {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return fmt.Errorf("path %q does not exist — check your volume mount", path)
	}
	if err != nil {
		return fmt.Errorf("cannot access %q: %v", path, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%q is not a directory", path)
	}
	// We'll remove the "empty folder" check as it's too aggressive
	return nil
}
