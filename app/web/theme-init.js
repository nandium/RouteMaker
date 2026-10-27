// Runs before first paint so a saved dark theme never flashes light. Nothing saved (or "system")
// follows the OS.
// The key matches STORAGE_KEYS.theme in storage.ts.
let saved = null;
try {
  saved = localStorage.getItem('routemaker.theme');
} catch {
  // Storage blocked: fall back to the OS preference.
}
const dark =
  saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('theme-dark', dark);
document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
