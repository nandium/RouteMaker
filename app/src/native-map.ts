import type { Gym, MapLocation } from './client-contract.js';
import type { ColorScheme } from './host-contract.js';
import { DEFAULT_MAP_VIEW, MAP_STYLES, USER_LOCATION_ZOOM } from './map-config.js';

export const LOCATION_WAIT_MS = 1_500;

/** A coarse location, or null if it fails or takes longer than the map is worth waiting for. */
export function approximateLocation(load: () => Promise<MapLocation | null>) {
  return new Promise<MapLocation | null>((resolve) => {
    const timer = setTimeout(resolve, LOCATION_WAIT_MS, null);
    load()
      .catch(() => null)
      .then((location) => {
        clearTimeout(timer);
        resolve(location);
      });
  });
}

/** What the native map needs to draw: the gyms, the theme, and where to look first. */
export function nativeMapScene(gyms: Gym[], theme: ColorScheme, location: MapLocation | null) {
  const center = location ?? gyms[0] ?? DEFAULT_MAP_VIEW;
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
