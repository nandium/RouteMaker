import { describe, expect, it } from 'vitest';
import { api, logAscent, publish, publishResponse, signIn, signupBody, uniqueId } from './helpers';

/** Every text limit must agree between the Worker and the SQL CHECK constraints. */
describe('text limits', () => {
  it('accept the maximum and reject one more: account fields', async () => {
    const id = uniqueId();
    const fits = signupBody(id);
    fits.username = id.padEnd(30, 'x');
    fits.display_name = 'd'.repeat(50);
    expect((await api('/auth/signup', { json: fits })).status).toBe(201);

    const tooLong = signupBody();
    expect(
      (
        await api('/auth/signup', {
          json: { ...tooLong, username: 'x'.repeat(31) },
        })
      ).status
    ).toBe(422);
    expect(
      (
        await api('/auth/signup', {
          json: { ...tooLong, display_name: 'd'.repeat(51) },
        })
      ).status
    ).toBe(422);
    expect(
      (
        await api('/auth/signup', {
          json: { ...tooLong, password: 'p'.repeat(129) },
        })
      ).status
    ).toBe(422);
    expect(
      (
        await api('/auth/signup', {
          json: { ...tooLong, password: 'p'.repeat(128) },
        })
      ).status
    ).toBe(201);
  });

  it('accept the maximum and reject one more: route and note', async () => {
    const user = await signIn();
    const route = await publish(user, { name: 'n'.repeat(80) });
    expect((await publishResponse(user, { name: 'n'.repeat(81) })).status).toBe(422);

    const note = (text: string) => logAscent(user, route.id, { sent: true, note: text });
    expect((await note('c'.repeat(501))).status).toBe(422);
    expect((await note('c'.repeat(500))).status).toBe(200);
  });

  it('accept the maximum and reject one more: gym and report', async () => {
    const user = await signIn();
    const gym = (name: string, address: string) =>
      api('/gyms', {
        token: user.token,
        json: { name, address, country_code: 'SG', latitude: 0, longitude: 0 },
      });
    expect((await gym('n'.repeat(100), 'a'.repeat(200))).status).toBe(201);
    expect((await gym('n'.repeat(101), 'a')).status).toBe(422);
    expect((await gym('nn', 'a'.repeat(201))).status).toBe(422);
    expect((await gym('nn', 'aaa')).status).toBe(201);

    const route = await publish(user);
    const report = (details: string) =>
      api('/reports', {
        token: user.token,
        json: {
          target_type: 'route',
          target_id: route.id,
          reason: 'other',
          details,
        },
      });
    expect((await report('r'.repeat(501))).status).toBe(422);
    expect((await report('r'.repeat(500))).status).toBe(201);
  });

  it('count characters rather than UTF-16 units', async () => {
    const user = await signIn();
    const gym = (name: string) =>
      api('/gyms', {
        token: user.token,
        json: {
          name,
          address: '1 Wall Street',
          country_code: 'SG',
          latitude: 0,
          longitude: 0,
        },
      });
    expect((await gym('😀')).status).toBe(422);
    expect((await gym('😀'.repeat(100))).status).toBe(201);
    expect((await gym('😀'.repeat(101))).status).toBe(422);
  });
});
