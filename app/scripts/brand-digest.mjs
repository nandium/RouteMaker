import { createHash } from 'node:crypto';

import { BRAND_PALETTE, LOGO_MARK_SEGMENTS } from '../src/brand.ts';

export const digest = (value) => createHash('sha256').update(value).digest('hex');

/** Fingerprint of the palette and logo geometry every generated asset derives from. */
export const brandSourceDigest = () =>
  digest(`${JSON.stringify(BRAND_PALETTE)}${JSON.stringify(LOGO_MARK_SEGMENTS)}`);
