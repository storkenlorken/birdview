import { useQuery } from '@tanstack/react-query';
import type { Snapshot } from '../types';
import { queryClient } from '../lib/queryClient';

export function useHistory() {
  const { data: history, isLoading, refetch } = useQuery<Snapshot[]>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    }
  });

  const deleteSnapshot = async (id: number) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      return true;
    } catch (err) {
      console.error('Error deleting snapshot:', err);
      return false;
    }
  };

  return {
    history,
    isLoading,
    refetch,
    deleteSnapshot
  };
}
