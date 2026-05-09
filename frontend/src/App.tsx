import React, { useEffect, useState, useTransition } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { RefreshCw, HardDrive, PieChart as PieChartIcon, ChevronRight, File as FileIcon, History, Calendar, Clock, Trash2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

const queryClient = new QueryClient();

// Types
interface FolderSnapshot {
  id: number;
  snapshotId: number;
  path: string;
  sizeBytes: number;
  fileCount: number;
}

interface TopFile {
  path: string;
  sizeBytes: number;
  category: string;
}

interface Category {
  category: string;
  sizeBytes: number;
  fileCount: number;
}

interface Snapshot {
  id: number;
  totalSizeBytes: number;
  totalFiles: number;
  timestamp: string;
  durationMs: number;
}

interface StatsResponse {
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
}

// Helpers
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFoldersAtDepth(folders: FolderSnapshot[], parentPath: string) {
  return folders.filter(f => {
    if (f.path === parentPath) return false;
    if (!f.path.startsWith(parentPath === '/' ? '/' : parentPath + '/')) return false;

    const relativePath = parentPath === '/' ? f.path.substring(1) : f.path.substring(parentPath.length + 1);
    const parts = relativePath.split('/').filter(Boolean);
    return parts.length === 1;
  }).sort((a, b) => b.sizeBytes - a.sizeBytes);
}

// Components
function MacOSStorageBar({
  folders,
  totalSize,
  currentPath,
  onPathChange
}: {
  folders: FolderSnapshot[],
  totalSize: number,
  currentPath: string,
  onPathChange: (path: string) => void
}) {
  if (!folders.length) return null;

  const currentFolder = folders.find(f => f.path === currentPath) || { sizeBytes: totalSize };
  const subFolders = getFoldersAtDepth(folders, currentPath);

  const categories = subFolders.slice(0, 6);
  const topSize = categories.reduce((acc, curr) => acc + curr.sizeBytes, 0);
  const otherSize = Math.max(0, currentFolder.sizeBytes - topSize);

  if (otherSize > 0 && categories.length > 0) {
    categories.push({ id: -1, path: currentPath + '/Other', sizeBytes: otherSize, snapshotId: -1, fileCount: 0 });
  }

  const colors = [
    'bg-[#ff3b30]', 'bg-[#007aff]', 'bg-[#ffcc00]',
    'bg-[#4cd964]', 'bg-[#ff9500]', 'bg-[#af52de]', 'bg-[#8e8e93]',
  ];

  return (
    <div className="space-y-6">
      <div className="h-8 w-full rounded-xl overflow-hidden flex shadow-inner bg-black/5 p-1 border border-black/5">
        {categories.map((cat, i) => {
          const percentage = (cat.sizeBytes / currentFolder.sizeBytes) * 100;
          if (percentage < 0.5) return null;

          return (
            <button
              key={cat.path}
              onClick={() => cat.id !== -1 && onPathChange(cat.path)}
              style={{ width: `${percentage}%` }}
              className={`h-full ${colors[i % colors.length]} transition-all duration-300 hover:brightness-110 relative group first:rounded-l-lg last:rounded-r-lg`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                <div className="font-bold">{cat.path.split('/').pop() || 'Other'}</div>
                <div className="opacity-80">{formatBytes(cat.sizeBytes)} ({percentage.toFixed(1)}%)</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs sm:text-sm">
        {categories.map((cat, i) => (
          <button
            key={cat.path}
            onClick={() => cat.id !== -1 && onPathChange(cat.path)}
            className="flex items-center space-x-2 hover:bg-black/5 px-2 py-1 rounded-md transition-colors"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
            <span className="font-medium text-foreground/80">{cat.path.split('/').pop() || 'Other'}</span>
            <span className="text-muted-foreground tabular-nums">{formatBytes(cat.sizeBytes)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SubfolderList({ folders, currentPath, onPathChange }: { folders: FolderSnapshot[], currentPath: string, onPathChange: (path: string) => void }) {
  const subFolders = getFoldersAtDepth(folders, currentPath);

  if (subFolders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No subfolders found in this directory.</p>;
  }

  const largest = subFolders[0].sizeBytes || 1;

  const colors = [
    'bg-[#ff3b30]', 'bg-[#007aff]', 'bg-[#ffcc00]',
    'bg-[#4cd964]', 'bg-[#ff9500]', 'bg-[#af52de]', 'bg-[#8e8e93]',
  ];

  return (
    <div className="space-y-1">
      {subFolders.map((folder, i) => {
        const name = folder.path.split('/').pop() || folder.path;
        const pct = (folder.sizeBytes / largest) * 100;
        const hasChildren = folders.some(f =>
          f.path !== folder.path && f.path.startsWith(folder.path + '/')
        );

        return (
          <button
            key={folder.path}
            onClick={() => hasChildren && onPathChange(folder.path)}
            className={`w-full text-left group rounded-xl px-4 py-3 transition-all ${hasChildren
              ? 'hover:bg-black/5 cursor-pointer'
              : 'cursor-default opacity-50'
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[i % colors.length]}`} />
                <span className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                  {name}
                </span>
                {hasChildren && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                )}
              </div>
              <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {folder.fileCount.toLocaleString()} files
                </span>
                <span className="text-sm font-semibold tabular-nums w-20 text-right">
                  {formatBytes(folder.sizeBytes)}
                </span>
              </div>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[i % colors.length]} transition-all duration-500`}
                style={{ width: `${pct}%`, opacity: 0.7 }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Breadcrumbs({ path, onPathChange }: { path: string, onPathChange: (path: string) => void }) {
  const parts = path.split('/').filter(Boolean);
  const trail = [{ name: 'Root', path: '/data' }];

  let current = '/data';
  parts.forEach(p => {
    if (p === 'data') return;
    current += '/' + p;
    trail.push({ name: p, path: current });
  });

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-400 mb-3">
      {trail.map((t, i) => (
        <React.Fragment key={t.path}>
          {i > 0 && <span className="opacity-40">/</span>}
          <button
            onClick={() => onPathChange(t.path)}
            className={`hover:text-gray-900 px-1 py-0.5 rounded transition-colors ${i === trail.length - 1 ? 'text-gray-800 font-semibold' : ''
              }`}
          >
            {t.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}



function FileCategories({ categories, totalSize, selectedCategory, onCategorySelect }: { categories: Category[], totalSize: number, selectedCategory: string | null, onCategorySelect: (cat: string | null) => void }) {
  if (!categories || categories.length === 0) return null;

  const sorted = [...categories].sort((a, b) => b.sizeBytes - a.sizeBytes);

  const categoryColors: Record<string, string> = {
    'Video': 'bg-red-500',
    'Audio': 'bg-blue-500',
    'Images': 'bg-yellow-500',
    'Archives': 'bg-green-500',
    'Documents': 'bg-orange-500',
    'Backups': 'bg-purple-500',
    'System': 'bg-cyan-500',
    'Other': 'bg-gray-400',
  };

  return (
    <div className="space-y-4">
      {sorted.map(cat => {
        const percentage = (cat.sizeBytes / totalSize) * 100;
        const isSelected = selectedCategory === cat.category;

        return (
          <button
            key={cat.category}
            onClick={() => onCategorySelect(isSelected ? null : cat.category)}
            className={`w-full text-left space-y-1.5 p-2 rounded-xl transition-all group ${isSelected ? 'bg-black/5 ring-1 ring-black/5' : 'hover:bg-black/2'
              }`}
          >
            <div className="flex justify-between text-xs font-medium">
              <span className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${categoryColors[cat.category] || 'bg-gray-400'} ${isSelected ? 'scale-125 shadow-sm' : 'group-hover:scale-110'} transition-transform`} />
                <span className={isSelected ? 'text-gray-900 font-bold' : 'text-gray-600'}>{cat.category}</span>
              </span>
              <span className="text-muted-foreground">{formatBytes(cat.sizeBytes)} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${categoryColors[cat.category] || 'bg-gray-400'} transition-all duration-1000 ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TopFilesList({ files, limit = 10, selectedCategory }: { files: TopFile[], limit?: number, selectedCategory?: string | null }) {
  if (!files || files.length === 0) return <div className="text-sm text-gray-400 italic">No files found.</div>;

  // Filter by category if one is selected
  const filteredFiles = selectedCategory
    ? files.filter(f => f.category === selectedCategory)
    : files;

  return (
    <div className="space-y-3">
      {filteredFiles.slice(0, selectedCategory ? 50 : limit).map((file, idx) => (
        <div key={idx} className="flex items-center justify-between group p-2 hover:bg-black/2 rounded-lg transition-all">
          <div className="flex items-center min-w-0 flex-1">
            <span className="text-[10px] font-mono text-gray-300 w-5 flex-shrink-0">{idx + 1}</span>
            <FileIcon className="w-3.5 h-3.5 mr-2.5 text-gray-400 flex-shrink-0" />
            <div className="truncate text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors cursor-default" title={file.path}>
              {file.path.split('/').pop()}
            </div>
          </div>
          <span className="text-xs text-gray-400 tabular-nums ml-4 whitespace-nowrap bg-black/5 px-2 py-0.5 rounded opacity-80 group-hover:opacity-100">
            {formatBytes(file.sizeBytes)}
          </span>
        </div>
      ))}
      {filteredFiles.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No {selectedCategory} files in the top list.
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [currentPath, setCurrentPath] = useState('/data');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward');
  const [isPending, startTransition] = useTransition();

  const handlePathChange = (newPath: string) => {
    setNavDirection(newPath.length > currentPath.length ? 'forward' : 'back');
    startTransition(() => {
      setCurrentPath(newPath);
    });
  };

  const { data, isLoading, refetch } = useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (data?.folders && currentPath === '/data') {
      const atRoot = getFoldersAtDepth(data.folders, '/data');
      if (atRoot.length === 1) {
        setCurrentPath(atRoot[0].path);
      }
    }
  }, [data, currentPath]);

  const startScan = async () => {
    await fetch('/api/scan/start', { method: 'POST' });
    setTimeout(refetch, 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || (!data.snapshot && !data.isScanning)) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <HardDrive className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-medium text-gray-500">No data yet</h2>
        <button
          onClick={startScan}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Start Initial Scan
        </button>
      </div>
    );
  }

  // If we are scanning for the first time, show a special loading view
  if (!data.snapshot && data.isScanning) {
    const elapsedSec = (new Date().getTime() - new Date(data.startTime).getTime()) / 1000;
    const filesPerSec = Math.round(data.filesScanned / (elapsedSec || 1));

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 max-w-2xl mx-auto text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
          <RefreshCw className="w-16 h-16 text-blue-500 animate-spin relative" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Mapping your Storage</h2>
          <p className="text-muted-foreground text-lg">
            This is a deep scan. Sit back while we index your files.
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="flex justify-between text-sm font-medium tabular-nums">
            <div className="flex space-x-2">
              <span className="text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                {data.filesScanned.toLocaleString()} files
              </span>
              <span className="text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                {formatBytes(data.bytesScanned)} scanned
              </span>
            </div>
            <span className="text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/10">
              {filesPerSec.toLocaleString()} files/sec
            </span>
          </div>

          <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-3 overflow-hidden border border-white/5 shadow-inner">
            <div className="h-full bg-blue-500 animate-[shimmer_2s_infinite] w-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 bg-[length:200%_100%]" />
          </div>

          <div className="glass p-4 rounded-xl border border-white/5 text-left overflow-hidden">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold opacity-50">Currently indexing:</div>
            <div className="font-mono text-xs text-blue-400/80 truncate dir-rtl" dir="rtl">
              {data.currentPath || 'Waiting for path...'}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Tip: Large media libraries can take 5-15 minutes on the first run.
        </p>
      </div>
    );
  }

  const currentFolder = data.folders.find(f => f.path === currentPath) || { sizeBytes: data.snapshot.totalSizeBytes };

  return (
    <div className="relative space-y-8 pb-12">
      {/* Smart Loading Overlay - Only appears if loading takes > 300ms */}
      <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-md transition-all duration-300 pointer-events-none opacity-0 ${isPending ? 'opacity-100 pointer-events-auto delay-300' : 'delay-0'}`}>
        <div className="bg-white p-5 rounded-2xl shadow-xl border border-black/5 flex items-center space-x-3">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-gray-600">Loading...</span>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Breadcrumbs path={currentPath} onPathChange={handlePathChange} />
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              {currentPath.split('/').pop() || 'Root'}
            </h2>
            <p className="text-sm text-gray-400">
              {formatBytes(currentFolder.sizeBytes)} used
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {data.isScanning && (
              <div className="flex items-center space-x-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Scanning: {data.filesScanned.toLocaleString()} files...</span>
              </div>
            )}
            <button
              onClick={startScan}
              disabled={data.isScanning}
              className={`p-2.5 rounded-xl transition-all border ${data.isScanning
                ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                : 'hover:bg-gray-100 bg-white border-gray-200 shadow-sm'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${data.isScanning ? 'animate-spin text-blue-600' : 'text-gray-500'}`} />
            </button>
          </div>
        </div>

        <MacOSStorageBar
          folders={data.folders}
          totalSize={data.snapshot.totalSizeBytes}
          currentPath={currentPath}
          onPathChange={handlePathChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <HardDrive className="w-3.5 h-3.5 mr-2" />
            Subfolders
            <span className="ml-2 text-gray-300 normal-case font-normal tracking-normal">— click to drill down</span>
          </h3>
          <div
            key={currentPath}
            className={navDirection === 'forward' ? 'animate-slide-right' : 'animate-slide-left'}
          >
            <SubfolderList folders={data.folders} currentPath={currentPath} onPathChange={handlePathChange} />
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <PieChartIcon className="w-3.5 h-3.5 mr-2" />
            File Types
          </h3>
          <FileCategories
            categories={data.categories}
            totalSize={data.snapshot.totalSizeBytes}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5 flex items-center">
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            {selectedCategory ? `Top ${selectedCategory} Files` : 'Global Top 10 Largest Files'}
          </h3>
          <TopFilesList
            files={data.topFiles}
            selectedCategory={selectedCategory}
          />
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <HardDrive className="w-3.5 h-3.5 mr-2" />
            Folder Analytics
          </h3>
          <div className="mb-6">
            <FolderHistoryChart path={currentPath} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center py-2.5 border-b border-black/5">
              <span className="text-sm text-gray-400">Next Scan</span>
              <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {(() => {
                  const diffMs = new Date(data.nextScanTime).getTime() - Date.now();
                  if (diffMs <= 0) return 'Starting soon...';
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const diffMins = Math.floor(diffMs / (1000 * 60));
                  
                  if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
                  if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
                  return `in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-black/5">
              <span className="text-sm text-gray-400">Path</span>
              <span className="font-mono text-xs max-w-[200px] truncate text-gray-600" title={currentPath}>{currentPath}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-black/5">
              <span className="text-sm text-gray-400">File Count</span>
              <span className="text-sm font-semibold text-gray-800">{(currentFolder as any).fileCount?.toLocaleString() || data.snapshot.totalFiles.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-black/5">
              <span className="text-sm text-gray-400">Last Scan</span>
              <span className="text-sm text-gray-600">{new Date(data.snapshot.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-sm text-gray-400">Scan Duration</span>
              <span className="text-sm text-gray-600">{data.snapshot.durationMs} ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderHistoryChart({ path }: { path: string }) {
  const { data: history, isLoading } = useQuery<{ timestamp: string, sizeBytes: number }[]>({
    queryKey: ['folder-history', path],
    queryFn: async () => {
      const res = await fetch(`/api/history/folder?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to fetch folder history');
      return res.json();
    }
  });

  if (isLoading || !history || history.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center border border-dashed border-black/5 rounded-xl bg-black/[0.01]">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">History requires 2+ scans</p>
      </div>
    );
  }

  const option = {
    grid: { left: 0, right: 0, top: 10, bottom: 0 },
    xAxis: {
      type: 'category',
      data: history.map(h => h.timestamp),
      show: false
    },
    yAxis: {
      type: 'value',
      show: false,
      min: 'dataMin'
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const d = params[0];
        return `<div class="text-[10px] font-bold">${formatBytes(d.value)}</div><div class="text-[9px] opacity-60">${new Date(d.name).toLocaleDateString()}</div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: [4, 8]
    },
    series: [{
      data: history.map(h => h.sizeBytes),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.15)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]
        }
      }
    }]
  };

  return <ReactECharts option={option} style={{ height: '80px', width: '100%' }} />;
}

function DeleteModal({ isOpen, onConfirm, onCancel, date }: { isOpen: boolean, onConfirm: () => void, onCancel: () => void, date: string }) {
  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Layer 1: The Dark Dimming */}
      <div className={`absolute inset-0 bg-black/10 transition-opacity duration-700 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onCancel} />

      {/* Layer 2: The Constant Blur (Faded In/Out) */}
      <div className={`absolute inset-0 backdrop-blur-md transition-opacity duration-700 ease-in-out pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`} />

      <div className={`glass bg-white/95 rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-50 rounded-full">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">Delete Snapshot?</h3>
            <p className="text-sm text-gray-500">
              Are you sure you want to delete the scan from <span className="font-semibold text-gray-700">{date}</span>? This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col w-full space-y-2 pt-4">
            <button
              onClick={onConfirm}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              Delete Snapshot
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ onOpenDeleteModal }: { onOpenDeleteModal: (s: Snapshot) => void }) {
  const { data: history, isLoading, refetch } = useQuery<Snapshot[]>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    }
  });

  const { refetch: refetchStats } = useQuery({ queryKey: ['stats'], enabled: false });

  const deleteMutation = async (id: number) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      refetch();
      refetchStats();
    } catch (err) {
      alert('Error deleting snapshot');
    }
  };

  useEffect(() => {
    // We listen for a custom event to trigger deletion since the modal state is now at the top
    const handleAction = (e: any) => {
      if (e.detail.action === 'confirm-delete') {
        deleteMutation(e.detail.id);
      }
    };
    window.addEventListener('history-action', handleAction);
    return () => window.removeEventListener('history-action', handleAction);
  }, [refetch, refetchStats]);

  if (isLoading || !history) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin opacity-40" />
      </div>
    );
  }

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `<div class="p-2">
          <div class="text-xs text-gray-500 mb-1">${new Date(data.name).toLocaleString()}</div>
          <div class="font-bold text-gray-900">${formatBytes(data.value)}</div>
        </div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.05)',
      textStyle: { color: '#111827' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: history.map(s => s.timestamp),
      axisLabel: {
        formatter: (value: string) => new Date(value).toLocaleDateString(),
        color: '#9ca3af',
        fontSize: 11
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatBytes(value, 0),
        color: '#9ca3af',
        fontSize: 11
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }
    },
    series: [{
      data: history.map(s => s.totalSizeBytes),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ]
        }
      },
      lineStyle: { width: 3 }
    }]
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-xl">
            <PieChartIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Storage Trends</h2>
            <p className="text-sm text-gray-500">Historical growth of your protected data</p>
          </div>
        </div>
        <div className="h-[300px]">
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-2 bg-gray-50 rounded-xl">
            <History className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Scan History</h2>
            <p className="text-sm text-gray-500">Chronological log of all completed scans</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="pb-4 font-medium">Date & Time</th>
                <th className="pb-4 font-medium">Total Size</th>
                <th className="pb-4 font-medium">Files</th>
                <th className="pb-4 font-medium">Duration</th>
                <th className="pb-4 font-medium text-right w-24">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {history.slice().reverse().map((s) => (
                <tr key={s.id} className="group hover:bg-black/[0.02] transition-colors">
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-300" />
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(s.timestamp).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-sm font-semibold text-gray-900">{formatBytes(s.totalSizeBytes)}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-gray-500">{s.totalFiles.toLocaleString()} files</span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center space-x-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">{Math.round(s.durationMs / 1000)}s</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end relative h-8">
                      <span className="text-xs font-mono text-gray-300 transition-opacity group-hover:opacity-0">#{s.id}</span>
                      <button
                        onClick={() => onOpenDeleteModal(s)}
                        className="absolute right-0 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete this scan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingDate, setDeletingDate] = useState<string>('');

  const openDeleteModal = (snapshot: Snapshot) => {
    setDeletingId(snapshot.id);
    setDeletingDate(new Date(snapshot.timestamp).toLocaleString());
  };

  const confirmDelete = () => {
    if (deletingId) {
      window.dispatchEvent(new CustomEvent('history-action', {
        detail: { action: 'confirm-delete', id: deletingId }
      }));
      setDeletingId(null);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="relative z-10 flex flex-col h-screen">
          {/* Top Navigation Bar */}
          <header className="flex-shrink-0 border-b border-black/5 bg-white/60 backdrop-blur-xl sticky top-0 z-20">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center relative">
              {/* Logo - Aligned with content below */}
              <img src="/logo.png" alt="BirdView" className="w-36 h-auto relative z-10" />

              {/* Nav links - Perfectly centered regardless of logo width */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <nav className="flex items-center space-x-1 pointer-events-auto">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard'
                      ? 'bg-black/6 text-gray-900'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                      }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                      ? 'bg-black/6 text-gray-900'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                      }`}
                  >
                    History
                  </button>
                </nav>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'history' && <HistoryView onOpenDeleteModal={openDeleteModal} />}
            </div>
          </main>
        </div>
      </div>

      <DeleteModal
        isOpen={deletingId !== null}
        date={deletingDate}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </QueryClientProvider>
  );
}

export default App;
