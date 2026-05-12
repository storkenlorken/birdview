import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { formatBytes } from '../../lib/utils';

interface FolderHistoryChartProps {
  path: string;
}

export function FolderHistoryChart({ path }: FolderHistoryChartProps) {
  const { data: history, isLoading } = useQuery<{ timestamp: string, sizeBytes: number }[]>({
    queryKey: ['folder-history', path],
    queryFn: async () => {
      const res = await fetch(`/api/history/folder?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to fetch folder history');
      return res.json();
    }
  });

  if (isLoading || !history || history.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center border border-dashed border-black/5 rounded-xl bg-black/[0.01]">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">History requires 2+ scans</p>
      </div>
    );
  }

  const option = {
    grid: { left: 0, right: 0, top: 10, bottom: 0 },
    xAxis: {
      type: 'category',
      data: history.map(h => h.timestamp),
      show: false
    },
    yAxis: {
      type: 'value',
      show: false,
      min: 'dataMin'
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const d = params[0];
        return `<div class="text-[10px] font-bold">${formatBytes(d.value)}</div><div class="text-[9px] opacity-60">${new Date(d.name).toLocaleDateString()}</div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: [4, 8]
    },
    series: [{
      data: history.map(h => h.sizeBytes),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.15)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]
        }
      }
    }]
  };

  return <ReactECharts option={option} style={{ height: '80px', width: '100%' }} />;
}
