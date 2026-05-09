package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"gitlab.qvarnstrom.org/storken/birdview/internal/api"
	"gitlab.qvarnstrom.org/storken/birdview/internal/db"
	"gitlab.qvarnstrom.org/storken/birdview/internal/scanner"
	"gitlab.qvarnstrom.org/storken/birdview/internal/scheduler"
)

func main() {
	// Initialize Database
	dbPath := os.Getenv("BIRDVIEW_DB_PATH")
	if dbPath == "" {
		dbPath = "./data/birdview.db"
	}

	dataPath := os.Getenv("BIRDVIEW_DATA_PATH")
	if dataPath == "" {
		dataPath = "/data" // Default for Docker
		if _, err := os.Stat(dataPath); os.IsNotExist(err) {
			dataPath = "." // Fallback for local development
		}
	}

	// Ensure DB directory exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	database, err := db.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize Scanner and Scheduler
	scanService := scanner.NewScanner(database)
	sched := scheduler.NewScheduler(scanService)
	
	// Start scheduler (runs every 6 hours by default)
	sched.Start(6*time.Hour, dataPath)
	defer sched.Stop()

	// Initialize API
	apiService := api.NewAPI(database, scanService)

	// Initialize Router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS Middleware for development
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
			if r.Method == "OPTIONS" {
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// API Routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("pong"))
		})
		apiService.RegisterRoutes(r)
	})

	// Serve Frontend Static Files
	frontendDir := os.Getenv("BIRDVIEW_FRONTEND_DIR")
	if frontendDir == "" {
		frontendDir = "../frontend/dist" // Default for local dev if running from backend dir
	}
	
	// Fallback to serving the frontend
	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		// Serve static assets if file exists, else serve index.html (SPA routing)
		path := filepath.Join(frontendDir, req.URL.Path)
		info, err := os.Stat(path)
		
		if os.IsNotExist(err) || info.IsDir() {
			// Fallback to index.html for SPA
			http.ServeFile(w, req, filepath.Join(frontendDir, "index.html"))
			return
		}

		http.ServeFile(w, req, path)
	})


	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		fmt.Printf("Server listening on port %s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
}
