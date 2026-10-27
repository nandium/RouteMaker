import type { GymListing, MapLocation, Route } from '../../client-contract.js';
import { tierOf } from '../../grade-tiers.js';

export type SortKey = 'newest' | 'likes' | 'sends';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'likes', label: 'Most liked' },
  { key: 'sends', label: 'Most sent' },
];

const sorters: Record<SortKey, (route: Route) => number> = {
  newest: (route) => route.created_at,
  likes: (route) => route.likes,
  sends: (route) => route.sends,
};

/** The routes in any of the `tiers` (all of them, when none is chosen), ordered by `sort`; ties go to the newer route. */
export function arrangeRoutes(routes: Route[], tiers: number[], sort: SortKey) {
  const measure = sorters[sort];
  return routes
    .filter((route) => !tiers.length || tiers.includes(tierOf(route.public_grade)))
    .sort((a, b) => measure(b) - measure(a) || b.created_at - a.created_at);
}

/** Great-circle distance in kilometres. */
function distance(a: MapLocation, b: MapLocation) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const half = (delta: number) => Math.sin(radians(delta) / 2) ** 2;
  const h =
    half(b.latitude - a.latitude) +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * half(b.longitude - a.longitude);
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** How far a gym is, said coarsely because a visitor's location is only known to about a kilometre. */
export function approximateDistance(from: MapLocation, gym: GymListing) {
  const km = distance(from, gym);
  return km >= 100 ? `~${Math.round(km / 10) * 10} km` : `~${Math.max(1, Math.round(km))} km`;
}

/** Gyms nearest to `from` first; without a location they keep their order (by name). */
export function nearestFirst(gyms: GymListing[], from: MapLocation | null) {
  if (!from) return gyms;
  return [...gyms].sort((a, b) => distance(from, a) - distance(from, b));
}
