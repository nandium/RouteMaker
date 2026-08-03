import type { ColorScheme } from './appearance.js';
import type { Gym, MapLocation } from './client-contract.js';

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/fiord',
} as const;

export const DEFAULT_MAP_VIEW = {
  latitude: 1.3521,
  longitude: 103.8198,
  zoom: 10.5,
} as const;

export const USER_LOCATION_ZOOM = 13;

export function nativeMapScene(
  gyms: Gym[],
  theme: ColorScheme,
  approximateLocation: MapLocation | null
) {
  const center = approximateLocation ?? gyms[0] ?? DEFAULT_MAP_VIEW;
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
    centerLatitude: center.latitude,
    centerLongitude: center.longitude,
    zoom: DEFAULT_MAP_VIEW.zoom,
    locationZoom: USER_LOCATION_ZOOM,
  };
}
