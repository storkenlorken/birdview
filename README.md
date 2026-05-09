# BirdView

BirdView is a self-hosted Docker-based storage visualization and analytics platform for home servers and NAS environments. It scans a mounted data directory, analyzes storage usage recursively, stores historical snapshots, and presents the information in a beautiful, macOS-inspired web UI with interactive visualizations.

## Features

- **Fast Scanning**: Written in Go for highly concurrent, memory-efficient recursive directory scanning.
- **MacOS-Inspired UI**: Beautiful frosted glass interface built with React, Tailwind CSS, and Apache ECharts.
- **Historical Tracking**: Stores snapshots in an embedded SQLite database to track growth over time.
- **Easy Deployment**: Ships as a single Docker container with an embedded frontend, making deployment effortless.
- **Exclusion Support**: Automatically excludes `.git`, `node_modules`, `.DS_Store`, and more.

## Getting Started

### Using Docker Compose (Recommended)

1. Clone this repository or copy the `docker-compose.yml` file.
2. Edit `docker-compose.yml` to point to the directory you want to scan:
   ```yaml
   volumes:
     - /path/to/your/data:/data:ro # <-- Change /path/to/your/data
     - birdview_data:/app/data
   ```
3. Start the container:
   ```bash
   docker compose up -d
   ```
4. Open your browser and navigate to `http://localhost:8080`.

### Local Development

#### Prerequisites
- Go 1.21+
- Node.js 20+

#### Running the Backend
```bash
cd backend
BIRDVIEW_DB_PATH=./data/birdview.db BIRDVIEW_DATA_PATH=/path/to/scan go run cmd/server/main.go
```

#### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will proxy API requests to `http://localhost:8080`.

## License

MIT
# birdview
