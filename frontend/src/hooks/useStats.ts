import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '../types';

export function useStats() {
  const [isStarting, setIsStarting] = useState(false);

  const { data, isLoading, refetch } = useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
    refetchInterval: 3000,
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
