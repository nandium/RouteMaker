import type { Gym, Place } from '../src/client-contract.js';
import type { Map, Marker } from 'maplibre-gl';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { browserRequest } from './http.js';
import { createInitialMapCenter, mountPlaceSearch } from './map.js';

vi.mock('./http.js', () => ({ browserRequest: vi.fn() }));
vi.mock('../src/appearance.js', () => ({ THEME_CHANGE_EVENT: 'routemaker:themechange' }));

const request = vi.mocked(browserRequest);
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new () => { window: Window & typeof globalThis };
};

function map() {
  return {
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 10),
    setCenter: vi.fn(),
  };
}

describe('initial map centering', () => {
  it('lets device location replace a coarse fallback', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.fallback({ latitude: 1.35, longitude: 103.82 });
    center.device({ latitude: 1.3004, longitude: 103.8006 });

    expect(target.setCenter).toHaveBeenCalledWith([103.82, 1.35]);
    expect(target.flyTo).toHaveBeenCalledWith({ center: [103.801, 1.3], zoom: 13 });
  });

  it('does not let a late fallback replace device location', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.device({ latitude: 1.3, longitude: 103.8 });
    center.fallback({ latitude: 1.35, longitude: 103.82 });

    expect(target.flyTo).toHaveBeenCalledOnce();
    expect(target.setCenter).not.toHaveBeenCalled();
  });

  it('does not move the map after user interaction', () => {
    const target = map();
    const center = createInitialMapCenter(target);

    center.interact();
    center.fallback({ latitude: 1.35, longitude: 103.82 });
    center.device({ latitude: 1.3, longitude: 103.8 });

    expect(target.setCenter).not.toHaveBeenCalled();
    expect(target.flyTo).not.toHaveBeenCalled();
  });
});

function gym(name = 'Boulder+ Aperia'): Gym {
  return {
    id: 'gym-1',
    name,
    address: '12 Kallang Ave, Singapore',
    country_code: 'SG',
    latitude: 1.31,
    longitude: 103.86,
    status: 'approved',
  };
}

function place(index: number, latitude = 1.32, longitude = 103.87): Place {
  return {
    name: `Place ${index}`,
    address: `Address ${index}`,
    latitude: latitude + index / 1000,
    longitude: longitude + index / 1000,
  };
}

function mountSearch(gyms: Gym[] = []) {
  const shell = document.createElement('div');
  const target = {
    flyTo: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 1.301234, lng: 103.801234 })),
    getZoom: vi.fn(() => 10),
  } as unknown as Map;
  const markers = gyms.map((item) => ({
    gym: item,
    marker: {
      getPopup: vi.fn(() => null),
    } as unknown as Marker,
  }));
  mountPlaceSearch(shell, target, markers, vi.fn(), vi.fn());
  document.body.append(shell);
  return {
    form: shell.querySelector('form')!,
    input: shell.querySelector('input')!,
    results: shell.querySelector<HTMLElement>('.map-search__results')!,
  };
}

function submit(form: HTMLFormElement, input: HTMLInputElement, query: string) {
  input.value = query;
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
}

describe('place search', () => {
  beforeEach(() => {
    const window = new JSDOM().window;
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('HTMLElement', window.HTMLElement);
    vi.stubGlobal('SubmitEvent', window.SubmitEvent);
    vi.stubGlobal('KeyboardEvent', window.KeyboardEvent);
    request.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('always queries Photon, deduplicates coordinates, and caps combined results', async () => {
    const localGym = gym();
    request.mockResolvedValue([
      {
        name: 'Duplicate gym',
        address: localGym.address,
        latitude: localGym.latitude,
        longitude: localGym.longitude,
      },
      ...Array.from({ length: 8 }, (_, index) => place(index)),
    ]);
    const { form, input, results } = mountSearch([localGym]);

    submit(form, input, 'boulder+');

    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(request.mock.calls[0]?.[0]).toContain('q=boulder%2B');
    await vi.waitFor(() => expect(results.querySelectorAll('.map-search__result')).toHaveLength(5));
    expect(results.textContent).toContain(localGym.name);
    expect(results.textContent).not.toContain('Duplicate gym');
    expect(results.textContent).toContain('© OpenStreetMap contributors');
  });

  it('aborts dismissal and ignores a late response', async () => {
    let resolvePlaces!: (places: Place[]) => void;
    request.mockImplementation(
      () =>
        new Promise<Place[]>((resolve) => {
          resolvePlaces = resolve;
        })
    );
    const { form, input, results } = mountSearch();

    submit(form, input, 'pending place');
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const signal = request.mock.calls[0]?.[1]?.signal;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    resolvePlaces([place(1)]);

    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(results.hidden).toBe(true);
    expect(results.childElementCount).toBe(0);
  });

  it('keeps local results when Photon fails and rejects invalid query lengths locally', async () => {
    request.mockRejectedValue(new Error('Provider unavailable'));
    const localGym = gym();
    const { form, input, results } = mountSearch([localGym]);

    submit(form, input, 'bo');
    expect(request).not.toHaveBeenCalled();

    submit(form, input, 'boulder+');
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(results.textContent).toContain(localGym.name));
    expect(results.textContent).not.toContain('Provider unavailable');
  });
});
