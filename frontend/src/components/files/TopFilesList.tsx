import { File as FileIcon } from 'lucide-react';
import type { TopFile } from '../../types';
import { formatBytes } from '../../lib/utils';

interface TopFilesListProps {
  files: TopFile[];
  limit?: number;
  selectedCategory?: string | null;
}

export function TopFilesList({ files, limit = 10, selectedCategory }: TopFilesListProps) {
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
