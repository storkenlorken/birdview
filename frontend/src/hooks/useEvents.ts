import { useState, useEffect } from 'react';

export interface ProgressUpdate {
  filesScanned: number;
  bytesScanned: number;
  currentPath: string;
  isRunning: boolean;
  startTime: string;
}

export function useEvents() {
  const [lastUpdate, setLastUpdate] = useState<ProgressUpdate | null>(null);

  useEffect(() => {
    const connect = () => {
      const eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastUpdate(data);
        } catch (err) {
          console.error('Failed to parse SSE event', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error, reconnecting in 3s...', err);
        eventSource.close();
        setTimeout(connect, 3000);
      };

      return eventSource;
    };

    const es = connect();

    return () => {
      es.close();
    };
  }, []);

  return lastUpdate;
}
