import type { FolderSnapshot } from '../../types';
import { formatBytes, getFoldersAtDepth } from '../../lib/utils';

interface StorageBarProps {
  folders: FolderSnapshot[];
  totalSize: number;
  currentPath: string;
  onPathChange: (path: string) => void;
}

export function StorageBar({
  folders,
  totalSize,
  currentPath,
  onPathChange
}: StorageBarProps) {
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
