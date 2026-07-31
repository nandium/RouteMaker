import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { BRAND_PALETTE, LOGO_MARK_SEGMENTS } from '../src/brand.ts';

const appRoot = new URL('../', import.meta.url);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(
  readFileSync(new URL('../resource/brand-assets.json', import.meta.url), 'utf8')
);
const currentSource = digest(
  `${JSON.stringify(BRAND_PALETTE)}${JSON.stringify(LOGO_MARK_SEGMENTS)}`
);

if (manifest.source !== currentSource) {
  throw new Error('Brand source changed. Run npm run brand:assets.');
}
for (const [path, expected] of Object.entries(manifest.files)) {
  if (digest(readFileSync(new URL(path, appRoot))) !== expected) {
    throw new Error(`${path} is stale. Run npm run brand:assets.`);
  }
}
