import { API_PATHS, STORAGE_KEYS } from '../src/client-contract.js';
import type { Gym } from '../src/client-contract.js';
import { THEME_CHANGE_EVENT } from '../src/appearance.js';
import { DEFAULT_MAP_VIEW, MAP_STYLES } from '../src/map-config.js';
import { loginPath, WEB_PATHS } from '../src/web-routes.js';
import { browserRequest } from './http.js';
import { readStorage } from './storage.js';
import { element, field, setStatus } from './shared.js';

const DEFAULT_COUNTRY_CODE = 'SG';
const MARKER_POPUP_OFFSET = 34;
const MAP_WORKER_PATH = '/maplibre-gl-worker.mjs';

function mapMarker(label?: string, modifier = '') {
  const className = modifier ? `map-marker ${modifier}` : 'map-marker';
  const marker = label ? element('button', className) : element('span', className);
  if (label && marker instanceof HTMLButtonElement) {
    marker.type = 'button';
    marker.setAttribute('aria-label', label);
  } else {
    marker.setAttribute('aria-hidden', 'true');
  }
  marker.append(element('span', 'map-marker__pin'));
  return marker;
}

function collapseCompactAttribution(mapNode: HTMLElement) {
  // MapLibre initially expands compact attribution. Collapse it once the map is
  // ready so small screens keep the map usable while attribution remains one tap away.
  const control = mapNode.querySelector<HTMLDetailsElement>(
    '.maplibregl-ctrl-attrib.maplibregl-compact'
  );
  control?.removeAttribute('open');
  control?.classList.remove('maplibregl-compact-show');
}

export async function mountMap(root: HTMLElement, gyms: Gym[]) {
  // Keep the directory useful if the public tile service or WebGL is
  // unavailable; explicit coordinates still support gym requests.
  const mapNode = element('div', 'map');
  const mapStatus = element('p', 'tool-status');
  const mapCard = element('section', 'tool-card tool-map-card');
  const mapHeader = element('div', 'tool-card__header');
  mapHeader.append(
    element('h2', '', 'Gym map'),
    element('p', 'tool-note', `${gyms.length} ${gyms.length === 1 ? 'location' : 'locations'}`)
  );
  const gymList = element('div', 'gym-grid');
  gyms.forEach((gym) => {
    const card = element('article', 'gym');
    card.append(element('strong', '', gym.name), element('span', '', gym.address));
    gymList.append(card);
  });
  const directory = element('section', 'gym-directory');
  const directoryHeader = element('div', 'gym-section__header');
  directoryHeader.append(
    element('h2', '', 'Approved gyms'),
    element('p', 'tool-note', `${gyms.length} ${gyms.length === 1 ? 'gym' : 'gyms'}`)
  );
  directory.append(directoryHeader, gymList);
  mapCard.append(mapHeader, mapNode, mapStatus);
  root.append(mapCard, directory);

  let selected: { latitude: number; longitude: number } | null = null;
  const selectionStatus = element('p');
  setStatus(selectionStatus, 'First, select the gym location on the map.');
  setStatus(mapStatus, 'Loading map…');
  try {
    const [{ Map, Marker, Popup, setWorkerUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    setWorkerUrl(new URL(MAP_WORKER_PATH, location.origin).href);
    const mapStyle = () =>
      MAP_STYLES[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
    const map = new Map({
      container: mapNode,
      style: mapStyle(),
      center: gyms[0]
        ? [gyms[0].longitude, gyms[0].latitude]
        : [DEFAULT_MAP_VIEW.longitude, DEFAULT_MAP_VIEW.latitude],
      zoom: DEFAULT_MAP_VIEW.zoom,
    });
    const syncMapTheme = () => map.setStyle(mapStyle());
    document.addEventListener(THEME_CHANGE_EVENT, syncMapTheme);
    map.on('remove', () => document.removeEventListener(THEME_CHANGE_EVENT, syncMapTheme));
    map.on('load', () => {
      collapseCompactAttribution(mapNode);
      setStatus(mapStatus, 'Select a marker to view a gym, or click the map to place a request.');
    });
    map.on('error', () => {
      setStatus(
        mapStatus,
        'Some map data could not load. The approved gym list is still available below.',
        true
      );
    });
    gyms.forEach((gym) => {
      new Marker({ element: mapMarker(`Open ${gym.name}`), anchor: 'bottom' })
        .setLngLat([gym.longitude, gym.latitude])
        .setPopup(
          new Popup({ offset: MARKER_POPUP_OFFSET }).setText(`${gym.name} — ${gym.address}`)
        )
        .addTo(map);
    });
    const selection = new Marker({
      element: mapMarker(undefined, 'map-marker--selection'),
      anchor: 'bottom',
    });
    map.on('click', (event) => {
      if (
        event.originalEvent.target instanceof Element &&
        event.originalEvent.target.closest(
          '.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl'
        )
      ) {
        return;
      }
      selected = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
      selection.setLngLat(event.lngLat).addTo(map);
      latitude.input.value = event.lngLat.lat.toFixed(6);
      longitude.input.value = event.lngLat.lng.toFixed(6);
      setStatus(selectionStatus, 'Location selected. Add the gym details below.');
    });
  } catch (error) {
    mapNode.hidden = true;
    setStatus(mapStatus, error instanceof Error ? error.message : 'The map could not load.', true);
    setStatus(selectionStatus, 'Enter the gym coordinates below.');
  }

  const sessionToken = readStorage(STORAGE_KEYS.session) ?? '';
  const requestForm = element('div');
  const requestCard = element('section', 'gym-request');
  requestCard.append(element('h2', '', "Can't find your gym?"));
  const name = field('Gym name');
  const address = field('Address');
  const country = field('Country code');
  country.input.value = DEFAULT_COUNTRY_CODE;
  const latitude = field('Latitude', 'number');
  const longitude = field('Longitude', 'number');
  const coordinates = element('div', 'coordinate-fields');
  coordinates.append(latitude.wrapper, longitude.wrapper);
  const syncCoordinates = () => {
    const lat = Number(latitude.input.value);
    const lng = Number(longitude.input.value);
    if (
      !latitude.input.value.trim() ||
      !longitude.input.value.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      selected = null;
      setStatus(selectionStatus, 'Enter a valid latitude and longitude.', true);
      return;
    }
    selected = { latitude: lat, longitude: lng };
    setStatus(selectionStatus, 'Location selected. Add the gym details below.');
  };
  latitude.input.oninput = syncCoordinates;
  longitude.input.oninput = syncCoordinates;
  const submit = element('button', '', 'Send for approval');
  const status = element('p', 'tool-status');
  let requestInFlight = false;
  let requestComplete = false;
  submit.onclick = async () => {
    if (requestInFlight || requestComplete) return;
    if (!selected) return setStatus(status, 'Select a map location or enter coordinates.', true);
    requestInFlight = true;
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      await browserRequest(API_PATHS.gyms, {
        method: 'POST',
        token: sessionToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.input.value,
          address: address.input.value,
          country_code: country.input.value,
          latitude: selected.latitude,
          longitude: selected.longitude,
        }),
      });
      requestComplete = true;
      setStatus(status, 'Request sent to an administrator.');
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        location.assign(loginPath(WEB_PATHS.gymMap));
        return;
      }
      setStatus(status, error instanceof Error ? error.message : 'Request failed', true);
    } finally {
      requestInFlight = false;
      submit.disabled = requestComplete;
      submit.textContent = requestComplete ? 'Request sent' : 'Send for approval';
    }
  };
  requestForm.append(
    selectionStatus,
    name.wrapper,
    address.wrapper,
    country.wrapper,
    coordinates,
    submit,
    status
  );
  if (sessionToken) {
    requestCard.append(
      element('p', 'tool-note', 'Select a location, then send the gym for approval.'),
      requestForm
    );
  } else {
    const signIn = element('a', 'tool-button', 'Sign in to request one');
    signIn.href = loginPath(WEB_PATHS.gymMap);
    requestCard.append(
      element('p', 'tool-note', 'Browsing is public. Sign in only when you want to add a gym.'),
      signIn
    );
  }
  root.append(requestCard);
}
