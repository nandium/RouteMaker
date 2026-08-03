import {
  MAP_COORDINATE_LIMITS,
  PLACE_SEARCH,
} from "../../app/src/client-contract";
import { fail, json, requiredText } from "./shared";

const PHOTON_API_URL = "https://photon.komoot.io/api/";
const PLACE_SEARCH_TIMEOUT_MS = 8_000;
const COARSE_LOCATION_DECIMALS = 2;

type PhotonFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

function coordinate(value: string | null, limit: number, name: string) {
  const parsed = value?.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) {
    throw fail(422, `Invalid ${name}`);
  }
  return parsed;
}

function optionalCoordinate(value: unknown, limit: number) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function unique(values: string[]) {
  return values.filter(
    (value, index) =>
      value && values.findIndex((candidate) => candidate === value) === index,
  );
}

function normalizePlace(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const feature = value as PhotonFeature;
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;
  const [longitude, latitude] = coordinates;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > MAP_COORDINATE_LIMITS.latitude ||
    Math.abs(longitude) > MAP_COORDINATE_LIMITS.longitude
  ) {
    return null;
  }

  const properties = feature.properties ?? {};
  const street = unique([
    text(properties.housenumber),
    text(properties.street),
  ]).join(" ");
  const name =
    text(properties.name) ||
    street ||
    text(properties.city) ||
    text(properties.country);
  if (!name) return null;
  const address = unique([
    street,
    text(properties.locality),
    text(properties.district),
    text(properties.city),
    text(properties.state),
    text(properties.country),
  ])
    .filter((part) => part !== name)
    .join(", ");
  return { name, address, latitude, longitude };
}

/** Keep the public provider behind one small, replaceable response contract. */
export async function placeSearch(req: Request) {
  const requestUrl = new URL(req.url);
  const query = requiredText(
    requestUrl.searchParams.get("q"),
    PLACE_SEARCH.minQueryLength,
    PLACE_SEARCH.maxQueryLength,
    `Search must be ${PLACE_SEARCH.minQueryLength}-${PLACE_SEARCH.maxQueryLength} characters`,
  );
  const latitude = coordinate(
    requestUrl.searchParams.get("lat"),
    MAP_COORDINATE_LIMITS.latitude,
    "latitude",
  );
  const longitude = coordinate(
    requestUrl.searchParams.get("lon"),
    MAP_COORDINATE_LIMITS.longitude,
    "longitude",
  );
  const providerUrl = new URL(PHOTON_API_URL);
  providerUrl.searchParams.set("q", query);
  providerUrl.searchParams.set("limit", String(PLACE_SEARCH.resultLimit));
  providerUrl.searchParams.set(
    "lat",
    latitude.toFixed(PLACE_SEARCH.biasDecimals),
  );
  providerUrl.searchParams.set(
    "lon",
    longitude.toFixed(PLACE_SEARCH.biasDecimals),
  );

  let response: Response;
  try {
    response = await fetch(providerUrl, {
      cache: "no-store",
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.any([
        req.signal,
        AbortSignal.timeout(PLACE_SEARCH_TIMEOUT_MS),
      ]),
    });
  } catch {
    throw fail(502, "Place search is temporarily unavailable");
  }
  if (!response.ok) throw fail(502, "Place search is temporarily unavailable");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw fail(502, "Place search returned an invalid response");
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { features?: unknown }).features)
  ) {
    throw fail(502, "Place search returned an invalid response");
  }
  const places: NonNullable<ReturnType<typeof normalizePlace>>[] = [];
  const labels = new Set<string>();
  for (const feature of (payload as { features: PhotonFeature[] }).features) {
    const place = normalizePlace(feature);
    if (!place) continue;
    const label = `${place.name}\n${place.address}`;
    if (labels.has(label)) continue;
    labels.add(label);
    places.push(place);
    if (places.length === PLACE_SEARCH.resultLimit) break;
  }
  return json(places, 200, { "cache-control": "no-store" });
}

/** Return Cloudflare's coarse connection location without retaining it. */
export function approximateLocation(req: Request) {
  const latitude = optionalCoordinate(
    req.cf?.latitude,
    MAP_COORDINATE_LIMITS.latitude,
  );
  const longitude = optionalCoordinate(
    req.cf?.longitude,
    MAP_COORDINATE_LIMITS.longitude,
  );
  const rounded = (coordinate: number) =>
    Number(coordinate.toFixed(COARSE_LOCATION_DECIMALS));
  return json(
    latitude === null || longitude === null
      ? null
      : { latitude: rounded(latitude), longitude: rounded(longitude) },
    200,
    { "cache-control": "no-store" },
  );
}
