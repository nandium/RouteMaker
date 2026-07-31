import { defineConfig } from '@lynx-js/rspeedy';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import type { AppConfig } from 'sparkling-app-cli';

import { BRAND_PALETTE } from './src/brand.js';

const lynxConfig = defineConfig({
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

const config: AppConfig = {
  lynxConfig,
  appName: 'RouteMaker',
  platform: {
    android: {
      packageName: 'rocks.routemaker.app',
    },
    ios: {
      bundleIdentifier: 'rocks.routemaker.app',
    },
  },
  paths: {
    androidAssets: 'android/app/src/main/assets',
    iosAssets: 'ios/SparklingGo/SparklingGo/Resources/Assets',
  },
  appIcon: './resource/app_icon.png',
  plugin: [
    [
      'splash-screen',
      {
        backgroundColor: BRAND_PALETTE.light.background,
        image: './resource/app_icon.png',
        dark: {
          image: './resource/app_icon_dark.png',
          backgroundColor: BRAND_PALETTE.dark.background,
        },
        imageWidth: 200,
      },
    ],
  ],
};

export default config;
