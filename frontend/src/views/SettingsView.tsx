import { useState } from 'react';
import { Activity, Shield, Info, Plus, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { Skeleton } from '../components/ui/Skeleton';

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<'general' | 'exclusions' | 'about'>('general');
  const { settings, isLoading, updateSettings } = useSettings();

  if (isLoading || !settings) {
    return (
      <div className="glass rounded-3xl overflow-hidden flex min-h-[600px] animate-in fade-in duration-500">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-black/[0.02] border-r border-black/5 p-4 flex flex-col space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        {/* Content Skeleton */}
        <div className="flex-1 p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4 pt-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl overflow-hidden flex min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar */}
      <div className="w-64 bg-black/[0.02] border-r border-black/5 p-4 flex flex-col space-y-1">
        <button
          onClick={() => setActiveSection('general')}
          className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSection === 'general' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-600 hover:bg-black/5'}`}
        >
          <Activity className="w-4 h-4" />
          <span>General</span>
        </button>
        <button
          onClick={() => setActiveSection('exclusions')}
          className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSection === 'exclusions' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-600 hover:bg-black/5'}`}
        >
          <Shield className="w-4 h-4" />
          <span>Exclusions</span>
        </button>
        <button
          onClick={() => setActiveSection('about')}
          className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSection === 'about' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-600 hover:bg-black/5'}`}
        >
          <Info className="w-4 h-4" />
          <span>About</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeSection === 'general' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">General Settings</h2>
              <p className="text-sm text-gray-500">Configure how BirdView behaves on your server.</p>
            </div>

            <div className="space-y-6">
              <div className="bg-black/[0.01] border border-black/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-semibold text-gray-800">Scan Interval</label>
                    <p className="text-xs text-gray-500">How many days between automatic storage maps.</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={settings.scan_interval_days || 7}
                      onChange={(e) => updateSettings({ scan_interval_days: parseInt(e.target.value) })}
                      className="w-32 accent-blue-500"
                    />
                    <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md min-w-[40px] text-center">
                      {settings.scan_interval_days || 7}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'exclusions' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Scan Exclusions</h2>
              <p className="text-sm text-gray-500">BirdView will ignore any folders or files matching these names.</p>
            </div>

            <div className="space-y-4">
              <div className="flex space-x-2">
                <input
                  id="new-exclusion"
                  type="text"
                  placeholder="e.g. node_modules, .git, venv"
                  className="flex-1 bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        const current = settings.exclusions || [];
                        if (!current.includes(input.value.trim())) {
                          updateSettings({ exclusions: [...current, input.value.trim()] });
                        }
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('new-exclusion') as HTMLInputElement;
                    if (input.value.trim()) {
                      const current = settings.exclusions || [];
                      if (!current.includes(input.value.trim())) {
                        updateSettings({ exclusions: [...current, input.value.trim()] });
                      }
                      input.value = '';
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-black/[0.01] border border-black/5 rounded-2xl overflow-hidden">
                {(settings.exclusions || []).length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm italic">No exclusions configured.</div>
                ) : (
                  <div className="divide-y divide-black/5">
                    {(settings.exclusions as string[]).map((ex) => (
                      <div key={ex} className="flex items-center justify-between px-6 py-3.5 hover:bg-black/[0.01] transition-colors group">
                        <span className="text-sm font-medium text-gray-700">{ex}</span>
                        <button
                          onClick={() => {
                            const current = settings.exclusions || [];
                            updateSettings({ exclusions: current.filter((item: string) => item !== ex) });
                          }}
                          className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center animate-in fade-in duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
              <img src="/logo.png" alt="BirdView" className="w-48 h-auto relative" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">BirdView</h2>
              <p className="text-sm text-gray-500 font-medium tracking-tight">Version 1.0.0 (Internal Build)</p>
            </div>
            <p className="max-w-xs text-sm text-gray-500 leading-relaxed">
              BirdView is a storage analysis tool built for the modern home server. 
              Always snappy, always beautiful.
            </p>
            <div className="pt-4 text-[10px] text-gray-300 uppercase tracking-widest font-bold">
              © 2026 STORKENLORKEN
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
