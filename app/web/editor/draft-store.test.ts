import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftDetails } from './draft-store.js';

/** Just enough of IndexedDB for one database with one object store, and ways for it to fail. */
function fakeIndexedDB() {
  const data = new Map<string, unknown>();
  const behaviour = {
    failOpen: false,
    failTransaction: undefined as 'error' | 'abort' | undefined,
  };
  let created = false;
  let opens = 0;
  function done<T>(result: T) {
    return { result } as IDBRequest<T>;
  }
  return {
    data,
    behaviour,
    get opens() {
      return opens;
    },
    open() {
      opens += 1;
      const request = {} as IDBOpenDBRequest & Record<string, unknown>;
      setTimeout(() => {
        if (behaviour.failOpen) {
          (request as { error: unknown }).error = new DOMException('Blocked', 'SecurityError');
          (request.onerror as () => void)?.();
          return;
        }
        const database = {
          createObjectStore: () => undefined,
          transaction: () => {
            const transaction = {} as IDBTransaction & Record<string, unknown>;
            transaction.objectStore = (() => ({
              get: (key: string) => done(data.get(key)),
              put: (value: unknown, key: string) => {
                if (!behaviour.failTransaction) data.set(key, value);
                return done(key);
              },
              clear: () => {
                data.clear();
                return done(undefined);
              },
            })) as unknown as IDBTransaction['objectStore'];
            setTimeout(() => {
              if (behaviour.failTransaction) {
                (transaction as { error: unknown }).error = new DOMException(
                  'Quota',
                  'QuotaExceededError'
                );
                const handler =
                  behaviour.failTransaction === 'error' ? transaction.onerror : transaction.onabort;
                (handler as () => void)?.();
              } else {
                (transaction.oncomplete as () => void)?.();
              }
            });
            return transaction;
          },
        };
        (request as { result: unknown }).result = database;
        if (!created) {
          created = true;
          (request.onupgradeneeded as () => void)?.();
        }
        (request.onsuccess as () => void)?.();
      });
      return request;
    },
  };
}

const details: DraftDetails = {
  markings: { annotations: [], showSequence: true },
  name: 'Hush',
  gymId: 'gym',
  grade: 'V4',
};
const photo = new File(['photo'], 'wall.jpg', { type: 'image/jpeg' });

describe('draft store', () => {
  let idb: ReturnType<typeof fakeIndexedDB>;
  const load = async (owner = 'maya') => (await import('./draft-store.js')).createDraftStore(owner);

  beforeEach(() => {
    vi.resetModules(); // the database connection is kept per module
    idb = fakeIndexedDB();
    vi.stubGlobal('indexedDB', idb);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('has no draft until a photo has been kept', async () => {
    const store = await load();
    expect(await store.load()).toBeNull();

    await store.save(details);

    expect(await store.load()).toBeNull();
  });

  it('keeps the photo with the details, and later saves leave the photo alone', async () => {
    const store = await load();
    await store.save(details, photo);

    await store.save({ ...details, name: 'Hush 2' });

    expect(await store.load()).toEqual({ photo, details: { ...details, name: 'Hush 2' } });
    expect(idb.data.get('photo')).toBe(photo);
  });

  it('writes the photo and the details in one go, so one cannot outlive the other', async () => {
    const store = await load();

    await store.save(details, photo);

    expect([...idb.data.keys()].sort()).toEqual(['details', 'photo']);
  });

  it('forgets everything when cleared', async () => {
    const store = await load();
    await store.save(details, photo);

    await store.clear();

    expect(await store.load()).toBeNull();
    expect(idb.data.size).toBe(0);
  });

  describe('whose draft it is', () => {
    it('comes back for the same account after it has signed in again', async () => {
      await (await load('maya')).save(details, photo);

      // The session expired and the climber signed in again: a new store, the same account.
      expect(await (await load('maya')).load()).toEqual({ photo, details });
    });

    it('is deleted, not offered, when another account opens the editor', async () => {
      await (await load('maya')).save(details, photo);

      expect(await (await load('sam')).load()).toBeNull();

      expect(idb.data.size).toBe(0);
      expect(await (await load('maya')).load()).toBeNull();
    });

    it('is deleted when it records no account', async () => {
      idb.data.set('photo', photo);
      idb.data.set('details', { ...details, version: 1 });

      expect(await (await load()).load()).toBeNull();
      expect(idb.data.size).toBe(0);
    });
  });

  describe('a draft this version did not write', () => {
    it('is ignored when it has no version', async () => {
      const store = await load();
      idb.data.set('photo', photo);
      idb.data.set('details', details);

      expect(await store.load()).toBeNull();
    });

    it('is ignored when it has another version', async () => {
      const store = await load();
      idb.data.set('photo', photo);
      idb.data.set('details', { ...details, version: 2, owner: 'maya' });

      expect(await store.load()).toBeNull();
    });

    it('is read when it has this one', async () => {
      const store = await load();
      await store.save(details, photo);

      expect(idb.data.get('details')).toMatchObject({ version: 1, owner: 'maya' });
      expect(await store.load()).not.toBeNull();
    });
  });

  describe('when storage fails', () => {
    it.each(['error', 'abort'] as const)(
      'rejects a write that the transaction %ss',
      async (how) => {
        const store = await load();
        idb.behaviour.failTransaction = how;

        await expect(store.save(details, photo)).rejects.toMatchObject({
          name: 'QuotaExceededError',
        });
      }
    );

    it('rejects when the database cannot be opened, and tries again next time', async () => {
      const store = await load();
      idb.behaviour.failOpen = true;
      await expect(store.load()).rejects.toMatchObject({ name: 'SecurityError' });

      idb.behaviour.failOpen = false;
      await store.save(details, photo);

      expect(await store.load()).not.toBeNull();
      expect(idb.opens).toBe(2);
    });
  });
});
