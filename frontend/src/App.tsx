import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Settings, RefreshCw, HardDrive, PieChart as PieChartIcon } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

const queryClient = new QueryClient();

// API Types
interface Snapshot {
  id: number;
  timestamp: string;
  totalSizeBytes: number;
  totalFiles: number;
  durationMs: number;
}

interface FolderSnapshot {
  id: number;
  snapshotId: number;
  path: string;
  sizeBytes: number;
  fileCount: number;
}

interface StatsResponse {
  snapshot: Snapshot;
  folders: FolderSnapshot[];
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Components
function MacOSStorageBar({ folders, totalSize }: { folders: FolderSnapshot[], totalSize: number }) {
  if (!folders.length) return null;

  // Group top-level folders (those just under /data)
  const topLevel = folders.filter(f => {
    const parts = f.path.split('/').filter(Boolean);
    return parts.length === 2 && parts[0] === 'data'; // Assuming /data is mount point, so /data/X
  }).sort((a, b) => b.sizeBytes - a.sizeBytes);

  // If no structure like /data/X, just use the largest
  const categories = topLevel.length > 0 ? topLevel.slice(0, 5) : folders.slice(0, 5);
  const otherSize = categories.reduce((acc, curr) => acc - curr.sizeBytes, totalSize);
  
  if (otherSize > 0) {
    categories.push({ id: -1, path: 'Other', sizeBytes: otherSize, snapshotId: -1, fileCount: 0 });
  }

  const colors = [
    'bg-[#ff3b30]', // Apps/Red
    'bg-[#007aff]', // Documents/Blue
    'bg-[#ffcc00]', // Yellow
    'bg-[#4cd964]', // Green
    'bg-[#ff9500]', // Orange
    'bg-[#8e8e93]', // Gray
  ];

  return (
    <div className="space-y-6">
      {/* The Stacked Bar */}
      <div className="h-6 w-full rounded-full overflow-hidden flex shadow-inner bg-black/10 dark:bg-white/10">
        {categories.map((cat, i) => (
          <div
            key={cat.path}
            style={{ width: `${(cat.sizeBytes / totalSize) * 100}%` }}
            className={`h-full ${colors[i % colors.length]} transition-all duration-500`}
            title={`${cat.path}: ${formatBytes(cat.sizeBytes)}`}
          />
        ))}
      </div>
      
      {/* The Legend List */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {categories.map((cat, i) => (
          <div key={cat.path} className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${colors[i % colors.length]}`} />
            <span className="font-medium text-foreground/80">{cat.path.split('/').pop()}</span>
            <span className="text-muted-foreground">{formatBytes(cat.sizeBytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TreemapChart({ folders }: { folders: FolderSnapshot[] }) {
  // Convert folders to hierarchical ECharts data
  // For simplicity MVP, we just show top level
  const topLevel = folders.filter(f => f.path !== '/data' && f.path.split('/').length <= 3).sort((a,b) => b.sizeBytes - a.sizeBytes).slice(0, 20);
  
  const data = topLevel.map(f => ({
    name: f.path.split('/').pop() || f.path,
    value: f.sizeBytes,
    path: f.path
  }));

  const option = {
    tooltip: {
      formatter: function (info: any) {
        var value = info.value;
        return `${info.name}: ${formatBytes(value)}`;
      }
    },
    series: [
      {
        type: 'treemap',
        width: '100%',
        height: '100%',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        itemStyle: {
          gapWidth: 1,
          borderColor: 'transparent'
        },
        data: data
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
}

function Dashboard() {
  const { data, isLoading, refetch } = useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const startScan = async () => {
    await fetch('/api/scan/start', { method: 'POST' });
    setTimeout(refetch, 2000); // Trigger refetch soon after starting
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.snapshot) {
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Macintosh HD</h2>
            <p className="text-muted-foreground mt-1">
              {formatBytes(data.snapshot.totalSizeBytes)} used of ? GB
            </p>
          </div>
          <button onClick={startScan} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <MacOSStorageBar folders={data.folders} totalSize={data.snapshot.totalSizeBytes} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center"><PieChartIcon className="w-4 h-4 mr-2" /> Storage Hierarchy</h3>
          <TreemapChart folders={data.folders} />
        </div>
        
        <div className="glass rounded-2xl p-6">
           <h3 className="text-lg font-medium mb-4">Quick Stats</h3>
           <div className="space-y-4">
             <div className="flex justify-between items-center py-2 border-b border-border/50">
               <span className="text-muted-foreground">Total Files</span>
               <span className="font-medium">{data.snapshot.totalFiles.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-border/50">
               <span className="text-muted-foreground">Last Scan</span>
               <span className="font-medium">{new Date(data.snapshot.timestamp).toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-border/50">
               <span className="text-muted-foreground">Scan Duration</span>
               <span className="font-medium">{data.snapshot.durationMs} ms</span>
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
        {/* Soft Background Gradient */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="relative z-10 flex h-screen overflow-hidden">
          {/* Sidebar */}
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

          {/* Main Content */}
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
