import { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Dashboard } from './views/Dashboard';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { DeleteModal } from './components/modals/DeleteModal';
import { SearchPalette } from './components/ui/SearchPalette';
import type { Snapshot } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingDate, setDeletingDate] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSelect = (path: string) => {
    setActiveTab('dashboard');
    // Dispatch custom event to let Dashboard know to jump
    window.dispatchEvent(new CustomEvent('jump-to-path', { detail: { path } }));
  };

  const openDeleteModal = (snapshot: Snapshot) => {
    setDeletingId(snapshot.id);
    setDeletingDate(new Date(snapshot.timestamp).toLocaleString());
  };

  const confirmDelete = () => {
    if (deletingId) {
      window.dispatchEvent(new CustomEvent('history-action', {
        detail: { action: 'confirm-delete', id: deletingId }
      }));
      setDeletingId(null);
    }
  };

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
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard'
                      ? 'bg-black/6 text-gray-900'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                      }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                      ? 'bg-black/6 text-gray-900'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                      }`}
                  >
                    History
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings'
                      ? 'bg-black/6 text-gray-900'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-black/4'
                      }`}
                  >
                    Settings
                  </button>
                </nav>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 pt-10 pb-12">
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'history' && <HistoryView onOpenDeleteModal={openDeleteModal} />}
              {activeTab === 'settings' && <SettingsView />}
            </div>
          </main>
        </div>
      </div>

      <DeleteModal
        isOpen={deletingId !== null}
        date={deletingDate}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />

      <SearchPalette 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
    </QueryClientProvider>
  );
}

export default App;
