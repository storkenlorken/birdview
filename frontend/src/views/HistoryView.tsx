import { useEffect } from 'react';
import { RefreshCw, History, Calendar, Clock, Trash2, PieChart as PieChartIcon } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useHistory } from '../hooks/useHistory';
import type { Snapshot } from '../types';
import { formatBytes } from '../lib/utils';

interface HistoryViewProps {
  onOpenDeleteModal: (s: Snapshot) => void;
}

export function HistoryView({ onOpenDeleteModal }: HistoryViewProps) {
  const { history, isLoading, deleteSnapshot } = useHistory();

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail.action === 'confirm-delete') {
        deleteSnapshot(e.detail.id);
      }
    };
    window.addEventListener('history-action', handleAction);
    return () => window.removeEventListener('history-action', handleAction);
  }, [deleteSnapshot]);

  if (isLoading || !history) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin opacity-40" />
      </div>
    );
  }

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `<div class="p-2">
          <div class="text-xs text-gray-500 mb-1">${new Date(data.name).toLocaleString()}</div>
          <div class="font-bold text-gray-900">${formatBytes(data.value)}</div>
        </div>`;
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.05)',
      textStyle: { color: '#111827' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: history.map(s => s.timestamp),
      axisLabel: {
        formatter: (value: string) => new Date(value).toLocaleDateString(),
        color: '#9ca3af',
        fontSize: 11
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatBytes(value, 0),
        color: '#9ca3af',
        fontSize: 11
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }
    },
    series: [{
      data: history.map(s => s.totalSizeBytes),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ]
        }
      },
      lineStyle: { width: 3 }
    }]
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-xl">
            <PieChartIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Storage Trends</h2>
            <p className="text-sm text-gray-500">Historical growth of your protected data</p>
          </div>
        </div>
        <div className="h-[300px]">
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-2 bg-gray-50 rounded-xl">
            <History className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Scan History</h2>
            <p className="text-sm text-gray-500">Chronological log of all completed scans</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="pb-4 font-medium">Date & Time</th>
                <th className="pb-4 font-medium">Total Size</th>
                <th className="pb-4 font-medium">Files</th>
                <th className="pb-4 font-medium">Duration</th>
                <th className="pb-4 font-medium text-right w-24">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {history.slice().reverse().map((s) => (
                <tr key={s.id} className="group hover:bg-black/[0.02] transition-colors">
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-300" />
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(s.timestamp).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-sm font-semibold text-gray-900">{formatBytes(s.totalSizeBytes)}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-gray-500">{s.totalFiles.toLocaleString()} files</span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center space-x-1.5 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs">{Math.round(s.durationMs / 1000)}s</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end relative h-8">
                      <span className="text-xs font-mono text-gray-300 transition-opacity group-hover:opacity-0">#{s.id}</span>
                      <button
                        onClick={() => onOpenDeleteModal(s)}
                        className="absolute right-0 opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete this scan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
