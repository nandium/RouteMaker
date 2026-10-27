import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AscentInput, AscentNote, Route } from '../../app/src/client-contract';
import {
  GYM,
  api,
  count,
  disable,
  hideInDb,
  logAscent,
  publish,
  removeAscent,
  signIn,
} from './helpers';

const current = async (routeId: string, token?: string) =>
  (await api(`/routes/${routeId}`, { token })).json<Route>();

describe('logging an ascent', () => {
  it("records the climber's own ascent on the route", async () => {
    const author = await signIn();
    const climber = await signIn();
    const route = await publish(author);

    const response = await logAscent(climber, route.id, {
      sent: true,
      grade: 'v6',
      note: '  Slopey start  ',
    });
    expect(response.status).toBe(200);
    const updated = await response.json<Route>();
    expect(updated).toMatchObject({
      id: route.id,
      sends: 1,
      public_grade: 'V6',
    });
    expect(updated.my_ascent).toEqual({
      sent: true,
      grade: 'V6',
      note: 'Slopey start',
      updated_at: expect.any(Number),
    });

    expect((await current(route.id, climber.token)).my_ascent).toEqual(updated.my_ascent);
    expect((await current(route.id, author.token)).my_ascent).toBeNull();
    expect((await current(route.id)).my_ascent).toBeNull();
  });

  it('replaces the previous ascent, clearing omitted fields', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    await logAscent(climber, route.id, { sent: true, grade: 'V5', note: 'Crimpy' });

    const again = await (await logAscent(climber, route.id, { sent: false })).json<Route>();
    expect(again.my_ascent).toMatchObject({
      sent: false,
      grade: null,
      note: null,
    });
    expect(again.sends).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM ascents WHERE route_id = ?', route.id)).toBe(1);
  });

  it('treats a blank or null note and grade as absent', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    for (const input of [
      { sent: true, note: '', grade: null },
      { sent: true, note: '   ' },
      { sent: true, note: null },
    ]) {
      const updated = await (await logAscent(climber, route.id, input)).json<Route>();
      expect(updated.my_ascent).toMatchObject({ note: null, grade: null });
    }
  });

  it('removes the ascent', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    await logAscent(climber, route.id, { sent: true, grade: 'V9' });

    const response = await removeAscent(climber, route.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sends: 0,
      my_ascent: null,
      public_grade: 'V4',
    });
    expect((await removeAscent(climber, route.id)).status).toBe(200);
  });

  it('validates the input', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    const invalid: unknown[] = [
      {},
      { sent: 'yes' },
      { sent: 1 },
      { sent: true, grade: 'V18' },
      { sent: true, grade: 5 },
      { sent: true, grade: '' },
      { sent: true, note: 5 },
      { sent: true, note: 'x'.repeat(501) },
    ];
    for (const input of invalid) {
      const response = await logAscent(climber, route.id, input);
      expect(response.status, JSON.stringify(input)).toBe(422);
    }
    const longest = await logAscent(climber, route.id, {
      sent: true,
      note: 'x'.repeat(500),
    });
    expect(longest.status).toBe(200);
  });

  it('needs a session and a visible route', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    const input: AscentInput = { sent: true };
    expect((await api(`/routes/${route.id}/ascent`, { method: 'PUT', json: input })).status).toBe(
      401
    );
    expect((await api(`/routes/${route.id}/ascent`, { method: 'DELETE' })).status).toBe(401);
    expect((await logAscent(climber, 'unknown', input)).status).toBe(404);
    await hideInDb(route);
    expect((await logAscent(climber, route.id, input)).status).toBe(404);
  });

  it("includes the viewer's ascent in route lists", async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    await logAscent(climber, route.id, { sent: true, note: 'Fun' });
    const list = await (
      await api(`/routes?gym_id=${GYM}`, { token: climber.token })
    ).json<Route[]>();
    expect(list[0].my_ascent).toMatchObject({ sent: true, note: 'Fun' });
    expect(list[0].sends).toBe(1);
  });
});

describe('the public grade', () => {
  it('only counts graded sends, the easier grade winning ties', async () => {
    const [a, b, c, d] = [await signIn(), await signIn(), await signIn(), await signIn()];
    const route = await publish(await signIn(), { owner_grade: 'V4' });
    expect((await current(route.id)).public_grade).toBe('V4');

    // Unsent and ungraded ascents never move the grade.
    await logAscent(a, route.id, { sent: false, grade: 'V10' });
    await logAscent(b, route.id, { sent: true });
    expect(await current(route.id)).toMatchObject({
      public_grade: 'V4',
      sends: 1,
    });

    await logAscent(c, route.id, { sent: true, grade: 'V6' });
    expect((await current(route.id)).public_grade).toBe('V6');
    await logAscent(d, route.id, { sent: true, grade: 'V3' });
    expect((await current(route.id)).public_grade).toBe('V3');
    await logAscent(a, route.id, { sent: true, grade: 'V6' });
    expect(await current(route.id)).toMatchObject({
      public_grade: 'V6',
      sends: 4,
    });

    await logAscent(a, route.id, { sent: false, grade: 'V6' });
    expect((await current(route.id)).public_grade).toBe('V3');

    await disable(d);
    await disable(c);
    expect(await current(route.id)).toMatchObject({
      public_grade: 'V4',
      sends: 1,
    });
  });
});

describe('notes', () => {
  it('lists notes newest first, without the empty ones', async () => {
    const author = await signIn();
    const [first, second, silent] = [await signIn(), await signIn(), await signIn()];
    const route = await publish(author);
    await logAscent(first, route.id, { sent: true, grade: 'V5', note: 'First' });
    await logAscent(second, route.id, { sent: false, note: 'Second' });
    await logAscent(silent, route.id, { sent: true, grade: 'V5' });
    await env.DB.prepare('UPDATE ascents SET updated_at=updated_at-100 WHERE user_id=?')
      .bind(first.user.id)
      .run();

    const response = await api(`/routes/${route.id}/notes`);
    expect(response.status).toBe(200);
    const notes = await response.json<AscentNote[]>();
    expect(notes).toEqual([
      {
        id: expect.any(String),
        author: {
          username: second.user.username,
          display_name: second.user.display_name,
        },
        sent: false,
        grade: null,
        note: 'Second',
        updated_at: expect.any(Number),
      },
      {
        id: expect.any(String),
        author: {
          username: first.user.username,
          display_name: first.user.display_name,
        },
        sent: true,
        grade: 'V5',
        note: 'First',
        updated_at: expect.any(Number),
      },
    ]);
  });

  it('keeps one stable note id per climber', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    await logAscent(climber, route.id, { sent: true, note: 'One' });
    const [first] = await (await api(`/routes/${route.id}/notes`)).json<AscentNote[]>();
    await logAscent(climber, route.id, { sent: true, note: 'Two' });
    const [second] = await (await api(`/routes/${route.id}/notes`)).json<AscentNote[]>();
    expect(second).toMatchObject({ id: first.id, note: 'Two' });
  });

  it('hides notes of disabled climbers and of hidden routes', async () => {
    const climber = await signIn();
    const route = await publish(await signIn());
    await logAscent(climber, route.id, { sent: true, note: 'Hello' });
    await disable(climber);
    expect(await (await api(`/routes/${route.id}/notes`)).json()).toEqual([]);
    expect((await api('/routes/unknown/notes')).status).toBe(404);
  });
});
