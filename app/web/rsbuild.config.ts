import { defineConfig } from '@rsbuild/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  html: { template: path.join(directory, 'index.html'), title: 'RouteMaker' },
  source: { entry: { index: path.join(directory, 'main.ts') } },
  output: {
    cleanDistPath: true,
    distPath: {
      root: path.join(directory, 'dist'),
    },
    copy: [
      { from: path.join(directory, '../dist/main.web.bundle'), to: 'main.web.bundle' },
      { from: path.join(directory, 'model'), to: 'model' },
      { from: path.join(directory, '../resource/app_icon.svg'), to: 'app-icon.svg' },
    ],
  },
});
