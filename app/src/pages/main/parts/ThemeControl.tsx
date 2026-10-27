import type { ThemePreference } from '../../../host-contract.js';
import { useApp } from '../app-context.js';
import { Segmented } from '../components/Segmented.js';

const THEMES = [
  { id: 'system', label: 'Auto', icon: 'auto' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
] as const;

/** Auto follows the device; Light and Dark are the visitor's own choice, which the host keeps. */
export function ThemeControl() {
  const { themePreference, setThemePreference } = useApp();
  return (
    <Segmented<ThemePreference>
      label="Theme"
      options={THEMES}
      value={themePreference}
      onChange={setThemePreference}
    />
  );
}
