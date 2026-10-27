import { plural } from '../../plural.js';

const AGES = [
  { seconds: 7 * 86400, name: 'week', short: 'w' },
  { seconds: 86400, name: 'day', short: 'd' },
  { seconds: 3600, name: 'hour', short: 'h' },
  { seconds: 60, name: 'minute', short: 'm' },
];

// Written out, because the Lynx runtime cannot be relied on for Intl.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date, without its year when it is this year's; weeks stop counting after eight. */
function calendarDate(seconds: number, nowSeconds: number) {
  const date = new Date(seconds * 1000);
  const year = date.getUTCFullYear();
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return year === new Date(nowSeconds * 1000).getUTCFullYear() ? day : `${day} ${year}`;
}

function describe(seconds: number, nowSeconds: number, spoken: boolean) {
  const elapsed = Math.max(0, nowSeconds - seconds);
  const age = AGES.find((candidate) => elapsed >= candidate.seconds);
  if (!age) return 'just now';
  const count = Math.floor(elapsed / age.seconds);
  if (age.name === 'week' && count >= 8) return calendarDate(seconds, nowSeconds);
  return spoken ? `${plural(count, age.name)} ago` : `${count}${age.short} ago`;
}

/** How long ago an epoch-seconds time was, in its largest unit: `5m ago`, `2d ago`, `3w ago`. */
export const timeAgo = (seconds: number, nowSeconds = Date.now() / 1000) =>
  describe(seconds, nowSeconds, false);

/** The same, in words for a screen reader: `5 minutes ago`. */
export const timeAgoSpoken = (seconds: number, nowSeconds = Date.now() / 1000) =>
  describe(seconds, nowSeconds, true);
