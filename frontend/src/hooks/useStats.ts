import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '../types';

export function useStats(snapshotId?: number | null) {
  const [isStarting, setIsStarting] = useState(false);

  const { data, isLoading, refetch } = useQuery<StatsResponse>({
    queryKey: ['stats', snapshotId],
    queryFn: async () => {
      const url = snapshotId ? `/api/stats?id=${snapshotId}` : '/api/stats';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    refetchInterval: snapshotId ? false : 3000, // Disable polling when viewing history
  });

  // Clear the optimistic "starting" state once the backend confirms scanning
  useEffect(() => {
    if (data?.isScanning) setIsStarting(false);
  }, [data?.isScanning]);

  const startScan = async () => {
    setIsStarting(true);
    await fetch('/api/scan/start', { method: 'POST' });
    refetch();
  };

  return {
    data,
    isLoading,
    isStarting,
    startScan,
    refetch
  };
}
