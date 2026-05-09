package scheduler

import (
	"log"
	"time"

	"gitlab.qvarnstrom.org/storken/birdview/internal/scanner"
)

type Scheduler struct {
	scanner *scanner.Scanner
	ticker  *time.Ticker
	quit    chan struct{}
}

func NewScheduler(s *scanner.Scanner) *Scheduler {
	return &Scheduler{
		scanner: s,
		quit:    make(chan struct{}),
	}
}

func (s *Scheduler) Start(interval time.Duration, dataPath string) {
	s.ticker = time.NewTicker(interval)
	go func() {
		// Run an initial scan immediately
		log.Println("Running initial scan...")
		if err := s.scanner.RunScan(dataPath); err != nil {
			log.Printf("Initial scan failed: %v", err)
		} else {
			log.Println("Initial scan completed successfully.")
		}

		for {
			select {
			case <-s.ticker.C:
				log.Println("Starting scheduled scan...")
				if err := s.scanner.RunScan(dataPath); err != nil {
					log.Printf("Scheduled scan failed: %v", err)
				} else {
					log.Println("Scheduled scan completed successfully.")
				}
			case <-s.quit:
				s.ticker.Stop()
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
