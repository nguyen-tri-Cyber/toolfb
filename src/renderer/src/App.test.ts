import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App without Electron preload', () => {
  it('explains why the browser preview cannot start', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(App))
    );

    expect(html).toContain('Cần mở trong ứng dụng desktop');
    expect(html).toContain('npm run dev');
  });
});
