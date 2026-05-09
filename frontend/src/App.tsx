import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Settings, RefreshCw, HardDrive, PieChart as PieChartIcon } from 'lucide-react';

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
}

interface Category {
  category: string;
  sizeBytes: number;
  fileCount: number;
}

interface StatsResponse {
  snapshot: {
    id: number;
    totalSizeBytes: number;
    totalFiles: number;
    timestamp: string;
    durationMs: number;
  };
  folders: FolderSnapshot[];
  topFiles: TopFile[];
  categories: Category[];
  isScanning: boolean;
  filesScanned: number;
  bytesScanned: number;
  currentPath: string;
  startTime: string;
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
    'bg-[#ff3b30]', // Red
    'bg-[#007aff]', // Blue
    'bg-[#ffcc00]', // Yellow
    'bg-[#4cd964]', // Green
    'bg-[#ff9500]', // Orange
    'bg-[#af52de]', // Purple
    'bg-[#8e8e93]', // Gray
  ];

  return (
    <div className="space-y-6">
      <div className="h-8 w-full rounded-xl overflow-hidden flex shadow-inner bg-black/10 dark:bg-white/10 p-1 border border-white/10">
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
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
            className="flex items-center space-x-2 hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 rounded-md transition-colors"
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
            className={`w-full text-left group rounded-xl px-4 py-3 transition-all ${
              hasChildren
                ? 'hover:bg-white/5 cursor-pointer'
                : 'cursor-default opacity-70'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[i % colors.length]}`} />
                <span className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                  {name}
                </span>
                {hasChildren && (
                  <span className="text-[10px] text-muted-foreground/50 bg-white/5 px-1.5 py-0.5 rounded">▶</span>
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
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
      {trail.map((t, i) => (
        <React.Fragment key={t.path}>
          {i > 0 && <span>/</span>}
          <button 
            onClick={() => onPathChange(t.path)}
            className={`hover:text-foreground px-1 py-0.5 rounded transition-colors ${i === trail.length - 1 ? 'text-foreground font-semibold' : ''}`}
          >
            {t.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

function TopFilesList({ files }: { files: TopFile[] }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="space-y-3">
      {files.slice(0, 10).map((file, i) => (
        <div key={file.path} className="flex items-center justify-between group py-1">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-muted-foreground/50 tabular-nums w-4 text-xs">{i + 1}</span>
            <div className="truncate text-sm font-medium hover:text-blue-500 transition-colors cursor-default" title={file.path}>
              {file.path.split('/').pop()}
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums ml-4 whitespace-nowrap bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
            {formatBytes(file.sizeBytes)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FileCategories({ categories, totalSize }: { categories: Category[], totalSize: number }) {
  if (!categories || categories.length === 0) return null;

  const sorted = [...categories].sort((a, b) => b.sizeBytes - a.sizeBytes);
  
  const categoryColors: Record<string, string> = {
    'Video': 'bg-red-500',
    'Audio': 'bg-blue-500',
    'Images': 'bg-yellow-500',
    'Archives': 'bg-green-500',
    'Documents': 'bg-orange-500',
    'Backups': 'bg-purple-500',
    'Other': 'bg-gray-500',
  };

  return (
    <div className="space-y-4">
      {sorted.map(cat => {
        const percentage = (cat.sizeBytes / totalSize) * 100;
        return (
          <div key={cat.category} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${categoryColors[cat.category] || 'bg-gray-500'}`} />
                {cat.category}
              </span>
              <span className="text-muted-foreground">{formatBytes(cat.sizeBytes)} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${categoryColors[cat.category] || 'bg-gray-500'} transition-all duration-1000`} 
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const [currentPath, setCurrentPath] = useState('/data');
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
        <HardDrive className="w-16 h-16 text-muted-foreground/30" />
        <h2 className="text-xl font-medium text-muted-foreground">No data yet</h2>
        <button 
          onClick={startScan}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:opacity-90 transition-opacity"
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Breadcrumbs path={currentPath} onPathChange={setCurrentPath} />
            <h2 className="text-3xl font-semibold tracking-tight">
              {currentPath.split('/').pop() || 'Root'}
            </h2>
            <p className="text-muted-foreground">
              {formatBytes(currentFolder.sizeBytes)} used
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {data.isScanning && (
              <div className="flex items-center space-x-2 text-xs font-medium text-blue-500 animate-pulse bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Scanning: {data.filesScanned.toLocaleString()} files...</span>
              </div>
            )}
            <button 
              onClick={startScan} 
              disabled={data.isScanning}
              className={`p-3 rounded-full transition-all border border-white/10 ${data.isScanning ? 'opacity-50 cursor-not-allowed bg-white/5' : 'hover:bg-black/10 dark:hover:bg-white/10 bg-white/5 shadow-sm'}`}
            >
              <RefreshCw className={`w-5 h-5 ${data.isScanning ? 'animate-spin text-blue-500' : 'text-muted-foreground'}`} />
            </button>
          </div>
        </div>

        <MacOSStorageBar 
          folders={data.folders} 
          totalSize={data.snapshot.totalSizeBytes} 
          currentPath={currentPath}
          onPathChange={setCurrentPath}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 border border-white/10 lg:col-span-2">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <HardDrive className="w-4 h-4 mr-2 text-blue-500" />
            Subfolders
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              — click to drill down
            </span>
          </h3>
          <SubfolderList folders={data.folders} currentPath={currentPath} onPathChange={setCurrentPath} />
        </div>

        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-medium mb-4 flex items-center"><PieChartIcon className="w-4 h-4 mr-2 text-yellow-500" /> File Types</h3>
          <FileCategories categories={data.categories} totalSize={data.snapshot.totalSizeBytes} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-medium mb-6 flex items-center"><RefreshCw className="w-4 h-4 mr-2 text-red-500" /> Top 10 Largest Files</h3>
          <TopFilesList files={data.topFiles} />
        </div>
        
        <div className="glass rounded-2xl p-6 border border-white/10">
           <h3 className="text-lg font-medium mb-4 flex items-center"><HardDrive className="w-4 h-4 mr-2 text-purple-500" /> Details</h3>
           <div className="space-y-4">
             <div className="flex justify-between items-center py-2 border-b border-white/5">
               <span className="text-muted-foreground">Path</span>
               <span className="font-mono text-xs max-w-[200px] truncate" title={currentPath}>{currentPath}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-white/5">
               <span className="text-muted-foreground">File Count</span>
               <span className="font-medium">{(currentFolder as any).fileCount?.toLocaleString() || data.snapshot.totalFiles.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-white/5">
               <span className="text-muted-foreground">Last Scan</span>
               <span className="font-medium text-xs">{new Date(data.snapshot.timestamp).toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-white/5">
               <span className="text-muted-foreground">Scan Duration</span>
               <span className="font-medium text-xs">{data.snapshot.durationMs} ms</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="relative z-10 flex h-screen overflow-hidden">
          <aside className="w-64 border-r border-border/50 glass hidden md:flex flex-col">
            <div className="p-6">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">BirdView</h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
              <button className="w-full text-left px-4 py-2 rounded-lg bg-black/5 dark:bg-white/10 font-medium text-sm">Dashboard</button>
              <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 font-medium text-sm text-muted-foreground transition-colors">History</button>
            </nav>
            <div className="p-4 border-t border-border/50">
              <button 
                onClick={() => setIsDark(!isDark)}
                className="flex items-center space-x-2 px-4 py-2 w-full hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-sm text-muted-foreground transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Toggle Theme</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-5xl mx-auto">
              <Dashboard />
            </div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
