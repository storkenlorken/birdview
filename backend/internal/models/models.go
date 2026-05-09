package models

import "time"

type Snapshot struct {
	ID             int       `db:"id" json:"id"`
	Timestamp      time.Time `db:"timestamp" json:"timestamp"`
	TotalSizeBytes int64     `db:"total_size_bytes" json:"totalSizeBytes"`
	TotalFiles     int       `db:"total_files" json:"totalFiles"`
	DurationMs     int64     `db:"duration_ms" json:"durationMs"`
}

type FolderSnapshot struct {
	ID         int    `db:"id" json:"id"`
	SnapshotID int    `db:"snapshot_id" json:"snapshotId"`
	Path       string `db:"path" json:"path"`
	SizeBytes  int64  `db:"size_bytes" json:"sizeBytes"`
	FileCount  int    `db:"file_count" json:"fileCount"`
}

type TopFile struct {
	ID         int    `db:"id" json:"id"`
	SnapshotID int    `db:"snapshot_id" json:"snapshotId"`
	Path       string `db:"path" json:"path"`
	SizeBytes  int64  `db:"size_bytes" json:"sizeBytes"`
}

type CategorySnapshot struct {
	ID         int    `db:"id" json:"id"`
	SnapshotID int    `db:"snapshot_id" json:"snapshotId"`
	Category   string `db:"category" json:"category"`
	SizeBytes  int64  `db:"size_bytes" json:"sizeBytes"`
	FileCount  int    `db:"file_count" json:"fileCount"`
}

type ScanResult struct {
	TotalSizeBytes int64
	TotalFiles     int
	Folders        []FolderResult
	TopFiles       []TopFileResult
	Categories     map[string]*CategoryResult
}

type FolderResult struct {
	Path      string
	SizeBytes int64
	FileCount int
}

type TopFileResult struct {
	Path      string
	SizeBytes int64
}

type CategoryResult struct {
	Category  string
	SizeBytes int64
	FileCount int
}
