import { readFileSync } from 'node:fs';

import { brandSourceDigest, digest } from './brand-digest.mjs';

const appRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL('../resource/brand-assets.json', import.meta.url), 'utf8')
);

if (manifest.source !== brandSourceDigest()) {
  throw new Error('Brand source changed. Run npm run brand:assets.');
}
for (const [path, expected] of Object.entries(manifest.files)) {
  if (digest(readFileSync(new URL(path, appRoot))) !== expected) {
    throw new Error(`${path} is stale. Run npm run brand:assets.`);
  }
}
