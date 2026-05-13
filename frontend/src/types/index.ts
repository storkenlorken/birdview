export interface FolderSnapshot {
  id: number;
  snapshotId: number;
  path: string;
  sizeBytes: number;
  fileCount: number;
}

export interface TopFile {
  path: string;
  sizeBytes: number;
  category: string;
}

export interface Category {
  category: string;
  sizeBytes: number;
  fileCount: number;
}

export interface Snapshot {
  id: number;
  totalSizeBytes: number;
  totalFiles: number;
  timestamp: string;
  durationMs: number;
}

export interface StatsResponse {
  snapshot: Snapshot;
  folders: FolderSnapshot[];
  topFiles: TopFile[];
  categories: Category[];
  isScanning: boolean;
  filesScanned: number;
  bytesScanned: number;
  currentPath: string;
  startTime: string;
  nextScanTime: string;
  dataPathError: string;
  version: string;
}
