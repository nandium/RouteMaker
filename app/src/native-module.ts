export function getNativeModule<T>(name: string): T | undefined {
  if (typeof NativeModules === 'undefined') return undefined;
  return (NativeModules as unknown as Record<string, unknown>)[name] as T | undefined;
}
