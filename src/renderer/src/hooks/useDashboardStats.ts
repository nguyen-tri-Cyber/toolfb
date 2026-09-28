import { useEffect, useState } from 'react';
import type { DashboardStats, SafeError } from '@shared/types/ipc';

interface DashboardStatsState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: SafeError | null;
}

export function useDashboardStats(): DashboardStatsState {
  const [state, setState] = useState<DashboardStatsState>({
    stats: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    let isMounted = true;

    async function loadStats(): Promise<void> {
      const result = await window.fsi.dashboard.getStats();

      if (!isMounted) {
        return;
      }

      if (result.success) {
        setState({ stats: result.data, isLoading: false, error: null });
        return;
      }

      setState({ stats: null, isLoading: false, error: result.error });
    }

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
