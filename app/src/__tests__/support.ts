const original = globalThis.NativeModules;

/** Adds fake host modules for the current test; `resetHost` removes them. */
export function installHost(modules: Record<string, unknown>) {
  globalThis.NativeModules = { ...globalThis.NativeModules, ...modules } as typeof NativeModules;
}

/** Restores the host modules and sets the global props the host would provide at startup. */
export function resetHost(globalProps: object = {}) {
  globalThis.NativeModules = original;
  lynx.__globalProps = {
    apiBaseUrl: 'http://localhost:8788',
    themePreference: 'system',
    ...globalProps,
  };
}
