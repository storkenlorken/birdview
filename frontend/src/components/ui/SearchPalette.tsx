import { useState, useEffect, useRef } from 'react';
import { Search, Folder, FileText, X } from 'lucide-react';
import { formatBytes } from '../../lib/utils';

interface SearchResult {
  path: string;
  sizeBytes: number;
  type: 'folder' | 'file';
}

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function SearchPalette({ isOpen, onClose, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl glass rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-black/5 flex items-center space-x-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search folders and files... (e.g. 'movies', 'backup')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-lg placeholder-gray-400"
          />
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Searching...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((res) => (
                <button
                  key={res.path}
                  onClick={() => {
                    onSelect(res.path);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-blue-500 hover:text-white transition-all group text-left"
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="p-2 bg-black/5 rounded-xl group-hover:bg-white/20 transition-colors">
                      {res.type === 'folder' ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{res.path.split('/').pop() || 'Root'}</p>
                      <p className="text-[10px] opacity-60 truncate font-mono">{res.path}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums opacity-60 group-hover:opacity-100 px-3 py-1 bg-black/5 rounded-lg group-hover:bg-white/20 ml-4">
                    {formatBytes(res.sizeBytes)}
                  </span>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">No matches found for "{query}"</div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">
              <p className="font-medium text-gray-500 mb-1">Quick-Jump Search</p>
              <p className="text-xs opacity-60">Type to find folders or large files instantly</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-black/[0.02] border-t border-black/5 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest px-6">
          <span>{results.length} results</span>
          <div className="flex items-center space-x-4">
            <span>↑↓ to navigate</span>
            <span>↵ to jump</span>
            <span>esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
