import type { MarkingState } from './marking-editor.js';

/** Everything but the photo. */
export type DraftDetails = {
  markings: MarkingState;
  name: string;
  gymId: string;
  grade: string;
};

export type Draft = { photo: File; details: DraftDetails };

/**
 * The route being made, kept on this device so a reload or an expired session loses nothing.
 * It belongs to one account: another account never sees it.
 */
export type DraftStore = {
  /** The owner's draft; a draft left by another account is deleted instead. */
  load(): Promise<Draft | null>;
  /** Keep the details, and the photo too when it is given (it is large, so only when it changes). */
  save(details: DraftDetails, photo?: File): Promise<void>;
  clear(): Promise<void>;
};

const DATABASE = 'routemaker-drafts';
const STORE = 'route';
const PHOTO = 'photo';
const DETAILS = 'details';
/** Stored with the details; a draft written by a different version is ignored, not guessed at. */
const VERSION = 1;

let database: Promise<IDBDatabase> | undefined;

function open() {
  if (!database) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // A failed open (private window, blocked storage) is tried again next time, not remembered.
    opening.catch(() => (database = undefined));
    database = opening;
  }
  return database;
}

/** Run `work` in one transaction; resolves with the request it returns, once committed. */
async function transact<T = undefined>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const transaction = (await open()).transaction(STORE, mode);
  return new Promise<T | undefined>((resolve, reject) => {
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });
}

type StoredDetails = DraftDetails & { version: number; owner: string };

/** `owner`'s draft in this browser's IndexedDB. Writes can fail (storage full, private windows). */
export function createDraftStore(owner: string): DraftStore {
  const clear = async () => {
    await transact('readwrite', (store) => store.clear());
  };
  return {
    async load() {
      const photo = await transact('readonly', (store) => store.get(PHOTO));
      const stored = (await transact('readonly', (store) => store.get(DETAILS))) as
        StoredDetails | undefined;
      if (stored?.version !== VERSION) return null;
      if (stored.owner !== owner) {
        await clear();
        return null;
      }
      if (!(photo instanceof File)) return null;
      const { markings, name, gymId, grade } = stored;
      return { photo, details: { markings, name, gymId, grade } };
    },
    async save(details, photo) {
      await transact('readwrite', (store) => {
        if (photo) store.put(photo, PHOTO);
        return store.put({ ...details, version: VERSION, owner }, DETAILS);
      });
    },
    clear,
  };
}
