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
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;

    const connect = () => {
      // Clear any existing connection/timeout before starting a new one
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      eventSource = new EventSource('/api/events');

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
        if (eventSource) eventSource.close();
        
        // Schedule reconnect only if we aren't unmounted
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    // Cleanup: Perfectly kill both the connection and the timer
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return lastUpdate;
}
