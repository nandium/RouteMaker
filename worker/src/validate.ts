import {
  CLIMBING_GRADES,
  EMAIL_PATTERN,
  MAP_COORDINATE_LIMITS,
  USERNAME_PATTERN,
  type MapLocation,
} from '../../app/src/client-contract';
import { fail } from './http';
import {
  EMAIL_LENGTH,
  OOB_CODE_LENGTH,
  PASSWORD_LENGTH,
  USERNAME_LENGTH,
  type Range,
} from './limits';

// Checks on what a client sends throw a 422 whose message the client can show.

const within = (length: number, [min, max]: Range) => length >= min && length <= max;

// Control characters, and the marks and overrides that reorder text on screen, which
// let one name or note pass for another.
const HIDDEN_CHARACTERS = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

/**
 * Trimmed text whose length in characters, as SQL length() counts, is in range
 * and which holds no control or direction-changing characters.
 */
export function requiredText(value: unknown, range: Range, detail: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!within([...text].length, range) || HIDDEN_CHARACTERS.test(text)) throw fail(422, detail);
  return text;
}

/** Null for missing or blank text; a non-string or out-of-range value is rejected. */
export function optionalText(value: unknown, range: Range, detail: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  return requiredText(value, range, detail);
}

// Names that would pass for the site or its staff.
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'routemaker',
  'support',
  'help',
  'moderator',
  'mod',
  'staff',
  'official',
  'root',
  'system',
  'security',
]);

export function username(value: unknown, detail: string): string {
  const name = requiredText(value, USERNAME_LENGTH, detail);
  if (!USERNAME_PATTERN.test(name)) throw fail(422, detail);
  if (RESERVED_USERNAMES.has(name.toLowerCase())) throw fail(422, 'That username is reserved');
  return name;
}

/** A lowercased email address. */
export function emailAddress(value: unknown, detail: string): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!within(email.length, EMAIL_LENGTH) || !EMAIL_PATTERN.test(email)) throw fail(422, detail);
  return email;
}

/** Only the length is checked; Firebase owns the rest of the password policy. */
export function password(value: unknown, detail: string): string {
  if (typeof value !== 'string' || !within(value.length, PASSWORD_LENGTH)) throw fail(422, detail);
  return value;
}

export function oobCode(value: unknown, detail: string): string {
  if (typeof value !== 'string' || !within(value.length, OOB_CODE_LENGTH)) throw fail(422, detail);
  return value;
}

export function grade(value: unknown): string {
  const climbingGrade = typeof value === 'string' ? value.toUpperCase() : '';
  if (!CLIMBING_GRADES.includes(climbingGrade))
    throw fail(422, `Grade must be between ${CLIMBING_GRADES[0]} and ${CLIMBING_GRADES.at(-1)}`);
  return climbingGrade;
}

export function flag(value: unknown, detail: string): boolean {
  if (typeof value !== 'boolean') throw fail(422, detail);
  return value;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], detail: string): T {
  if (!allowed.includes(value as T)) throw fail(422, detail);
  return value as T;
}

const inRange = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * Parsing, not validating: null for anything that is not a coordinate pair, so
 * callers handling data from other services can skip it instead of failing.
 */
export function latLon(latitude: unknown, longitude: unknown): MapLocation | null {
  return inRange(latitude, MAP_COORDINATE_LIMITS.latitude) &&
    inRange(longitude, MAP_COORDINATE_LIMITS.longitude)
    ? { latitude, longitude }
    : null;
}

export function coordinates(latitude: unknown, longitude: unknown, detail: string): MapLocation {
  const location = latLon(latitude, longitude);
  if (!location) throw fail(422, detail);
  return location;
}
