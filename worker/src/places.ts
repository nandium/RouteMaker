import { PLACE_SEARCH, type Place } from '../../app/src/client-contract';
import type { Env } from './env';
import { fail, json } from './http';
import { GYM_ADDRESS_LENGTH, GYM_NAME_LENGTH, PLACE_SEARCH_PER_CLIENT } from './limits';
import { throttleClient } from './throttle';
import { latLon, requiredText } from './validate';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';
const PLACE_SEARCH_TIMEOUT_MS = 8_000;
const COARSE_LOCATION_DECIMALS = 2;

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** At most `max` characters, so a place always fits a gym's name and address. */
const clip = (text: string, max: number) => [...text].slice(0, max).join('');

/** Blank or missing is NaN, not 0, so latLon rejects it. */
const toNumber = (value: unknown) =>
  typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function normalizePlace(value: unknown): Place | null {
  if (!value || typeof value !== 'object') return null;
  const feature = value as PhotonFeature;
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  const location = latLon(coordinates[1], coordinates[0]);
  if (!location) return null;

  const properties = feature.properties ?? {};
  const street = unique([clean(properties.housenumber), clean(properties.street)]).join(' ');
  const name =
    clean(properties.name) || street || clean(properties.city) || clean(properties.country);
  if (!name) return null;
  const address = unique([
    street,
    clean(properties.locality),
    clean(properties.district),
    clean(properties.city),
    clean(properties.state),
    clean(properties.country),
  ])
    .filter((part) => part !== name)
    .join(', ');
  return {
    name: clip(name, GYM_NAME_LENGTH[1]),
    address: clip(address, GYM_ADDRESS_LENGTH[1]),
    ...location,
  };
}

/** Photon search, reshaped to Place[]. */
export async function searchPlaces(req: Request, env: Env) {
  await throttleClient(req, env, 'places', PLACE_SEARCH_PER_CLIENT);
  const params = new URL(req.url).searchParams;
  const query = requiredText(
    params.get('q'),
    [PLACE_SEARCH.minQueryLength, PLACE_SEARCH.maxQueryLength],
    `Search must be ${PLACE_SEARCH.minQueryLength}-${PLACE_SEARCH.maxQueryLength} characters`
  );
  const center = latLon(toNumber(params.get('lat')), toNumber(params.get('lon')));
  if (!center) throw fail(422, 'Invalid map center');
  const providerUrl = new URL(PHOTON_API_URL);
  providerUrl.searchParams.set('q', query);
  providerUrl.searchParams.set('limit', String(PLACE_SEARCH.resultLimit));
  providerUrl.searchParams.set('lat', center.latitude.toFixed(PLACE_SEARCH.biasDecimals));
  providerUrl.searchParams.set('lon', center.longitude.toFixed(PLACE_SEARCH.biasDecimals));

  const response = await fetch(providerUrl, {
    cache: 'no-store',
    headers: { accept: 'application/geo+json, application/json' },
    signal: AbortSignal.timeout(PLACE_SEARCH_TIMEOUT_MS),
  }).catch(() => null);
  const payload = response?.ok
    ? await response.json<{ features?: unknown }>().catch(() => null)
    : null;
  if (!Array.isArray(payload?.features)) throw fail(502, 'Place search is temporarily unavailable');

  const places = new Map<string, Place>();
  for (const feature of payload.features) {
    const place = normalizePlace(feature);
    if (!place) continue;
    const label = `${place.name}\n${place.address}`;
    if (!places.has(label)) places.set(label, place);
  }
  return json([...places.values()].slice(0, PLACE_SEARCH.resultLimit));
}

/** Return Cloudflare's coarse connection location without retaining it. */
export function getLocation(req: Request) {
  const location = latLon(toNumber(req.cf?.latitude), toNumber(req.cf?.longitude));
  const rounded = (coordinate: number) => Number(coordinate.toFixed(COARSE_LOCATION_DECIMALS));
  if (!location) return json(null);
  return json({ latitude: rounded(location.latitude), longitude: rounded(location.longitude) });
}
