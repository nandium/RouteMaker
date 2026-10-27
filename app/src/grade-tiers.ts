import { CLIMBING_GRADES, type Route } from './client-contract.js';

/** The grades are folded into six tiers, each with its own color (`--g1` to `--g6`). */
export const GRADE_TIERS = [
  { id: 1, label: 'V0–1', first: 0, last: 1 },
  { id: 2, label: 'V2–3', first: 2, last: 3 },
  { id: 3, label: 'V4–5', first: 4, last: 5 },
  { id: 4, label: 'V6–7', first: 6, last: 7 },
  { id: 5, label: 'V8–10', first: 8, last: 10 },
  { id: 6, label: 'V11+', first: 11, last: CLIMBING_GRADES.length - 1 },
] as const;

/** The tier a grade belongs to; 0 for a route that has no grade yet. */
export function tierOf(grade: string | null | undefined) {
  const number = grade ? CLIMBING_GRADES.indexOf(grade) : -1;
  return GRADE_TIERS.find((tier) => number >= tier.first && number <= tier.last)?.id ?? 0;
}

/** How many of `routes` fall in each tier that has any, hardest tier last. */
export function gradeSpread(routes: Route[]) {
  return GRADE_TIERS.map((tier) => ({
    tier,
    count: routes.filter((route) => tierOf(route.public_grade) === tier.id).length,
  })).filter(({ count }) => count > 0);
}

/** The tiers by their labels, as in `V4–5 and V6–7`, for a sentence. */
export function tierLabels(ids: number[]) {
  return GRADE_TIERS.filter((tier) => ids.includes(tier.id))
    .map((tier) => tier.label)
    .join(' and ');
}
