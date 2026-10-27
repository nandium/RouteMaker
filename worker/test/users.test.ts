import { describe, expect, it } from 'vitest';
import type { PublicProfile } from '../../app/src/client-contract';
import { PASSWORD, api, disable, follow, signIn, signUpOnly } from './helpers';
import { firebase } from './fake-firebase';

describe('profiles', () => {
  it('shows counts for active accounts and the viewer relationship', async () => {
    const [target, fan, other] = [await signIn(), await signIn(), await signIn()];
    const profile = async (token?: string) =>
      (await api(`/users/${target.user.username.toUpperCase()}`, { token })).json<PublicProfile>();
    for (const user of [fan, other]) await follow(user, target.user.id);
    await follow(target, fan.user.id);

    expect(await profile(fan.token)).toEqual({
      id: target.user.id,
      username: target.user.username,
      display_name: target.user.display_name,
      followers: 2,
      following: 1,
      followed: true,
    });
    expect(await profile()).toMatchObject({ followers: 2, followed: false });

    await disable(other);
    expect(await profile()).toMatchObject({ followers: 1 });
  });

  it("hides a disabled account's profile", async () => {
    const user = await signIn();
    await disable(user);
    expect((await api(`/users/${user.user.username}`)).status).toBe(404);
    expect((await api('/users/nobody-here')).status).toBe(404);
  });
});

describe('an account whose email is not verified yet', () => {
  it('is not public until its first login', async () => {
    const newcomer = await signUpOnly();
    const fan = await signIn();

    expect((await api(`/users/${newcomer.username}`)).status).toBe(404);
    expect((await follow(fan, newcomer.id)).status).toBe(404);

    firebase.verify(newcomer.email);
    const login = await api('/auth/login', { json: { email: newcomer.email, password: PASSWORD } });
    expect(login.status).toBe(200);

    expect((await api(`/users/${newcomer.username}`)).status).toBe(200);
    expect((await follow(fan, newcomer.id)).status).toBe(200);
  });
});

describe('following', () => {
  it('follows and unfollows idempotently, answering with the new follower count', async () => {
    const [target, fan, other] = [await signIn(), await signIn(), await signIn()];
    const answer = async (user: typeof fan, followed: boolean) => {
      const response = await follow(user, target.user.id, followed);
      expect(response.status).toBe(200);
      return response.json();
    };

    expect(await answer(fan, true)).toEqual({ followed: true, followers: 1 });
    expect(await answer(fan, true)).toEqual({ followed: true, followers: 1 });
    expect(await answer(other, true)).toEqual({ followed: true, followers: 2 });
    expect(await answer(fan, false)).toEqual({ followed: false, followers: 1 });
    expect(await answer(fan, false)).toEqual({ followed: false, followers: 1 });
  });

  it('counts only active followers in that answer', async () => {
    const [target, fan, gone] = [await signIn(), await signIn(), await signIn()];
    await follow(gone, target.user.id);
    await disable(gone);

    const response = await follow(fan, target.user.id);
    expect(await response.json()).toEqual({ followed: true, followers: 1 });
  });

  it('rejects invalid follows', async () => {
    const user = await signIn();
    for (const followed of [true, false]) {
      const label = followed ? 'follow' : 'unfollow';
      expect((await follow(user, user.user.id, followed)).status, `${label} self`).toBe(422);
      expect((await follow(user, 'unknown', followed)).status, `${label} unknown`).toBe(404);
      const anonymous = await api('/users/unknown/follow', { method: followed ? 'PUT' : 'DELETE' });
      expect(anonymous.status, `${label} anonymous`).toBe(401);
    }
  });
});
