import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../../app/src/client-contract';
import { ORIGIN, api } from './helpers';

describe('place search', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes Photon results behind the app contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
        expect(url.searchParams.get('q')).toBe('Boulder+ Aperia');
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('lat')).toBe('1.352');
        expect(url.searchParams.get('lon')).toBe('103.820');
        expect(init?.cache).toBe('no-store');
        const feature = {
          type: 'Feature',
          properties: {
            name: 'Boulder+',
            housenumber: '12',
            street: 'Kallang Avenue',
            city: 'Singapore',
            country: 'Singapore',
          },
          geometry: {
            type: 'Point',
            coordinates: [103.8638367, 1.3097138],
          },
        };
        return Response.json({
          type: 'FeatureCollection',
          features: [feature, feature],
        });
      })
    );

    const response = await api('/places?q=Boulder%2B%20Aperia&lat=1.3521&lon=103.8198');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual([
      {
        name: 'Boulder+',
        address: '12 Kallang Avenue, Singapore',
        latitude: 1.3097138,
        longitude: 103.8638367,
      },
    ]);
  });

  it("returns Cloudflare's coarse request location without a provider call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const request = new Request(`${ORIGIN}/api/location`, {
      cf: { latitude: '1.3521', longitude: '103.8198' },
    });

    const response = await exports.default.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      latitude: 1.35,
      longitude: 103.82,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns no coarse location when Cloudflare metadata is unavailable', async () => {
    const response = await api('/location');

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('skips malformed Photon features instead of failing the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          features: [
            null,
            'invalid',
            {
              properties: { name: 'Valid gym' },
              geometry: { coordinates: [103.8, 1.3] },
            },
          ],
        })
      )
    );

    const response = await api('/places?q=Singapore&lat=1.3521&lon=103.8198');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        name: 'Valid gym',
        address: '',
        latitude: 1.3,
        longitude: 103.8,
      },
    ]);
  });

  it('rejects unbounded queries without calling Photon', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await api('/places?q=ab&lat=1.3521&lon=103.8198');

    expect(response.status).toBe(422);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns bad provider responses into a gateway error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}))
    );

    const response = await api('/places?q=Singapore&lat=1.3521&lon=103.8198');

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      detail: 'Place search is temporarily unavailable',
    });
  });

  it('rejects an invalid map center without calling Photon', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await api('/places?q=Singapore&lat=91&lon=103.8198');

    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  const search = () => api('/places?q=Singapore&lat=1.3521&lon=103.8198');

  it('fits places to the limits of a gym', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          features: [
            {
              properties: { name: '😀'.repeat(150), street: 'a'.repeat(300) },
              geometry: { coordinates: [103.8, 1.3] },
            },
          ],
        })
      )
    );

    const [place] = await (await search()).json<Place[]>();

    expect([...place.name]).toHaveLength(100);
    expect(place.address).toHaveLength(200);
  });

  it('answers a provider outage with a gateway error', async () => {
    for (const provider of [
      async () => {
        throw new Error('unreachable');
      },
      async () => new Response('busy', { status: 503 }),
      async () => new Response('<html>', { status: 200 }),
    ]) {
      vi.stubGlobal('fetch', vi.fn(provider));
      expect((await search()).status).toBe(502);
    }
  });
});
