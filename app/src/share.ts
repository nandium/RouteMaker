import { apiBaseUrl } from './api.js';
import { getNativeModule } from './native-module.js';
import { WEB_PATHS } from './web-routes.js';

type NativeShareBridge = {
  share(url: string, title: string, callback: (result: ShareResult) => void): void;
};

type ShareResult = 'shared' | 'opened' | 'copied' | 'cancelled' | 'unavailable';

/** Share the stable public route URL without adding a router or global state. */
export async function shareRoute(routeId: string, title: string): Promise<ShareResult> {
  if (!apiBaseUrl) throw new Error('The app server is not configured.');
  const url = `${apiBaseUrl}${WEB_PATHS.route(routeId)}`;
  const bridge = getNativeModule<NativeShareBridge>('RouteMakerShare');
  if (!bridge) throw new Error('Sharing is not available on this device.');
  return new Promise((resolve) => bridge.share(url, title, resolve));
}
