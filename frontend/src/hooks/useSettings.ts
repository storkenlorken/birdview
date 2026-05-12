import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

export function useSettings() {
  const { data: settings, isLoading, refetch } = useQuery<Record<string, any>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      return res.json();
    }
  });

  const updateSettings = async (newSettings: Record<string, any>) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    refetch();
    // Invalidate stats so the dashboard updates (e.g. Next Scan Time)
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  return {
    settings,
    isLoading,
    refetch,
    updateSettings
  };
}
