import { API_PATHS, PLACE_SEARCH } from '../../src/client-contract.js';
import type { Gym, Place } from '../../src/client-contract.js';
import { plural } from '../../src/plural.js';
import { createStatus, element, iconNode, submitButton, textElement } from '../dom.js';
import { browserRequest, errorMessage } from '../http.js';

const COORDINATE_DECIMALS = 4;

/** A search hit: a known gym (`gym` set) or a place from the geocoder. */
export type SearchHit = Place & { gym?: Gym };

const coordinateKey = ({ latitude, longitude }: Pick<Place, 'latitude' | 'longitude'>) =>
  `${latitude.toFixed(COORDINATE_DECIMALS)},${longitude.toFixed(COORDINATE_DECIMALS)}`;

export function searchGyms(gyms: readonly Gym[], query: string): SearchHit[] {
  const needle = query.toLocaleLowerCase();
  return gyms
    .filter((gym) => `${gym.name} ${gym.address}`.toLocaleLowerCase().includes(needle))
    .map((gym) => ({
      name: gym.name,
      address: gym.address,
      latitude: gym.latitude,
      longitude: gym.longitude,
      gym,
    }));
}

/** Gyms first, geocoder places after; a place at a gym's coordinates is dropped. */
export function mergeHits(local: SearchHit[], places: readonly Place[]): SearchHit[] {
  const seen = new Set(local.map(coordinateKey));
  const found = places.filter((place) => {
    const key = coordinateKey(place);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Keep one slot for the geocoder so a gym-heavy query still reaches general places.
  const gymSlots = found.length ? PLACE_SEARCH.resultLimit - 1 : PLACE_SEARCH.resultLimit;
  return [...local.slice(0, gymSlots), ...found].slice(0, PLACE_SEARCH.resultLimit);
}

type PlaceSearchOptions = {
  gyms: readonly Gym[];
  /** Map centre, used to bias geocoding. */
  center: () => { latitude: number; longitude: number };
  pick: (hit: SearchHit) => void;
};

/** A search box with a results panel: known gyms first, then geocoded places. */
export function createPlaceSearch({ gyms, center, pick }: PlaceSearchOptions) {
  const form = element('form', 'map-search');
  form.setAttribute('role', 'search');
  const input = element('input', 'map-search__input');
  input.type = 'search';
  input.maxLength = PLACE_SEARCH.maxQueryLength;
  input.placeholder = 'Search gyms or places';
  input.setAttribute('aria-label', input.placeholder);
  const submit = submitButton('Search', 'primary', 'sm');
  const bar = element('div', 'map-search__bar');
  bar.append(iconNode('search'), input, submit);
  const results = element('div', 'map-search__results');
  results.hidden = true;
  // The count has its own status role; announcing the whole panel would re-read every row.
  results.setAttribute('role', 'group');
  results.setAttribute('aria-label', 'Search results');
  form.append(bar, results);

  // Aborting stops the lookup in flight; its late answer must not replace newer results.
  let lookup: AbortController | undefined;
  const dismiss = () => {
    lookup?.abort();
    results.setAttribute('aria-busy', 'false');
    results.hidden = true;
    results.replaceChildren();
  };
  const attribution = () => {
    const photon = textElement('a', 'Photon');
    photon.href = 'https://photon.komoot.io/';
    const osm = textElement('a', '© OpenStreetMap contributors');
    osm.href = 'https://www.openstreetmap.org/copyright';
    for (const link of [photon, osm]) {
      link.className = 'map-search__link';
      link.target = '_blank';
      link.rel = 'noreferrer';
    }
    const note = element('p', 'map-search__attribution');
    note.append('Search by ', photon, ' · ', osm);
    return note;
  };
  const showMessage = (message: string, failed = false) => {
    results.replaceChildren(createStatus(message, failed ? 'error' : 'info'), attribution());
    results.hidden = false;
  };
  const showHits = (hits: SearchHit[]) => {
    const count = textElement('span', plural(hits.length, 'result'), 'map-search__count');
    count.setAttribute('role', 'status');
    const header = element('div', 'map-search__header');
    header.append(textElement('strong', 'Results'), count);
    results.replaceChildren(header);
    for (const hit of hits) {
      const choice = element('button', 'map-search__result');
      choice.type = 'button';
      const badge = element('span', `badge${hit.gym ? ' badge--gym' : ''}`);
      badge.append(iconNode(hit.gym ? 'gyms' : 'map', 'badge__icon'), hit.gym ? 'Gym' : 'Place');
      const text = element('span', 'map-search__text');
      text.append(textElement('strong', hit.name, 'map-search__name'));
      if (hit.address) text.append(textElement('span', hit.address, 'map-search__address'));
      choice.append(badge, text);
      choice.onclick = () => {
        pick(hit);
        input.value = hit.name;
        dismiss();
      };
      results.append(choice);
    }
    results.append(attribution());
    results.hidden = false;
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismiss();
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    input.toggleAttribute('aria-invalid', query.length < PLACE_SEARCH.minQueryLength);
    if (query.length < PLACE_SEARCH.minQueryLength) {
      showMessage(`Search needs at least ${PLACE_SEARCH.minQueryLength} characters.`, true);
      return;
    }
    lookup?.abort();
    const { signal } = (lookup = new AbortController());
    const local = searchGyms(gyms, query);
    results.setAttribute('aria-busy', 'true');
    if (local.length) showHits(local.slice(0, PLACE_SEARCH.resultLimit));
    else showMessage('Searching…');
    try {
      const { latitude, longitude } = center();
      const places = await browserRequest<Place[]>(API_PATHS.places(query, latitude, longitude), {
        signal,
      });
      if (signal.aborted) return;
      const hits = mergeHits(local, places);
      if (hits.length) showHits(hits);
      else showMessage('No places found.');
    } catch (error) {
      if (signal.aborted) return;
      if (local.length) showHits(local.slice(0, PLACE_SEARCH.resultLimit));
      else showMessage(errorMessage(error), true);
    }
    results.setAttribute('aria-busy', 'false');
  };
  return form;
}
