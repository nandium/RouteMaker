import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  GYM,
  ORIGIN,
  api,
  countQueries,
  disable,
  hideInDb,
  like,
  logAscent,
  publish,
  signIn,
} from './helpers';

const page = (path: string, init?: RequestInit) => exports.default.fetch(`${ORIGIN}${path}`, init);

describe('link previews', () => {
  it('adds preview tags for a route to the web shell', async () => {
    const author = await signIn();
    const route = await publish(author, { name: 'Blue Arete' });
    await logAscent(author, route.id, { sent: true, grade: 'V6' });
    await like(author, route.id);

    const response = await page(`/routes/${route.id}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<title>Blue Arete · V6 · Boulder+ Aperia</title>');
    const description = `Set by ${author.user.display_name} at Boulder+ Aperia. 1 sends, 1 likes.`;
    for (const tag of [
      `<meta property="og:title" content="Blue Arete · V6 · Boulder+ Aperia">`,
      `<meta property="og:description" content="${description}">`,
      `<meta property="og:image" content="${ORIGIN}/media/${route.id}/thumb">`,
      `<meta property="og:url" content="${ORIGIN}/routes/${route.id}">`,
      `<meta property="og:type" content="website">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="Blue Arete · V6 · Boulder+ Aperia">`,
      `<meta name="twitter:image" content="${ORIGIN}/media/${route.id}/thumb">`,
      `<meta name="description" content="${description}">`,
    ])
      expect(html, tag).toContain(tag);
  });

  it('escapes everything user-controlled', async () => {
    const author = await signIn();
    const attack = `"><script>alert(1)</script>&'`;
    await api('/me', {
      method: 'PATCH',
      token: author.token,
      json: { display_name: `<img src=x onerror=alert(2)>` },
    });
    await env.DB.prepare('UPDATE gyms SET name = ? WHERE id = ?')
      .bind(`Gym "><svg onload=alert(3)>`, GYM)
      .run();
    const route = await publish(author, { name: attack });

    const html = await (await page(`/routes/${route.id}`)).text();

    for (const raw of ['<script>alert(1)', '<img src=x', '<svg onload']) {
      expect(html, raw).not.toContain(raw);
    }
    // Attributes escape quotes; text content escapes markup.
    expect(html).toContain(
      `<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;&#39; · V4 · Gym &quot;&gt;&lt;svg onload=alert(3)&gt;">`
    );
    expect(html).toContain(
      `<title>"&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;' · V4 · Gym "&gt;&lt;svg onload=alert(3)&gt;</title>`
    );
    expect(html).toContain('Set by &lt;img src=x onerror=alert(2)&gt; at Gym');
    // The document still has exactly one head, one title and an intact body.
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/<\/head>/g)).toHaveLength(1);
    expect(html).toContain('<div id="app"></div>');
  });

  it('serves the plain shell for unknown, hidden and disabled routes', async () => {
    const hidden = await publish(await signIn());
    const author = await signIn();
    const disabled = await publish(author);
    await hideInDb(hidden);
    await disable(author);

    for (const path of ['/routes/unknown', `/routes/${hidden.id}`, `/routes/${disabled.id}`]) {
      const response = await page(path);
      const html = await response.text();
      expect(response.status, path).toBe(200);
      expect(html, path).toContain('<title>RouteMaker</title>');
      expect(html, path).not.toContain('og:');
      expect(html, path).not.toContain('twitter:');
    }
  });

  it('costs one database query', async () => {
    const route = await publish(await signIn());
    const queries = await countQueries(async () => (await page(`/routes/${route.id}`)).text());
    expect(queries).toBe(1);
  });

  it("keeps the site's own response headers and drops the stale ones", async () => {
    const route = await publish(await signIn());
    const response = await page(`/routes/${route.id}`);
    // test/assets/_headers stands in for the production security headers.
    expect(response.headers.get('x-shell-header')).toBe('present');
    expect(response.headers.has('etag')).toBe(false);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    const plain = await page('/routes/unknown');
    expect(plain.headers.get('x-shell-header')).toBe('present');
  });

  it('answers HEAD like GET, without a body', async () => {
    const route = await publish(await signIn());
    const response = await page(`/routes/${route.id}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('');
  });

  it('only answers reads', async () => {
    const route = await publish(await signIn());
    const response = await page(`/routes/${route.id}`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});
