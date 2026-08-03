import {
  API_PATHS,
  MAP_COORDINATE_LIMITS,
  PLACE_SEARCH,
  STORAGE_KEYS,
} from '../src/client-contract.js';
import type { Gym, MapLocation, Place } from '../src/client-contract.js';
import { THEME_CHANGE_EVENT } from '../src/appearance.js';
import { iconSvg } from '../src/icons.js';
import { DEFAULT_MAP_VIEW, MAP_STYLES, USER_LOCATION_ZOOM } from '../src/map-config.js';
import { loginPath, WEB_PATHS } from '../src/web-routes.js';
import type { Map, Marker } from 'maplibre-gl';
import { browserRequest } from './http.js';
import { readStorage } from './storage.js';
import { element, field, setStatus } from './shared.js';

const DEFAULT_COUNTRY_CODE = 'SG';
const PLACE_RESULT_ZOOM = 15;
const PLACE_DEDUPLICATION_DECIMALS = 4;
const MARKER_POPUP_OFFSET = 34;
const MAP_WORKER_PATH = '/maplibre-gl-worker.mjs';
const USER_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const USER_LOCATION_TIMEOUT_MS = 8 * 1000;
const APPROXIMATE_LOCATION_TIMEOUT_MS = 2 * 1000;

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

async function approximateLocation() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APPROXIMATE_LOCATION_TIMEOUT_MS);
  try {
    return await browserRequest<MapLocation | null>(API_PATHS.location, {
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type CenteringMap = Pick<Map, 'flyTo' | 'getZoom' | 'setCenter'>;

/** Preserve user intent while keeping device location ahead of the coarse fallback. */
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

export function mountPlaceSearch(
  mapShell: HTMLElement,
  map: Map,
  gymMarkers: Array<{ gym: Gym; marker: Marker }>,
  selectLocation: (place: Pick<Place, 'latitude' | 'longitude'>) => void,
  markInteraction: () => void
) {
  const form = element('form', 'map-search');
  form.setAttribute('role', 'search');
  const bar = element('div', 'map-search__bar');
  const input = element('input');
  input.type = 'search';
  input.required = true;
  input.minLength = PLACE_SEARCH.minQueryLength;
  input.maxLength = PLACE_SEARCH.maxQueryLength;
  input.placeholder = 'Search gyms or places';
  input.setAttribute('aria-label', input.placeholder);
  const submit = element('button');
  submit.type = 'submit';
  submit.setAttribute('aria-label', 'Search');
  submit.innerHTML = iconSvg('search', 'currentColor');
  bar.append(input, submit);
  const results = element('div', 'map-search__results');
  results.hidden = true;
  results.setAttribute('aria-live', 'polite');
  results.setAttribute('aria-label', 'Search results');
  form.append(bar, results);
  mapShell.prepend(form);
  let searchGeneration = 0;
  let searchController: AbortController | null = null;

  const dismissResults = () => {
    searchController?.abort();
    searchController = null;
    searchGeneration += 1;
    results.hidden = true;
    results.replaceChildren();
  };
  const appendAttribution = () => {
    const attribution = element('p', 'map-search__attribution');
    const photon = element('a', '', 'Photon');
    photon.href = 'https://photon.komoot.io/';
    const openStreetMap = element('a', '', '© OpenStreetMap contributors');
    openStreetMap.href = 'https://www.openstreetmap.org/copyright';
    for (const link of [photon, openStreetMap]) {
      link.target = '_blank';
      link.rel = 'noreferrer';
    }
    attribution.append('Search by ', photon, ' · ', openStreetMap);
    results.append(attribution);
  };
  const showMessage = (message: string, failed = false) => {
    const status = element('p');
    setStatus(status, message, failed);
    results.replaceChildren(status);
    appendAttribution();
    results.hidden = false;
  };
  const showResults = (items: Array<{ name: string; address: string; select: () => void }>) => {
    results.hidden = false;
    const count = element('p', 'map-search__count', `${items.length} results`);
    count.setAttribute('role', 'status');
    results.replaceChildren(count);
    items.forEach((item) => {
      const button = element('button', 'map-search__result');
      button.type = 'button';
      button.append(element('strong', '', item.name));
      if (item.address) button.append(element('span', '', item.address));
      button.onclick = () => {
        markInteraction();
        item.select();
        input.value = item.name;
        dismissResults();
      };
      results.append(button);
    });
    appendAttribution();
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismissResults();
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    input.setCustomValidity(
      query.length < input.minLength || query.length > input.maxLength
        ? `Search must be ${input.minLength}-${input.maxLength} characters`
        : ''
    );
    if (!form.reportValidity() || submit.disabled) return;
    const generation = ++searchGeneration;
    const controller = new AbortController();
    searchController = controller;
    const normalizedQuery = query.toLocaleLowerCase();
    const localGyms = gymMarkers
      .filter(({ gym }) =>
        `${gym.name} ${gym.address}`.toLocaleLowerCase().includes(normalizedQuery)
      )
      .map(({ gym, marker }) => ({
        name: gym.name,
        address: gym.address,
        latitude: gym.latitude,
        longitude: gym.longitude,
        select: () => {
          map.flyTo({
            center: [gym.longitude, gym.latitude],
            zoom: Math.max(map.getZoom(), PLACE_RESULT_ZOOM),
          });
          const popup = marker.getPopup();
          if (popup && !popup.isOpen()) marker.togglePopup();
        },
      }));

    submit.disabled = true;
    results.setAttribute('aria-busy', 'true');
    if (localGyms.length) {
      showResults(localGyms.slice(0, PLACE_SEARCH.resultLimit));
    } else {
      showMessage('Searching…');
    }
    try {
      const center = map.getCenter();
      const places = await browserRequest<Place[]>(
        API_PATHS.places(query, center.lat, center.lng),
        { signal: controller.signal }
      );
      if (generation !== searchGeneration) return;
      const coordinateKey = ({ latitude, longitude }: Pick<Place, 'latitude' | 'longitude'>) =>
        `${latitude.toFixed(PLACE_DEDUPLICATION_DECIMALS)},${longitude.toFixed(PLACE_DEDUPLICATION_DECIMALS)}`;
      const seenCoordinates = new Set(localGyms.map(coordinateKey));
      const photonResults = places.flatMap((place) => {
        const key = coordinateKey(place);
        if (seenCoordinates.has(key)) return [];
        seenCoordinates.add(key);
        return [
          {
            name: place.name,
            address: place.address,
            select: () => {
              map.flyTo({
                center: [place.longitude, place.latitude],
                zoom: Math.max(map.getZoom(), PLACE_RESULT_ZOOM),
              });
              selectLocation(place);
            },
          },
        ];
      });
      const localLimit = photonResults.length
        ? PLACE_SEARCH.resultLimit - 1
        : PLACE_SEARCH.resultLimit;
      const combinedResults = [...localGyms.slice(0, localLimit), ...photonResults].slice(
        0,
        PLACE_SEARCH.resultLimit
      );
      if (!combinedResults.length) {
        showMessage('No places found.');
        return;
      }
      showResults(combinedResults);
    } catch (error) {
      if (generation !== searchGeneration) return;
      if (localGyms.length) {
        showResults(localGyms.slice(0, PLACE_SEARCH.resultLimit));
      } else {
        showMessage(error instanceof Error ? error.message : 'Place search failed.', true);
      }
    } finally {
      if (searchController === controller) searchController = null;
      submit.disabled = false;
      results.setAttribute('aria-busy', 'false');
    }
  };
}

export async function mountMap(root: HTMLElement, gyms: Gym[]) {
  // Keep the directory useful if the public tile service or WebGL is
  // unavailable; explicit coordinates still support gym requests.
  const mapNode = element('div', 'map');
  const mapShell = element('div', 'map-shell');
  mapShell.append(mapNode);
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
  mapCard.append(mapHeader, mapShell, mapStatus);
  root.append(mapCard, directory);

  let selected: { latitude: number; longitude: number } | null = null;
  const selectionStatus = element('p');
  setStatus(selectionStatus, 'First, select the gym location on the map.');
  setStatus(mapStatus, 'Loading map…');
  try {
    const fallbackLocation = approximateLocation();
    const [{ Map, Marker, Popup, setWorkerUrl }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    setWorkerUrl(new URL(MAP_WORKER_PATH, location.origin).href);
    const mapStyle = () =>
      MAP_STYLES[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
    const fallbackCenter = gyms[0] ?? DEFAULT_MAP_VIEW;
    const map = new Map({
      container: mapNode,
      style: mapStyle(),
      center: [fallbackCenter.longitude, fallbackCenter.latitude],
      zoom: DEFAULT_MAP_VIEW.zoom,
    });
    const locationOptions = {
      enableHighAccuracy: false,
      maximumAge: USER_LOCATION_MAX_AGE_MS,
      timeout: USER_LOCATION_TIMEOUT_MS,
    } satisfies PositionOptions;
    const initialCenter = createInitialMapCenter(map);
    mapShell.addEventListener('pointerdown', initialCenter.interact, true);
    mapShell.addEventListener('focusin', initialCenter.interact, true);
    map.on('movestart', (event) => {
      if (event.originalEvent) initialCenter.interact();
    });
    void fallbackLocation.then(initialCenter.fallback);
    const syncMapTheme = () => map.setStyle(mapStyle());
    document.addEventListener(THEME_CHANGE_EVENT, syncMapTheme);
    map.on('remove', () => document.removeEventListener(THEME_CHANGE_EVENT, syncMapTheme));
    map.on('load', () => {
      collapseCompactAttribution(mapNode);
      navigator.geolocation?.getCurrentPosition(
        ({ coords }) => initialCenter.device(coords),
        () => {
          setStatus(
            mapStatus,
            'Showing the best available nearby view. Location remains optional.'
          );
        },
        locationOptions
      );
      setStatus(mapStatus, 'Select a marker to view a gym, or click the map to place a request.');
    });
    map.on('error', () => {
      setStatus(
        mapStatus,
        'Some map data could not load. The approved gym list is still available below.',
        true
      );
    });
    const gymMarkers = gyms.map((gym) => ({
      gym,
      marker: new Marker({ element: mapMarker(`Open ${gym.name}`), anchor: 'bottom' })
        .setLngLat([gym.longitude, gym.latitude])
        .setPopup(
          new Popup({ offset: MARKER_POPUP_OFFSET }).setText(`${gym.name} — ${gym.address}`)
        )
        .addTo(map),
    }));
    const selection = new Marker({
      element: mapMarker(undefined, 'map-marker--selection'),
      anchor: 'bottom',
    });
    const selectLocation = ({
      latitude: lat,
      longitude: lng,
    }: Pick<Place, 'latitude' | 'longitude'>) => {
      initialCenter.interact();
      selected = { latitude: lat, longitude: lng };
      selection.setLngLat([lng, lat]).addTo(map);
      latitude.input.value = lat.toFixed(6);
      longitude.input.value = lng.toFixed(6);
      setStatus(selectionStatus, 'Location selected. Add the gym details below.');
    };
    mountPlaceSearch(mapShell, map, gymMarkers, selectLocation, initialCenter.interact);
    map.on('click', (event) => {
      initialCenter.interact();
      if (
        event.originalEvent.target instanceof Element &&
        event.originalEvent.target.closest(
          '.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl'
        )
      ) {
        return;
      }
      selectLocation({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
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
      Math.abs(lat) > MAP_COORDINATE_LIMITS.latitude ||
      Math.abs(lng) > MAP_COORDINATE_LIMITS.longitude
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
