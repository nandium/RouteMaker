import type { ColorScheme } from './appearance.js';
import type { Gym } from './client-contract.js';

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
} as const;

export const DEFAULT_MAP_VIEW = {
  latitude: 1.3521,
  longitude: 103.8198,
  zoom: 10.5,
} as const;

export function nativeMapScene(gyms: Gym[], theme: ColorScheme) {
  return {
    gyms: gyms.map(({ id, name, address, latitude, longitude }) => ({
      id,
      name,
      address,
      latitude,
      longitude,
    })),
    theme,
    style: MAP_STYLES[theme],
    centerLatitude: DEFAULT_MAP_VIEW.latitude,
    centerLongitude: DEFAULT_MAP_VIEW.longitude,
    zoom: DEFAULT_MAP_VIEW.zoom,
  };
}
