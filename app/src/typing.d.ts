import type { ColorScheme, ThemePreference } from './host-contract.js';
import type { Page } from './web-pages.js';

declare module '@lynx-js/types' {
  interface GlobalProps {
    apiBaseUrl?: string;
    webHost?: boolean;
    initialPage?: Page;
    /** The visitor's choice; `system` while nothing is saved, so the device's theme applies. */
    themePreference: ThemePreference;
    systemTheme?: ColorScheme;
    wideLayout?: boolean;
    fontScale?: number;
    reducedMotion?: boolean;
  }

  interface Lynx {
    /** Has a screen reader speak `content`; absent on the web host, whose pages use live regions. */
    accessibilityAnnounce?(options: { content: string }): void;
  }

  interface StandardProps {
    // Lynx Web needs these for keyboard activation; native ignores them.
    role?: string;
    tabindex?: string;
  }

  interface InputProps {
    // XElement input supports a controlled `value` at runtime; Lynx's InputProps omits it.
    value?: string;
  }
}
