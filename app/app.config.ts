import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/pages/main/index.tsx',
    },
  },
  environments: {
    lynx: {},
    web: {},
  },
  output: {
    assetPrefix: 'asset:///',
    filename: {
      bundle: '[name].[platform].bundle',
    },
  },
  plugins: [pluginReactLynx()],
});
