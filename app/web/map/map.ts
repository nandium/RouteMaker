import { API_PATHS, PLACE_SEARCH } from '../../src/client-contract.js';
import type { GymListing, MapLocation } from '../../src/client-contract.js';
import { DEFAULT_MAP_VIEW, MAP_STYLES, USER_LOCATION_ZOOM } from '../../src/map-config.js';
import { plural } from '../../src/plural.js';
import { WEB_PATHS } from '../../src/web-pages.js';
import type { MapLibreMap, Marker } from 'maplibre-gl';
import { createStatus, decoration, element, linkButton, setStatus, textElement } from '../dom.js';
import { browserRequest } from '../http.js';
import { currentScheme, onThemeChange } from '../theme.js';
import './map.css';
import { createGymRequest, type GymRequest } from './gym-request.js';
import { createPlaceSearch } from './place-search.js';

const PLACE_RESULT_ZOOM = 15;
const APPROXIMATE_LOCATION_TIMEOUT_MS = 2 * 1000;
const LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 5 * 60 * 1000,
  timeout: 8 * 1000,
} satisfies PositionOptions;
const MAP_HINT = 'Select a marker to view a gym, or click the map to place a request.';

/** A faceted pin; the shades come from the stylesheet so the pin follows the theme. */
const PIN_SVG = `<svg width="34" height="46" viewBox="0 0 34 46" aria-hidden="true" focusable="false">
  <ellipse class="pin__shadow" cx="17" cy="42" rx="8" ry="3"/>
  <polygon class="pin__lit" points="17,42 5,21 5,10 17,3"/>
  <polygon class="pin__dark" points="17,3 29,10 29,21 17,42"/>
  <polygon class="pin__edge" points="17,42 5,21 5,10 17,3 29,10 29,21"/>
  <circle class="pin__dot" cx="17" cy="16.5" r="4.6"/>
</svg>`;

function gymMarkerElement(name: string) {
  const marker = element('button', 'map-marker');
  marker.type = 'button';
  marker.setAttribute('aria-label', `Open ${name}`);
  marker.innerHTML = PIN_SVG;
  return marker;
}

function selectionMarkerElement() {
  const marker = element('span', 'map-marker map-marker--selection');
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = PIN_SVG;
  return marker;
}

/** What a gym's popup says, and the way on to its routes. */
function gymPopupContent(gym: GymListing) {
  const content = element('div', 'popup');
  content.append(
    textElement('p', gym.name, 'popup__title display display--sm'),
    textElement('p', gym.address, 'popup__address'),
    textElement('p', plural(gym.route_count, 'route'), 'popup__address'),
    linkButton('View routes', WEB_PATHS.gym(gym.id), 'primary', 'sm')
  );
  return content;
}

// MapLibre opens compact attribution on load; collapse it so small maps stay usable.
function collapseCompactAttribution(mapNode: HTMLElement) {
  const control = mapNode.querySelector<HTMLDetailsElement>(
    '.maplibregl-ctrl-attrib.maplibregl-compact'
  );
  control?.removeAttribute('open');
  control?.classList.remove('maplibregl-compact-show');
}

type CenteringMap = Pick<MapLibreMap, 'flyTo' | 'getZoom' | 'setCenter'>;

/** Priority: user gesture > device location > coarse connection location. */
export function createInitialMapCenter(map: CenteringMap) {
  let userInteracted = false;
  let deviceLocationApplied = false;
  return {
    interact() {
      userInteracted = true;
    },
    fallback(center: MapLocation | null) {
      if (center && !deviceLocationApplied && !userInteracted) {
        map.setCenter([center.longitude, center.latitude]);
      }
    },
    device(coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude'>) {
      if (userInteracted) return;
      deviceLocationApplied = true;
      const latitude = Number(coords.latitude.toFixed(PLACE_SEARCH.biasDecimals));
      const longitude = Number(coords.longitude.toFixed(PLACE_SEARCH.biasDecimals));
      map.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), USER_LOCATION_ZOOM),
      });
    },
  };
}

type MapParts = {
  mapNode: HTMLElement;
  mapShell: HTMLElement;
  status: HTMLElement;
  gyms: GymListing[];
  request: GymRequest;
};

type MapLibre = typeof import('maplibre-gl');

/** One pin per gym, whose popup names the gym and counts its routes. */
function addGymMarkers(maplibre: MapLibre, map: MapLibreMap, gyms: GymListing[]) {
  const markers = new Map<string, Marker>();
  for (const gym of gyms) {
    const pin = gymMarkerElement(gym.name);
    const popup = new maplibre.Popup().setDOMContent(gymPopupContent(gym));
    markers.set(
      gym.id,
      new maplibre.Marker({ element: pin, anchor: 'bottom' })
        .setLngLat([gym.longitude, gym.latitude])
        .setPopup(popup)
        .addTo(map)
    );
    // The popup opens above the pin, so it needs the pin's rendered height.
    popup.setOffset(pin.offsetHeight);
  }
  return markers;
}

/** Centre the map on the climber when we can, and keep the status line telling the truth. */
function watchInitialView(
  map: MapLibreMap,
  { mapNode, mapShell, status }: Pick<MapParts, 'mapNode' | 'mapShell' | 'status'>,
  fallbackLocation: Promise<MapLocation | null>
) {
  // Touching or tabbing into the map (search box included) means the user is steering it.
  const initialCenter = createInitialMapCenter(map);
  mapShell.addEventListener('pointerdown', initialCenter.interact, true);
  mapShell.addEventListener('focusin', initialCenter.interact, true);
  map.on('movestart', (event) => {
    if (event.originalEvent) initialCenter.interact(); // wheel and keyboard zoom
  });
  void fallbackLocation.then(initialCenter.fallback);

  let dataFailed = false;
  map.on('load', () => {
    collapseCompactAttribution(mapNode);
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => initialCenter.device(coords),
      () => {
        if (!dataFailed) setStatus(status, `${MAP_HINT} Showing a nearby view; location is off.`);
      },
      LOCATION_OPTIONS
    );
    if (!dataFailed) setStatus(status, MAP_HINT);
  });
  map.on('error', () => {
    dataFailed = true;
    setStatus(
      status,
      'Some map data could not load. The approved gym list is still available below.',
      'error'
    );
  });
}

async function startMap({ mapNode, mapShell, status, gyms, request }: MapParts) {
  const fallbackLocation = browserRequest<MapLocation | null>(API_PATHS.location, {
    signal: AbortSignal.timeout(APPROXIMATE_LOCATION_TIMEOUT_MS),
  }).catch(() => null);
  const [maplibre] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]);
  // A hashed asset URL, so it caches immutably under /static/.
  maplibre.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
  const fallbackCenter = gyms[0] ?? DEFAULT_MAP_VIEW;
  const map = new maplibre.Map({
    container: mapNode,
    style: MAP_STYLES[currentScheme()],
    center: [fallbackCenter.longitude, fallbackCenter.latitude],
    zoom: DEFAULT_MAP_VIEW.zoom,
  });
  map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
  onThemeChange((scheme) => map.setStyle(MAP_STYLES[scheme]));
  watchInitialView(map, { mapNode, mapShell, status }, fallbackLocation);
  const markers = addGymMarkers(maplibre, map, gyms);

  const selection = new maplibre.Marker({ element: selectionMarkerElement(), anchor: 'bottom' });
  const selectLocation = (latitude: number, longitude: number) => {
    selection.setLngLat([longitude, latitude]).addTo(map);
    request.setLocation(latitude, longitude);
  };
  mapShell.prepend(
    createPlaceSearch({
      gyms,
      center: () => {
        const { lat, lng } = map.getCenter();
        return { latitude: lat, longitude: lng };
      },
      pick: ({ gym, latitude, longitude }) => {
        map.flyTo({
          center: [longitude, latitude],
          zoom: Math.max(map.getZoom(), PLACE_RESULT_ZOOM),
        });
        const marker = gym && markers.get(gym.id);
        if (marker) {
          if (!marker.getPopup()?.isOpen()) marker.togglePopup();
        } else {
          selectLocation(latitude, longitude);
        }
      },
    })
  );
  map.on('click', (event) => {
    const target = event.originalEvent.target;
    if (
      target instanceof Element &&
      target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')
    ) {
      return;
    }
    selectLocation(event.lngLat.lat, event.lngLat.lng);
  });
}

function createGymDirectory(gyms: GymListing[]) {
  const directory = element('section', 'gym-directory');
  const header = element('div', 'gym-directory__header');
  header.append(
    textElement('h2', 'Approved gyms', 'display display--lg'),
    textElement('p', plural(gyms.length, 'gym'), 'gym-directory__count')
  );
  const list = element('ul', 'gym-directory__list');
  for (const gym of gyms) {
    const row = element('li', 'gym-row');
    const tile = decoration('gym-row__tile display display--md');
    tile.textContent = gym.country_code;
    const text = element('div', 'gym-row__text');
    text.append(
      textElement('strong', gym.name, 'display display--sm'),
      textElement('span', gym.address, 'gym-row__detail'),
      textElement('span', plural(gym.route_count, 'route'), 'gym-row__detail')
    );
    const routes = textElement('a', 'Routes', 'link');
    routes.href = WEB_PATHS.gym(gym.id);
    routes.setAttribute('aria-label', `View routes at ${gym.name}`);
    row.append(tile, text, routes);
    list.append(row);
  }
  directory.append(header, list);
  return directory;
}

export async function mountMap(main: HTMLElement, gyms: GymListing[]) {
  const mapNode = element('div', 'map');
  mapNode.setAttribute('role', 'region');
  mapNode.setAttribute('aria-label', 'Map of climbing gyms');
  const mapShell = element('div', 'map-shell');
  mapShell.append(mapNode);
  const status = createStatus('Loading map…');
  const header = element('div', 'map-card__header');
  header.append(
    textElement('h2', 'Map', 'display display--sm'),
    textElement('p', plural(gyms.length, 'location'), 'map-card__count')
  );
  const card = element('section', 'map-card');
  card.append(header, mapShell);
  const request = createGymRequest();

  const layout = element('div', 'two-column');
  const primary = element('div', 'two-column__main');
  primary.append(card, status);
  const secondary = element('div', 'two-column__side');
  secondary.append(request.element, createGymDirectory(gyms));
  layout.append(primary, secondary);
  main.append(layout);

  try {
    await startMap({ mapNode, mapShell, status, gyms, request });
  } catch {
    // A failed map must not hide the gym list or the coordinate form, and leaves no empty card.
    card.hidden = true;
    setStatus(
      status,
      'The map could not start on this device. The approved gym list is still available below.',
      'error'
    );
    request.expectManualEntry();
  }
}
