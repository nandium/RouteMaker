import { readFileSync } from 'node:fs';

const appRoot = new URL('../', import.meta.url);
const contractSource = readFileSync(new URL('src/client-contract.ts', appRoot), 'utf8');
const eventMatch = contractSource.match(/SYSTEM_THEME_EVENT = '([^']+)'/);
if (!eventMatch) {
  throw new Error('SYSTEM_THEME_EVENT is missing from src/client-contract.ts.');
}

const nativeHosts = [
  'android/app/src/main/java/rocks/routemaker/app/RouteMakerAppearanceModule.kt',
  'ios/RouteMaker/RouteMaker/RouteMakerLynxView.swift',
];
for (const path of nativeHosts) {
  if (!readFileSync(new URL(path, appRoot), 'utf8').includes(`"${eventMatch[1]}"`)) {
    throw new Error(`${path} does not match the TypeScript client contract.`);
  }
}
