import { expect, test } from 'vitest';

import { API_PATHS } from '../client-contract.js';

type Paths = Record<string, unknown>;

/** Every path builder that takes a single id, with where it sits in API_PATHS. */
function idBuilders(paths: Paths, prefix = ''): [string, (id: string) => string][] {
  return Object.entries(paths).flatMap(([name, value]) => {
    if (typeof value === 'function' && value.length === 1) {
      return [[prefix + name, value as (id: string) => string]];
    }
    if (value && typeof value === 'object') return idBuilders(value as Paths, `${prefix}${name}.`);
    return [];
  });
}

test('finds the id-taking builders it is meant to guard', () => {
  expect(idBuilders(API_PATHS).map(([name]) => name)).toEqual(
    expect.arrayContaining(['route', 'like', 'ascent', 'notes', 'profile', 'follow', 'admin.user'])
  );
});

test.each(idBuilders(API_PATHS))(
  'keeps a hostile id inside its own segment in %s',
  (_name, build) => {
    const hostile = '../admin/users?x=1#frag';
    const [safe, unsafe] = [build('x'), build(hostile)];

    expect(unsafe).toContain(encodeURIComponent(hostile));
    expect(unsafe.split('/')).toHaveLength(safe.split('/').length);
    expect(unsafe).not.toMatch(/[?#]/);
  }
);
