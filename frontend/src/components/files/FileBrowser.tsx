import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Folder, MoreVertical, HardDrive } from 'lucide-react';
import { formatBytes } from '../../lib/utils';
import { CATEGORY_COLORS } from '../../lib/constants';
import { useQuery } from '@tanstack/react-query';

interface FileItem {
  name: string;
  path: string;
  sizeBytes: number;
  isDir: boolean;
  category?: string;
}

interface ColumnProps {
  path: string;
  snapshotId?: number | null;
  selectedPath: string | null;
  onSelect: (item: FileItem) => void;
}

function Column({ path, snapshotId, selectedPath, onSelect }: ColumnProps) {
  const { data: items, isLoading } = useQuery<FileItem[]>({
    queryKey: ['browse', path, snapshotId],
    queryFn: async () => {
      const url = new URL('/api/browse', window.location.origin);
      url.searchParams.set('path', path);
      if (snapshotId) url.searchParams.set('snapshot_id', snapshotId.toString());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to browse');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="w-72 flex-shrink-0 border-r border-white/5 h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 border-r border-white/5 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-black/10">
      <div className="py-2">
        {items?.map((item) => (
          <button
            key={item.path}
            onClick={() => onSelect(item)}
            className={`w-full flex items-center px-4 py-2 text-sm transition-all hover:bg-white/5 group relative ${
              selectedPath === item.path ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400'
            }`}
          >
            {selectedPath === item.path && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            )}
            <div className="mr-3">
              {item.isDir ? (
                <Folder className={`w-4 h-4 ${selectedPath === item.path ? 'text-blue-400' : 'text-blue-400/50'}`} />
              ) : (
                <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[item.category || 'Other'] || 'bg-gray-500'} shadow-sm`} />
              )}
            </div>
            <span className="flex-1 text-left truncate mr-2 font-medium" title={item.name}>
              {item.name}
            </span>
            <div className="flex items-center space-x-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-gray-500 font-mono">{formatBytes(item.sizeBytes)}</span>
              {item.isDir && <ChevronRight className="w-3 h-3 text-gray-600" />}
            </div>
          </button>
        ))}
        {items?.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-600 italic">
            Empty folder
          </div>
        )}
      </div>
    </div>
  );
}

interface FileBrowserProps {
  snapshotId?: number | null;
}

export function FileBrowser({ snapshotId }: FileBrowserProps) {
  // Array of paths for open columns. Index 0 is always root (/data)
  const [columnPaths, setColumnPaths] = useState<string[]>(['/data']);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSelect = (item: FileItem, colIndex: number) => {
    const newColumnPaths = columnPaths.slice(0, colIndex + 1);
    const newSelectedPaths = selectedPaths.slice(0, colIndex);
    
    newSelectedPaths[colIndex] = item.path;
    
    if (item.isDir) {
      newColumnPaths.push(item.path);
    }

    setColumnPaths(newColumnPaths);
    setSelectedPaths(newSelectedPaths);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [columnPaths]);


  return (
    <div className="w-full bg-[#1c1c1e] rounded-3xl border border-white/5 overflow-hidden shadow-2xl flex flex-col h-[600px] group/browser">
      {/* Header / Breadcrumbs */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center bg-black/40 backdrop-blur-xl justify-between">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <div className="flex items-center overflow-x-auto no-scrollbar whitespace-nowrap text-xs font-medium">
              {['data', ...selectedPaths.map(p => p.split('/').pop())].filter(Boolean).map((part, i, arr) => (
                <div key={i} className="flex items-center">
                  <span className={`transition-colors ${i === arr.length - 1 ? 'text-white' : 'text-gray-500 hover:text-gray-300 cursor-pointer'}`}>
                    {part}
                  </span>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 mx-1 opacity-20 text-white" />}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold bg-white/5 px-2 py-1 rounded-md border border-white/5">
            Column View
          </div>
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columns Area */}
      <div 
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden custom-scrollbar bg-black/20"
      >
        <div className="flex h-full min-w-full">
          {columnPaths.map((path, index) => (
            <Column
              key={`${path}-${index}`}
              path={path}
              snapshotId={snapshotId}
              selectedPath={selectedPaths[index] || null}
              onSelect={(item) => handleSelect(item, index)}
            />
          ))}
          
          {/* Detail Pane / Preview Area */}
          {selectedPaths.length > 0 && !columnPaths[selectedPaths.length] && (
            <div className="flex-1 min-w-[300px] flex flex-col items-center justify-center p-12 bg-black/30 border-l border-white/5">
              <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl group-hover/browser:scale-110 transition-transform duration-500">
                <HardDrive className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 text-center break-all">
                {selectedPaths[selectedPaths.length - 1].split('/').pop()}
              </h3>
              <p className="text-gray-500 text-sm mb-8">Selected Item Preview</p>
              
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-gray-500">Path</span>
                  <span className="text-gray-300 truncate ml-4" title={selectedPaths[selectedPaths.length - 1]}>
                    {selectedPaths[selectedPaths.length - 1]}
                  </span>
                </div>
                <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                  Quick Look
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
