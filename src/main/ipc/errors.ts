import type { SafeError } from '@shared/types/ipc';

export function toSafeError(code: string, message: string): SafeError {
  return {
    code,
    message
  };
}
