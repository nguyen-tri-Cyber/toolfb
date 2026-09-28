import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Electron development configuration', () => {
  it('builds the development main process into the package entry directory', () => {
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      main: string;
      scripts: { dev: string; build: string };
    };

    expect(packageJson.main).toBe('dist/main/index.js');
    expect(packageJson.scripts.dev).toBe('electron-vite dev');
    expect(packageJson.scripts.dev).not.toContain('--outDir');
    expect(packageJson.scripts.build).toBe('npm run typecheck && electron-vite build');
  });
});
