/** Best-effort browser storage for pages where localStorage may be blocked. */
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function deleteStorage(key: string): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
