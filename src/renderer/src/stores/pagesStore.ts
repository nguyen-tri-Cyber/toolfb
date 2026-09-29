import { create } from 'zustand';
import type { FacebookPageRecord, FacebookPageSummary, MetaConnectionStatus, SafeError } from '@shared/types/ipc';

interface PagesState {
  localPages: FacebookPageRecord[];
  accessiblePages: FacebookPageSummary[];
  isLoadingLocal: boolean;
  isLoadingAccessible: boolean;
  hasLoadedAccessible: boolean;
  connectionStatus: MetaConnectionStatus | null;
  error: SafeError | null;
  loadLocalPages: () => Promise<void>;
  loadAccessiblePages: () => Promise<void>;
  loadConnectionStatus: () => Promise<MetaConnectionStatus | null>;
  autoLoadAccessibleIfConnected: () => Promise<void>;
  importPage: (pageId: string) => Promise<boolean>;
  setError: (error: SafeError | null) => void;
}

export const usePagesStore = create<PagesState>((set, get) => ({
  localPages: [],
  accessiblePages: [],
  isLoadingLocal: false,
  isLoadingAccessible: false,
  hasLoadedAccessible: false,
  connectionStatus: null,
  error: null,

  setError: (error) => set({ error }),

  loadConnectionStatus: async () => {
    const result = await window.fsi.meta.getConnectionStatus();
    if (result.success) {
      set({ connectionStatus: result.data });
      return result.data;
    }
    return null;
  },

  loadLocalPages: async () => {
    set({ isLoadingLocal: true });
    const result = await window.fsi.pages.list();
    if (result.success) {
      set({ localPages: result.data.pages, isLoadingLocal: false, error: null });
    } else {
      set({ error: result.error, isLoadingLocal: false });
    }
  },

  loadAccessiblePages: async () => {
    set({ isLoadingAccessible: true, error: null });
    const result = await window.fsi.meta.getAccessiblePages();
    if (result.success) {
      set({
        accessiblePages: result.data.pages,
        hasLoadedAccessible: true,
        isLoadingAccessible: false,
        error: null
      });
    } else {
      set({ error: result.error, isLoadingAccessible: false });
    }
  },

  autoLoadAccessibleIfConnected: async () => {
    const connection = await get().loadConnectionStatus();
    const state = get();
    // If we already have accessible pages in store, don't clear or re-fetch aggressively
    if (state.hasLoadedAccessible && state.accessiblePages.length > 0) {
      return;
    }
    // Load pages as long as there is an active token, even if state is 'permission_missing'
    if (connection && connection.state !== 'disconnected') {
      await get().loadAccessiblePages();
    }
  },

  importPage: async (pageId: string) => {
    const result = await window.fsi.meta.importPage(pageId);
    if (result.success) {
      await get().loadLocalPages();
      set((state) => ({
        accessiblePages: state.accessiblePages.map((page) =>
          page.facebookPageId === pageId ? { ...page, imported: true } : page
        ),
        error: null
      }));
      return true;
    } else {
      set({ error: result.error });
      return false;
    }
  }
}));
