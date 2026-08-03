import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
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
  plugins: [
    pluginQRCode({
      schema(url: string): string {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginReactLynx({ enableAccessibilityElement: true }),
  ],
});
