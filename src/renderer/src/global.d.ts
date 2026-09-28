import type { FsiApi } from '@shared/types/ipc';

declare global {
  interface Window {
    fsi: FsiApi;
  }
}

export {};
