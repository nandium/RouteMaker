import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';
import { firebase } from './fake-firebase';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Every test starts from the migrated database and an empty Firebase.
beforeEach(async () => {
  firebase.reset();
  await env.DB.batch([
    // Cascades to sessions, hand-offs, routes, likes, ascents and follows.
    env.DB.prepare('DELETE FROM users'),
    env.DB.prepare('DELETE FROM reports'),
    env.DB.prepare('DELETE FROM throttles'),
    env.DB.prepare("DELETE FROM gyms WHERE id != 'boulder-plus'"),
    env.DB.prepare("UPDATE gyms SET name = 'Boulder+ Aperia' WHERE id = 'boulder-plus'"),
  ]);
});
