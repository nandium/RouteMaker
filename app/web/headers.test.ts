import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { WEB_PATHS } from '../src/web-pages.js';
import { STORAGE_KEYS } from './storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(path.join(here, file), 'utf8');

type Rule = { pattern: string; headers: Map<string, string[]> };

/** The `_headers` file as rules: a path pattern followed by its indented `Name: value` lines. */
function parseHeaders(text: string) {
  const rules: Rule[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      rules.push({ pattern: line.trim(), headers: new Map() });
      continue;
    }
    const [name, ...value] = line.trim().split(':');
    const headers = rules.at(-1)!.headers;
    headers.set(name, [...(headers.get(name) ?? []), value.join(':').trim()]);
  }
  return rules;
}

const rules = parseHeaders(read('_headers'));
const rule = (pattern: string) => rules.find((candidate) => candidate.pattern === pattern)!;
const csp = (pattern: string) => rule(pattern).headers.get('Content-Security-Policy')!.at(-1)!;
const TOOL_PAGES = [WEB_PATHS.gymMap, WEB_PATHS.newRoute, WEB_PATHS.authAction];

/** The inline script web-core writes into its sandbox iframe, which the Lynx CSP must allow. */
function webCoreBootstrapScript() {
  const entry = createRequire(import.meta.url).resolve('@lynx-js/web-core/client');
  const source = readFileSync(
    path.join(path.dirname(entry), 'mainthread/createIFrameRealm.js'),
    'utf8'
  );
  const script = source.match(/>(parent\.postMessage\([^<]*\))<\/script>/)?.[1];
  if (!script) throw new Error('web-core no longer bootstraps its iframe with parent.postMessage.');
  return script;
}

/** A policy's directives: `script-src 'self'` becomes `script-src` -> [`'self'`]. */
function directives(policy: string) {
  return new Map(
    policy.split(';').map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources] as const;
    })
  );
}

/** What every tool page's policy has in common: nothing runs or loads unless listed. */
const BASELINE = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};
const TILES = 'https://tiles.openfreemap.org';
const MAP_WORKER = '/static/assets/maplibre-gl-worker.*';

/** Each tool page's policy beyond the baseline: only what that page uses. */
const NEEDS: Record<string, Record<string, string[]>> = {
  [WEB_PATHS.gymMap]: {
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'", TILES],
    'worker-src': ["'self'"],
  },
  [WEB_PATHS.newRoute]: {
    'img-src': ["'self'", 'blob:'],
    'connect-src': ["'self'"],
    'worker-src': ["'self'"],
  },
  [WEB_PATHS.authAction]: {
    'img-src': ["'self'"],
    'connect-src': ["'self'"],
  },
};

/** The patterns of `run_worker_first`: those the Worker answers, and those it never sees. */
function workerRoutes() {
  const toml = readFileSync(path.join(here, '../../worker/wrangler.toml'), 'utf8');
  const list = toml.match(/^run_worker_first\s*=\s*\[([^\]]*)\]/m)?.[1];
  if (!list) throw new Error('wrangler.toml no longer sets run_worker_first.');
  const patterns = [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return {
    answered: patterns.filter((pattern) => !pattern.startsWith('!')),
    skipped: patterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => pattern.slice(1)),
  };
}

const matches = (pattern: string, route: string) =>
  pattern.endsWith('*') ? route.startsWith(pattern.slice(0, -1)) : route === pattern;

describe('static headers', () => {
  it("allow web-core's iframe bootstrap script by hash", () => {
    const hash = createHash('sha256').update(webCoreBootstrapScript()).digest('base64');

    expect(csp('/*')).toContain(`'sha256-${hash}'`);
  });

  it.each(TOOL_PAGES)('give %s a policy that allows only what the page uses', (page) => {
    // The `!` line detaches the policy inherited from `/*`.
    expect(rule(page).headers.has('! Content-Security-Policy')).toBe(true);

    expect(Object.fromEntries(directives(csp(page)))).toEqual({ ...BASELINE, ...NEEDS[page] });
  });

  it('let only the map reach the tile server', () => {
    const connectsToTiles = (pattern: string) =>
      (directives(csp(pattern)).get('connect-src') ?? []).some((source) => source === TILES);
    const reaching = [...TOOL_PAGES, MAP_WORKER].filter(connectsToTiles);

    expect(reaching).toEqual([WEB_PATHS.gymMap, MAP_WORKER]);
  });

  it("give MapLibre's worker, which fetches the tiles, a policy for that and nothing else", () => {
    expect(rule(MAP_WORKER).headers.has('! Content-Security-Policy')).toBe(true);
    expect(Object.fromEntries(directives(csp(MAP_WORKER)))).toEqual({
      'default-src': ["'none'"],
      'connect-src': [TILES],
    });
  });

  it('name the worker file the map starts', () => {
    const source = read('map/map.ts');
    const worker = source.match(/maplibre-gl\/dist\/(maplibre-gl-worker)\.mjs/)?.[1];

    expect(MAP_WORKER).toBe(`/static/assets/${worker}.*`);
  });

  it('give the Lynx pages the only policy that can evaluate code', () => {
    const evaluating = rules.filter((candidate) =>
      /'unsafe-(eval|inline)'|'wasm-unsafe-eval'/.test(
        candidate.headers.get('Content-Security-Policy')?.at(-1) ?? ''
      )
    );

    expect(evaluating.map((candidate) => candidate.pattern)).toEqual(['/*']);
  });

  it('apply the strict policies to exactly those paths, never a pattern other pages could match', () => {
    const strict = rules.filter((candidate) => candidate.headers.has('! Content-Security-Policy'));

    expect(strict.map((candidate) => candidate.pattern).sort()).toEqual(
      [...TOOL_PAGES, MAP_WORKER].sort()
    );
  });

  it('let both kinds of page load the bundled display font, and nothing else as a font', () => {
    for (const pattern of ['/*', ...TOOL_PAGES]) {
      expect(directives(csp(pattern)).get('font-src')).toEqual(["'self'"]);
    }
  });

  it('keep the device location from every page but the map', () => {
    const features = (pattern: string) => rule(pattern).headers.get('Permissions-Policy')!.at(-1)!;

    expect(features('/*')).toContain('geolocation=(),');
    expect(rule(WEB_PATHS.gymMap).headers.has('! Permissions-Policy')).toBe(true);
    // The same restrictions otherwise, so the map page loses nothing but the location block.
    expect(features(WEB_PATHS.gymMap)).toBe(
      features('/*').replace('geolocation=()', 'geolocation=(self)')
    );
    for (const page of [WEB_PATHS.newRoute, WEB_PATHS.authAction]) {
      expect(rule(page).headers.has('Permissions-Policy')).toBe(false);
    }
  });

  it('keep the Worker from answering a tool page, which would give it the Lynx policy', () => {
    const { answered, skipped } = workerRoutes();

    for (const page of TOOL_PAGES) {
      for (const spelling of [page, `${page}/`]) {
        const reachesWorker =
          answered.some((pattern) => matches(pattern, spelling)) &&
          !skipped.some((pattern) => matches(pattern, spelling));
        expect(reachesWorker, `${spelling} would be answered by the Worker`).toBe(false);
      }
    }
  });

  it('cache only hashed build output, and set Cache-Control once per path class', () => {
    const caching = rules.filter((candidate) => candidate.headers.has('Cache-Control'));

    expect(caching.map((candidate) => candidate.pattern)).toEqual(['/static/*']);
    expect(caching[0].headers.get('Cache-Control')).toHaveLength(1);
    expect(caching[0].headers.get('Cache-Control')![0]).toContain('immutable');
  });

  it('serve the Lynx bundle as text so it is compressed', () => {
    expect(rule('/main.web.bundle').headers.get('Content-Type')).toEqual(['text/plain']);
  });
});

describe('theme-init.js', () => {
  it('reads the theme from the key the page writes it to', () => {
    expect(read('theme-init.js')).toContain(`'${STORAGE_KEYS.theme}'`);
  });
});
