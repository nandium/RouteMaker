import { findRoute } from './routes';
import type { Env } from './env';
import type { Params } from './http';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ENTITIES[char]);

const property = (key: string, value: string) =>
  `<meta property="${key}" content="${escapeHtml(value)}">`;
const named = (key: string, value: string) => `<meta name="${key}" content="${escapeHtml(value)}">`;

/**
 * The web shell for /routes/:id, with link-preview tags for that route. Unknown
 * and hidden routes get the plain shell, so previews never reveal them.
 */
export async function getRoutePage(req: Request, env: Env, { id }: Params) {
  // The shell is index.html whatever the path; the client router does the rest.
  const shell = await env.ASSETS.fetch(new URL('/', req.url));
  const route = await findRoute(env, id, null);
  if (!route || !shell.ok) return shell;

  const origin = new URL(req.url).origin;
  const title = `${route.name} · ${route.public_grade} · ${route.gym.name}`;
  const description = `Set by ${route.author.display_name} at ${route.gym.name}. ${route.sends} sends, ${route.likes} likes.`;
  const image = new URL(route.thumb_url, origin).href;
  const tags = [
    named('description', description),
    property('og:site_name', 'RouteMaker'),
    property('og:type', 'website'),
    property('og:title', title),
    property('og:description', description),
    property('og:image', image),
    property('og:url', `${origin}/routes/${route.id}`),
    named('twitter:card', 'summary_large_image'),
    named('twitter:title', title),
    named('twitter:description', description),
    named('twitter:image', image),
  ].join('');

  // Keep the shell's headers, so the security headers configured for the site
  // apply here too; the body changes, so its length and etag no longer fit.
  const headers = new Headers(shell.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'no-cache');
  return new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('head', { element: (el) => void el.append(tags, { html: true }) })
    .transform(new Response(shell.body, { status: shell.status, headers }));
}
