import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { RefreshCw, HardDrive, PieChart as PieChartIcon, ChevronRight } from 'lucide-react';

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
            className={`w-full text-left group rounded-xl px-4 py-3 transition-all ${
              hasChildren
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
            className={`hover:text-gray-900 px-1 py-0.5 rounded transition-colors ${
              i === trail.length - 1 ? 'text-gray-800 font-semibold' : ''
            }`}
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
        <div key={file.path} className="flex items-center justify-between group py-1.5">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-gray-300 tabular-nums w-4 text-xs">{i + 1}</span>
            <div className="truncate text-sm font-medium hover:text-blue-600 transition-colors cursor-default" title={file.path}>
              {file.path.split('/').pop()}
            </div>
          </div>
          <span className="text-xs text-gray-400 tabular-nums ml-4 whitespace-nowrap bg-black/5 px-2 py-0.5 rounded">
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
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${categoryColors[cat.category] || 'bg-gray-400'} transition-all duration-1000`} 
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Breadcrumbs path={currentPath} onPathChange={setCurrentPath} />
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
              className={`p-2.5 rounded-xl transition-all border ${
                data.isScanning
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
          onPathChange={setCurrentPath}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <HardDrive className="w-3.5 h-3.5 mr-2" />
            Subfolders
            <span className="ml-2 text-gray-300 normal-case font-normal tracking-normal">— click to drill down</span>
          </h3>
          <SubfolderList folders={data.folders} currentPath={currentPath} onPathChange={setCurrentPath} />
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <PieChartIcon className="w-3.5 h-3.5 mr-2" />
            File Types
          </h3>
          <FileCategories categories={data.categories} totalSize={data.snapshot.totalSizeBytes} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5 flex items-center">
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Top 10 Largest Files
          </h3>
          <TopFilesList files={data.topFiles} />
        </div>
        
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center">
            <HardDrive className="w-3.5 h-3.5 mr-2" />
            Details
          </h3>
           <div className="space-y-1">
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

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');

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
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'dashboard'
                        ? 'bg-black/6 text-gray-900'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'history'
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
              {activeTab === 'history' && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-2">
                  <HardDrive className="w-10 h-10 opacity-30" />
                  <p className="text-sm">History view coming soon</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
