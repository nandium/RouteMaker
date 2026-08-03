// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ColorScheme, ThemePreference } from './appearance.js';
import type { AppRoute } from './web-routes.js';

declare module '@lynx-js/types' {
  interface GlobalProps {
    apiBaseUrl?: string;
    initialRoute?: AppRoute;
    webHost?: boolean;
    wideLayout?: boolean;
    themePreference?: ThemePreference;
    systemTheme?: ColorScheme;
  }

  interface InputProps {
    // RouteMaker relies on XElement's runtime-supported controlled value;
    // Lynx 4.0's public InputProps declaration does not expose it.
    value?: string;
  }
}
