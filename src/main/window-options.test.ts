import { describe, expect, it } from 'vitest';
import { resolvePreloadPath } from './window-options';

describe('resolvePreloadPath', () => {
  it('points Electron at the CommonJS preload bundle required by the renderer sandbox', () => {
    expect(resolvePreloadPath('D:\\app\\dist\\main')).toBe(
      'D:\\app\\dist\\preload\\index.cjs'
    );
  });
});
