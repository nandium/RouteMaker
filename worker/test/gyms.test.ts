import { describe, expect, it } from 'vitest';
import type { CreatedResponse, GymListing } from '../../app/src/client-contract';
import { GYM, api, disable, publish, signIn } from './helpers';

describe('gyms', () => {
  const gym = (overrides: Record<string, unknown> = {}) => ({
    name: 'Climb Central',
    address: '1 Wall Street',
    country_code: 'sg',
    latitude: 1.3,
    longitude: 103.8,
    ...overrides,
  });

  it('lists approved gyms with their visible route counts, cached briefly', async () => {
    const author = await signIn();
    await publish(author);
    const removed = await publish(author);
    const routeCount = async () =>
      (await (await api('/gyms')).json<GymListing[]>()).find((item) => item.id === GYM);

    const response = await api('/gyms');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(await routeCount()).toMatchObject({ id: GYM, route_count: 2, status: 'approved' });
    await api(`/routes/${removed.id}`, { method: 'DELETE', token: author.token });
    expect((await routeCount())!.route_count).toBe(1);
    await disable(author);
    expect((await routeCount())!.route_count).toBe(0);
  });

  it('queues a pending gym that stays out of the public list', async () => {
    const user = await signIn();
    const response = await api('/gyms', {
      token: user.token,
      json: gym({ name: 'Hidden until approved' }),
    });
    expect(response.status).toBe(201);
    const { id } = await response.json<CreatedResponse>();

    const listed = await (await api('/gyms')).json<GymListing[]>();
    expect(listed.some((item) => item.id === id)).toBe(false);
    expect(listed.every((item) => item.status === 'approved')).toBe(true);
  });

  it('validates details', async () => {
    const user = await signIn();
    const invalid = [
      { name: 'x' },
      { name: '😀' },
      { address: '😀😀' },
      { country_code: 'SGP' },
      { country_code: '1a' },
      { latitude: 91 },
      { longitude: -181 },
      { latitude: '1.3' },
      { longitude: null },
    ];
    for (const override of invalid) {
      const response = await api('/gyms', {
        token: user.token,
        json: gym(override),
      });
      expect(response.status, JSON.stringify(override)).toBe(422);
    }
    expect((await api('/gyms', { token: user.token, json: [] })).status).toBe(400);
    expect((await api('/gyms', { json: gym() })).status).toBe(401);
  });

  it('limits pending requests per account', async () => {
    const user = await signIn();
    for (let i = 0; i < 5; i++) {
      expect((await api('/gyms', { token: user.token, json: gym() })).status).toBe(201);
    }
    expect((await api('/gyms', { token: user.token, json: gym() })).status).toBe(429);
  });
});
