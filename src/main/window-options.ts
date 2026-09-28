import { join } from 'node:path';

export function resolvePreloadPath(mainBundleDirectory: string): string {
  return join(mainBundleDirectory, '../preload/index.cjs');
}
