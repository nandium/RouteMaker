export const STORAGE_KEYS = {
  session: 'routemaker.session',
  theme: 'routemaker.theme',
} as const;

/** localStorage that never throws (blocked in some privacy modes). */
function attempt<T>(run: (storage: Storage) => T, fallback: T): T {
  try {
    return run(localStorage);
  } catch {
    return fallback;
  }
}

export const readStorage = (key: string) => attempt((storage) => storage.getItem(key), null);
export const writeStorage = (key: string, value: string) =>
  attempt((storage) => storage.setItem(key, value), undefined);
export const deleteStorage = (key: string) =>
  attempt((storage) => storage.removeItem(key), undefined);
