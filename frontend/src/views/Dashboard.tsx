import { useState, useEffect, useTransition } from 'react';
import { RefreshCw, HardDrive, PieChart as PieChartIcon } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import { formatBytes } from '../lib/utils';
import { Breadcrumbs } from '../components/storage/Breadcrumbs';
import { StorageBar } from '../components/storage/StorageBar';
import { SubfolderList } from '../components/storage/SubfolderList';
import { FileCategories } from '../components/files/FileCategories';
import { TopFilesList } from '../components/files/TopFilesList';
import { FolderHistoryChart } from '../components/files/FolderHistoryChart';
import { getFoldersAtDepth } from '../lib/utils';

export function Dashboard() {
  const [currentPath, setCurrentPath] = useState('/data');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward');
  const [isPending, startTransition] = useTransition();

  const { data, isLoading, isStarting, startScan } = useStats();

  const handlePathChange = (newPath: string) => {
    setNavDirection(newPath.length > currentPath.length ? 'forward' : 'back');
    startTransition(() => {
      setCurrentPath(newPath);
    });
  };

  useEffect(() => {
    if (data?.folders && currentPath === '/data') {
      const atRoot = getFoldersAtDepth(data.folders, '/data');
      if (atRoot.length === 1) {
        setCurrentPath(atRoot[0].path);
      }
    }
  }, [data, currentPath]);

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

  // Detect an "empty scan" — scan ran but found nothing (permission issue, wrong mount, etc.)
  const isEmptyScan = data.snapshot && data.snapshot.totalSizeBytes === 0 && data.folders.length === 0;

  if (isEmptyScan && !data.isScanning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 max-w-lg mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-orange-500/15 blur-3xl rounded-full animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Scan found 0 files</h2>
          <p className="text-gray-500 leading-relaxed">
            The scan completed, but BirdView couldn't read any files. This is usually a <span className="font-semibold text-gray-700">permissions issue</span> — the scanner doesn't have access to the mounted directory.
          </p>
        </div>

        <div className="w-full bg-black/[0.02] border border-black/5 rounded-2xl p-5 text-left space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Common Fixes</p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Run as root (Mac / Colima)</p>
                <p className="text-xs text-gray-500 mt-0.5">Set <span className="font-mono bg-black/5 px-1 rounded">PUID=0</span> and <span className="font-mono bg-black/5 px-1 rounded">PGID=0</span> in your <span className="font-mono bg-black/5 px-1 rounded">docker-compose.yml</span></p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Check your volume mount</p>
                <p className="text-xs text-gray-500 mt-0.5">Run <span className="font-mono bg-black/5 px-1 rounded">docker exec -it birdview ls /data</span> to confirm the folder is accessible</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Unraid: match the correct PUID/PGID</p>
                <p className="text-xs text-gray-500 mt-0.5">Use the UID of your media user — typically <span className="font-mono bg-black/5 px-1 rounded">99</span> / <span className="font-mono bg-black/5 px-1 rounded">100</span> on Unraid</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={startScan}
          disabled={data.isScanning}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Re-run Scan</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 pb-12">
      {/* Data path error banner */}
      {data.dataPathError && (
        <div className="flex items-start space-x-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="min-w-0">
            <p className="font-semibold text-amber-800">Data path error</p>
            <p className="text-amber-700 mt-0.5 font-mono text-xs break-all">{data.dataPathError}</p>
          </div>
        </div>
      )}

      {/* Smart Loading Overlay */}
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
            <button
              onClick={startScan}
              disabled={isStarting || data.isScanning}
              className={`p-2.5 rounded-xl transition-all border ${(isStarting || data.isScanning)
                ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                : 'hover:bg-gray-100 bg-white border-gray-200 shadow-sm active:scale-95'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${(isStarting || data.isScanning) ? 'animate-spin text-blue-600' : 'text-gray-500'}`} />
            </button>
          </div>
        </div>

        {/* Slim Live Scan Strip */}
        {data.isScanning && (() => {
          const elapsedSec = (new Date().getTime() - new Date(data.startTime).getTime()) / 1000;
          const fPerSec = Math.round(data.filesScanned / (elapsedSec || 1));
          return (
            <div className="flex items-center justify-between text-xs text-blue-500 bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-2.5">
              <div className="flex items-center space-x-2 min-w-0">
                <RefreshCw className="w-3 h-3 animate-spin flex-shrink-0" />
                <span className="font-mono truncate text-blue-400/80" dir="rtl">{data.currentPath || '…'}</span>
              </div>
              <div className="flex items-center space-x-3 ml-4 flex-shrink-0 font-medium tabular-nums">
                <span>{data.filesScanned.toLocaleString()} files</span>
                <span className="text-blue-300">·</span>
                <span>{formatBytes(data.bytesScanned)}</span>
                <span className="text-blue-300">·</span>
                <span className="text-blue-400">{fPerSec.toLocaleString()}/s</span>
              </div>
            </div>
          );
        })()}

        <StorageBar
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
