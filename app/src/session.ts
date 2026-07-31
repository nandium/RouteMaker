import { getNativeModule } from './native-module.js';

type NativeSessionStore = {
  getToken(callback: (token: string) => void): void;
  setToken(token: string): void;
  clearToken(): void;
};

export const sessionStore = {
  load(): Promise<string | null> {
    const store = getNativeModule<NativeSessionStore>('RouteMakerSession');
    if (!store) return Promise.resolve(null);
    return new Promise((resolve) => store.getToken((token) => resolve(token || null)));
  },
  save(token: string) {
    getNativeModule<NativeSessionStore>('RouteMakerSession')?.setToken(token);
  },
  clear() {
    getNativeModule<NativeSessionStore>('RouteMakerSession')?.clearToken();
  },
};
