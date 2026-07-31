// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BaseEvent, StandardProps } from '@lynx-js/types';
import type { ColorScheme, ThemePreference } from './appearance.js';
import type { AppRoute } from './web-routes.js';

declare module '@lynx-js/types' {
  interface GlobalProps {
    apiBaseUrl?: string;
    initialRoute?: AppRoute;
    webHost?: boolean;
    themePreference?: ThemePreference;
    systemTheme?: ColorScheme;
  }

  interface IntrinsicElements extends Lynx.IntrinsicElements {
    input: InputProps;
  }
}

export interface InputProps extends StandardProps {
  /**
   * CSS class name for the input element
   */
  className?: string;

  value?: string;

  type?: 'number' | 'text' | 'digit' | 'password' | 'tel' | 'email';

  /**
   * Event handler for input changes
   */
  bindinput?: (e: InputEvent) => void;

  'confirm-type'?: 'send' | 'search' | 'go' | 'done' | 'next';

  bindconfirm?: () => void;

  /**
   * Event handler for blur events
   */
  bindblur?: (e: BlurEvent) => void;

  /**
   * Placeholder text when input is empty
   */
  placeholder?: string;

  /**
   * Text color of the input
   */
  'text-color'?: string;
}

export type InputEvent = BaseEvent<'input', { value: string }>;
