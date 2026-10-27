let loading: Promise<void> | undefined;

/**
 * Register the display face on the document. The Lynx view renders inside a shadow root, which
 * resolves `font-family` against document fonts, so one registration serves every page and the
 * canvas that burns the labels into a route photo. The promise never rejects: without the face
 * the system condensed stack in `--ff-display` takes over.
 *
 * The face is licensed under the SIL Open Font License, which asks for the licence text to travel
 * with it: rsbuild.config.ts copies `OFL.txt` into the same folder as the hashed file.
 */
export function loadDisplayFont() {
  loading ??= (async () => {
    try {
      // A hashed asset URL, so it caches immutably under /static/.
      const url = new URL('../resource/fonts/RMDisplay-800.woff2', import.meta.url);
      const face = new FontFace('RM Display', `url(${url.href})`, { weight: '800' });
      document.fonts.add(face);
      await face.load();
    } catch {
      // Blocked or unsupported: the fallback stack is designed to work.
    }
  })();
  return loading;
}
