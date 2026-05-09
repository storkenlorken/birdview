package scheduler

import (
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/storkenlorken/birdview/internal/models"
	"github.com/storkenlorken/birdview/internal/scanner"
)

type Scheduler struct {
	scanner      *scanner.Scanner
	db           *sqlx.DB
	ticker       *time.Ticker
	quit         chan struct{}
	NextScanTime time.Time
}

func NewScheduler(s *scanner.Scanner, db *sqlx.DB) *Scheduler {
	return &Scheduler{
		scanner: s,
		db:      db,
		quit:    make(chan struct{}),
	}
}

func (s *Scheduler) Start(interval time.Duration, dataPath string) {
	go func() {
		// Check if we already have a recent scan in the DB
		var lastSnapshot models.Snapshot
		err := s.db.Get(&lastSnapshot, "SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")
		
		shouldScanNow := true
		if err == nil {
			timeSinceLastScan := time.Since(lastSnapshot.Timestamp)
			if timeSinceLastScan < interval {
				log.Printf("Last scan was %v ago (Interval: %v). Skipping startup scan.", timeSinceLastScan.Round(time.Minute), interval)
				shouldScanNow = false
			}
		}

		if shouldScanNow {
			log.Println("Running initial scan...")
			if err := s.scanner.RunScan(dataPath); err != nil {
				log.Printf("Initial scan failed: %v", err)
			} else {
				log.Println("Initial scan completed successfully.")
			}
		}

		s.NextScanTime = time.Now().Add(interval)
		s.ticker = time.NewTicker(interval)
		for {
			select {
			case <-s.ticker.C:
				log.Println("Starting scheduled scan...")
				if err := s.scanner.RunScan(dataPath); err != nil {
					log.Printf("Scheduled scan failed: %v", err)
				} else {
					log.Println("Scheduled scan completed successfully.")
				}
				s.NextScanTime = time.Now().Add(interval)
			case <-s.quit:
				if s.ticker != nil {
					s.ticker.Stop()
				}
				return
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	if s.quit != nil {
		close(s.quit)
	}
}
