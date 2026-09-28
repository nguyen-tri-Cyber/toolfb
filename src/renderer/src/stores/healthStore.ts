import { create } from 'zustand';
import type { HealthStatus, SafeError } from '@shared/types/ipc';

interface HealthState {
  health: HealthStatus | null;
  isLoading: boolean;
  error: SafeError | null;
  refreshHealth: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  health: null,
  isLoading: false,
  error: null,
  refreshHealth: async () => {
    set({ isLoading: true, error: null });
    const result = await window.fsi.system.getHealth();

    if (result.success) {
      set({ health: result.data, isLoading: false });
      return;
    }

    set({ error: result.error, isLoading: false });
  }
}));
