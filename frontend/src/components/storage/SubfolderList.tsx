import { ChevronRight } from 'lucide-react';
import type { FolderSnapshot } from '../../types';
import { formatBytes, getFoldersAtDepth } from '../../lib/utils';
import { STORAGE_BAR_COLORS } from '../../lib/constants';

interface SubfolderListProps {
  folders: FolderSnapshot[];
  currentPath: string;
  onPathChange: (path: string) => void;
}

export function SubfolderList({ folders, currentPath, onPathChange }: SubfolderListProps) {
  const subFolders = getFoldersAtDepth(folders, currentPath);

  if (subFolders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No subfolders found in this directory.</p>;
  }

  const largest = subFolders[0].sizeBytes || 1;

  const colors = STORAGE_BAR_COLORS;

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
