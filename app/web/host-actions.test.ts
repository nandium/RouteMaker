import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  goBack,
  historyDepth,
  openExternal,
  pushPath,
  replacePath,
  safePath,
  sharePage,
  stampHistory,
} from './host-actions.js';
import { installDom } from './test-dom.js';

function stubLocation() {
  const location = { origin: 'http://localhost', replace: vi.fn(), assign: vi.fn() };
  vi.stubGlobal('location', location);
  return location;
}

describe('safePath', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps same-origin paths with their query and hash', () => {
    expect(safePath('/routes/blue?tab=1#top')).toBe('/routes/blue?tab=1#top');
  });

  it.each([
    '//evil.example',
    '/\\evil.example/x',
    '/.//evil.example/x',
    '/..//evil.example/x',
    'https://evil.example/',
    'routes',
    '',
    42,
    null,
  ])('rejects %j', (raw) => {
    expect(safePath(raw)).toBeNull();
  });
});

describe('history bridge', () => {
  beforeEach(() => {
    installDom('http://localhost/gyms');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('counts in-app screens and ignores unsafe paths', () => {
    stampHistory('/gyms');
    expect(historyDepth()).toBe(0);

    pushPath('/routes/blue');
    expect(historyDepth()).toBe(1);
    expect(location.pathname).toBe('/routes/blue');

    replacePath('/users/maya');
    expect(historyDepth()).toBe(1);
    expect(location.pathname).toBe('/users/maya');

    pushPath('/\\evil.example');
    pushPath('//evil.example');
    expect(historyDepth()).toBe(1);
    expect(location.pathname).toBe('/users/maya');
  });

  it('goes back through history when the app pushed screens', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    stampHistory('/gyms');
    pushPath('/routes/blue');

    goBack('/feed');

    expect(back).toHaveBeenCalledOnce();
  });

  it('falls back to a safe path when there is nothing to go back to', () => {
    const fake = stubLocation();
    vi.stubGlobal('history', { state: null, back: vi.fn() });

    goBack('/feed');
    goBack('//evil.example');

    expect(fake.replace).toHaveBeenNthCalledWith(1, '/feed');
    expect(fake.replace).toHaveBeenNthCalledWith(2, '/gyms');
  });
});

describe('openExternal', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('navigates to pages on this site only', () => {
    const fake = stubLocation();

    expect(openExternal('http://localhost/routes/new', false)).toBe(true);
    expect(openExternal('/relative', true)).toBe(true);
    expect(openExternal('https://accounts.example/verify', false)).toBe(false);
    expect(openExternal('//accounts.example/verify', false)).toBe(false);
    expect(openExternal('javascript:alert(1)', false)).toBe(false);
    expect(openExternal('data:text/html,hi', false)).toBe(false);
    expect(openExternal(undefined, false)).toBe(false);

    expect(fake.assign).toHaveBeenCalledWith('http://localhost/routes/new');
    expect(fake.replace).toHaveBeenCalledWith('http://localhost/relative');
    expect(fake.assign).toHaveBeenCalledOnce();
    expect(fake.replace).toHaveBeenCalledOnce();
  });
});

describe('sharePage', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  const url = 'http://localhost/routes/blue';

  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    await expect(sharePage('/routes/blue', 'Blue')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Blue', text: 'Blue', url });
  });

  it('reports a dismissed share sheet as cancelled', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });

    await expect(sharePage(url, 'Blue')).resolves.toBe('cancelled');
  });

  it('copies the link when sharing is missing or fails', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(sharePage(url, 'Blue')).resolves.toBe('copied');

    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('denied')),
      clipboard: { writeText },
    });
    await expect(sharePage(url, 'Blue')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('says so when nothing can share or copy', async () => {
    vi.stubGlobal('navigator', {});
    await expect(sharePage(url, 'Blue')).resolves.toBe('unavailable');
    await expect(sharePage(undefined, 'Blue')).resolves.toBe('unavailable');
  });
});
