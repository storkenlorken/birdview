import { useState, useEffect, useTransition } from 'react';
import { RefreshCw, HardDrive, PieChart as PieChartIcon, LayoutGrid, List } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import { formatBytes } from '../lib/utils';
import { Breadcrumbs } from '../components/storage/Breadcrumbs';
import { StorageBar } from '../components/storage/StorageBar';
import { SubfolderList } from '../components/storage/SubfolderList';
import { FileCategories } from '../components/files/FileCategories';
import { TopFilesList } from '../components/files/TopFilesList';
import { FolderHistoryChart } from '../components/files/FolderHistoryChart';
import { getFoldersAtDepth } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';
import { useEvents } from '../hooks/useEvents';

export function Dashboard() {
  const [currentPath, setCurrentPath] = useState('/data');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward');
  const [viewSnapshotId, setViewSnapshotId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const { data, isLoading, isStarting, startScan } = useStats(viewSnapshotId);
  const liveUpdate = useEvents();

  // Determine if we should show live progress
  const isScanning = liveUpdate?.isRunning ?? data?.isScanning;
  const bytesScanned = liveUpdate?.isRunning ? liveUpdate.bytesScanned : (data?.bytesScanned ?? 0);
  const livePath = liveUpdate?.isRunning ? liveUpdate.currentPath : data?.currentPath;

  const handlePathChange = (newPath: string) => {
    setNavDirection(newPath.length > currentPath.length ? 'forward' : 'back');
    startTransition(() => {
      setCurrentPath(newPath);
    });
  };

  const handleSnapshotSelect = (id: number) => {
    startTransition(() => {
      setViewSnapshotId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  useEffect(() => {
    const handleJump = (e: any) => {
      const path = e.detail.path;
      const targetPath = path.includes('.') && !path.endsWith('/') ? path.substring(0, path.lastIndexOf('/')) : path;
      
      startTransition(() => {
        setViewSnapshotId(null);
        setCurrentPath(targetPath || '/data');
      });
    };
    window.addEventListener('jump-to-path', handleJump);
    return () => window.removeEventListener('jump-to-path', handleJump);
  }, []);

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
      <div className="space-y-8 animate-in fade-in duration-700 pb-12">
        <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="glass rounded-2xl p-6 lg:col-span-2 space-y-4">
             {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
          <div className="glass rounded-2xl p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || (!data.snapshot && !data.isScanning)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
        <HardDrive className="w-16 h-16 text-gray-200 mb-2" />
        <h2 className="text-xl font-bold text-gray-900">Storage Not Mapped</h2>
        <p className="text-sm text-gray-500 max-w-xs">Run your first scan to see the breakdown of your storage.</p>
        <button onClick={startScan} className="px-8 py-3 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 transition-all font-bold active:scale-95">
          Start Initial Scan
        </button>
      </div>
    );
  }

  const currentFolder = data.folders.find(f => f.path === currentPath) || { sizeBytes: data.snapshot.totalSizeBytes };

  // Detect an "empty scan" — scan ran but found nothing (permission issue, wrong mount, etc.)
  const isEmptyScan = data.snapshot && data.snapshot.totalFiles === 0 && !isScanning;

  if (isEmptyScan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 max-w-lg mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
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
            The scan completed, but BirdView couldn't read any files. This is almost certainly a <span className="font-semibold text-gray-700">permissions issue</span>.
          </p>
        </div>

        <div className="w-full bg-black/[0.02] border border-black/5 rounded-2xl p-6 text-left space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Quick Fixes</p>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Check Docker Mount</p>
                <p className="text-xs text-gray-500 mt-1">Ensure <span className="font-mono bg-black/5 px-1 rounded">/Users</span> is correctly mapped to <span className="font-mono bg-black/5 px-1 rounded">/data</span> in your compose file.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Use Root Mode (macOS)</p>
                <p className="text-xs text-gray-500 mt-1">Set <span className="font-mono bg-black/5 px-1 rounded">PUID=0</span> and <span className="font-mono bg-black/5 px-1 rounded">PGID=0</span> to bypass local permission blocks.</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={startScan}
          disabled={isScanning}
          className="flex items-center space-x-3 px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>Re-run Scan</span>
        </button>
      </div>
    );
  }
    <>
      <div className="relative space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Banner Section */}
        {(viewSnapshotId || data.dataPathError) && (
          <div className="space-y-4">
            {viewSnapshotId && (
              <div className="flex items-center justify-between bg-blue-500 text-white rounded-2xl px-6 py-4 shadow-lg shadow-blue-500/20 animate-in slide-in-from-top-4">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-4 h-4 opacity-80" />
                  <p className="text-sm font-semibold">Viewing history from {new Date(data.snapshot.timestamp).toLocaleString()}</p>
                </div>
                <button onClick={() => setViewSnapshotId(null)} className="px-4 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-lg hover:bg-white/90 transition-all">Exit History</button>
              </div>
            )}
            {data.dataPathError && (
              <div className="bg-amber-500 text-white rounded-2xl px-6 py-4 shadow-lg shadow-amber-500/20">
                <p className="text-sm font-bold">Path Error: {data.dataPathError}</p>
              </div>
            )}
          </div>
        )}

        {/* Main Header Card */}
        <div className="glass rounded-2xl p-6 sm:p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Breadcrumbs path={currentPath} onPathChange={handlePathChange} />
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 truncate max-w-md">{currentPath.split('/').pop() || 'Root'}</h2>
              <p className="text-sm text-gray-400 font-medium">{formatBytes(currentFolder.sizeBytes)} used</p>
            </div>
            <button onClick={startScan} disabled={isStarting || isScanning} className={`p-3 rounded-2xl border transition-all ${isScanning ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200 hover:bg-gray-50 active:scale-95 shadow-sm'}`}>
              <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
            </button>
          </div>

          {isScanning && (
            <div className="flex items-center justify-between text-xs text-blue-500 bg-blue-50/70 border border-blue-100 rounded-2xl px-5 py-3">
              <div className="flex items-center space-x-3 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono truncate opacity-70" dir="rtl">{livePath || 'Waiting...'}</span>
              </div>
              <div className="font-bold tabular-nums ml-4">{formatBytes(bytesScanned)}</div>
            </div>
          )}

          <StorageBar folders={data.folders} totalSize={data.snapshot.totalSizeBytes} currentPath={currentPath} onPathChange={handlePathChange} />
        </div>

        {/* Unified Explorer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sidebar: Categories & Analytics */}
          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-24">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                <PieChartIcon className="w-3 h-3 mr-2" />
                Breakdown
              </h3>
              <FileCategories categories={data.categories} totalSize={data.snapshot.totalSizeBytes} selectedCategory={selectedCategory} onCategorySelect={setSelectedCategory} />
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                <LayoutGrid className="w-3 h-3 mr-2" />
                History
              </h3>
              <div className="h-[200px] -mx-2">
                <FolderHistoryChart path={currentPath} onSnapshotSelect={handleSnapshotSelect} />
              </div>
            </div>
          </div>

          {/* Right Main: Subfolders & Top Files */}
          <div className="lg:col-span-8 space-y-8">
            <div className="glass rounded-2xl p-1 overflow-hidden">
              <div className="flex items-center px-6 py-4 border-b border-black/5 bg-black/[0.01]">
                <HardDrive className="w-4 h-4 mr-2.5 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Subfolders</h3>
              </div>
              <div className="max-h-[380px] overflow-y-auto custom-scrollbar px-6 py-4 bg-white/40">
                <div key={currentPath} className={navDirection === 'forward' ? 'animate-slide-right' : 'animate-slide-left'}>
                  <SubfolderList folders={data.folders} currentPath={currentPath} onPathChange={handlePathChange} />
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 min-h-[400px]">
               <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex items-center">
                    <div className="p-1.5 bg-gray-50 rounded-lg mr-3 border border-black/5">
                      <List className="w-4 h-4 text-gray-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">
                      {selectedCategory ? `${selectedCategory} Files` : 'Largest Files'}
                    </h3>
                  </div>
               </div>
               <TopFilesList files={data.topFiles} selectedCategory={selectedCategory} />
            </div>
          </div>
        </div>

        {/* Scan Information Footer */}
        <div className="glass rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-center sm:text-left">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Next Scan</p>
              <p className="text-lg font-bold text-blue-600">
                 {(() => {
                  const diffMs = new Date(data.nextScanTime).getTime() - Date.now();
                  if (diffMs <= 0) return 'Scanning...';
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
                  return 'Starting Soon';
                })()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Index</p>
              <p className="text-lg font-bold text-gray-900">{new Date(data.snapshot.timestamp).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Files</p>
              <p className="text-lg font-bold text-gray-900">{data.snapshot.totalFiles.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Loading Overlay */}
      <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-md transition-all duration-300 pointer-events-none opacity-0 ${isPending ? 'opacity-100 pointer-events-auto delay-300' : 'delay-0'}`}>
        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-black/5 flex items-center space-x-4">
          <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
          <span className="text-lg font-bold text-gray-700">Mapping Storage...</span>
        </div>
      </div>
    </>
  );
}
