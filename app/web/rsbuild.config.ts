import { defineConfig } from '@rsbuild/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  html: { template: path.join(directory, 'index.html') },
  source: { entry: { index: path.join(directory, 'main.ts') } },
  output: {
    cleanDistPath: true,
    distPath: {
      root: path.join(directory, 'dist'),
    },
    copy: [
      { from: path.join(directory, '../dist/main.web.bundle'), to: 'main.web.bundle' },
      { from: path.join(directory, '../resource/app_icon.svg'), to: 'app-icon.svg' },
      { from: path.join(directory, 'theme-init.js'), to: 'theme-init.js' },
      // The display font's licence, served next to the hashed font file it covers.
      { from: path.join(directory, '../resource/fonts/OFL.txt'), to: 'static/font/OFL.txt' },
      // No extension, so the target must be declared a file rather than a directory.
      { from: path.join(directory, '_headers'), to: '_headers', toType: 'file' },
    ],
  },
});
