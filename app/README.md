# RouteMaker app

One ReactLynx UI runs on Android, iOS, and the web. The native shells host Lynx directly; there is no app framework or generated native project.

```text
src/             ReactLynx UI, API client, shared contracts
  pages/main/
    components/  domain-free primitives (Button, Row, Sheet, ...), each with its CSS beside it
    parts/       pieces that know routes and gyms (RouteRow, GradePicker, ...)
    screens/     one file per page; screens/admin/ holds the moderation items
    hooks/       router, session, data loading
web/             browser host and the browser-only tools
  editor/ map/   route editor and gym map, each with its own stylesheet
android/ ios/    native hosts
resource/        app icons, fonts, brand-asset manifest
scripts/         brand-asset and host-contract checks
theme.css        design tokens
```

## How the pieces fit

- **Build**: Rspeedy compiles `src/` into two bundles in `dist/`: `main.lynx.bundle` (embedded by Android and iOS) and `main.web.bundle` (loaded by the web host). Rsbuild then builds the web host and tools into `web/dist/`, which the Worker serves.
- **Web host** (`web/main.ts`): picks a page by URL. Lynx pages mount the bundle through web-core (`web/lynx-host.ts`). Tool pages load only their own code and never the Lynx runtime.
- **Browser-only tools**: the gym map (MapLibre GL JS, with Photon place search and gym requests), the route editor, and the email-link pages. Native apps open the editor in the browser and hand the signed-in session over with a one-time code; the native shells show their own MapLibre Native map and return only the chosen gym ID.
- **Route editor** (`web/editor/`): pick a photo, place holds by hand or run the detector, publish. The detector is a one-class YOLOv4-tiny ONNX model that runs in a dedicated Web Worker on ONNX Runtime's single-threaded WASM backend, so no cross-origin isolation is needed. Canvas burns the annotations into the JPEG before upload. Model details: [web/model/README.md](web/model/README.md).
- **Contracts**
  - `src/client-contract.ts`: HTTP types, paths, and the limits shared with the Worker, including username, display name, email, and password lengths. It must stay import-free.
  - `src/host-contract.ts`: what each host provides: NativeModules (session store, appearance, navigation, share, map), global props (`apiBaseUrl`, `systemTheme`, `themePreference` as `light`, `dark`, or `system`, `fontScale`, `reducedMotion`, plus `webHost`, `wideLayout`, `initialPage` on the web), and events (`routemaker:back` from Android's system Back and the web's Escape key, `routemaker:page` on web history changes). `npm run contract:check -w app` fails when the Kotlin, Swift, or web host lacks a module method, prop, or event it must provide.
- **Hand-off**: opening a tool from a native app signs the browser in with a one-time code. The browser asks "Continue as @name?" (or "Switch to @name?" when another account is signed in) before storing the session, and Cancel revokes it.
- **Notices** announce results to screen readers. A success clears itself; a failure stays until dismissed, with a Retry button when the action can be repeated.
- **Route lists** show 24 routes at a time with a "Show more" button; filtering and sorting happen on the device.
- **Route editor drafts** autosave on the device (IndexedDB), stored with their owner. They come back after a reload, sign-out, or an expired session. Publishing or discarding deletes the draft, and so does a different account opening the editor. The editor confirms the session with `GET /me` on load.
- **Security headers** for the web pages are in `web/_headers`. Lynx pages need `'unsafe-eval'`; the tool pages get a strict policy. `web/headers.test.ts` guards the rules. See the [root README](../README.md#security).

## Design system

The look is "The Gym Wall". It is defined once and shared by every host.

- **Tokens** are in `theme.css`: light values on `:root`, dark on `.theme-dark`. Lynx SVG content and gradients cannot read tokens, so `src/icons.ts` and the gradients repeat the values they need; `src/__tests__/theme.test.ts` keeps them in step.
- **Display font** "RM Display" is `resource/fonts/RMDisplay-800.*`, licensed under the SIL Open Font License (`OFL.txt`). Android and iOS register it from that shared file, and the web registers it with the FontFace API (`web/fonts.ts`; the CSP allows `font-src 'self'`). A condensed system stack is the fallback.
- **Root classes** on the app root: `theme-dark`, `wide` (web, wide layout), `rm` (reduced motion), and `fs-lg` / `fs-xl` (large system text). `src/pages/main/text-scale.ts` stops display type and the letters inside shapes growing past a cap.
- **Styles** sit next to the component they style. The browser tools share `web/tools.css` and add `editor/editor.css`, `map/map.css`, and `mail.css`.
- Logo geometry and palette are in `src/brand.ts`.

## Build and test

From the repo root (or add `-w app` to run one script):

```sh
npm run build          # app/dist and app/web/dist
npm test -w app
npm run check -w app   # brand assets, host contract, types, tests, build
```

Run `npm run build` before a native build: both platforms embed `app/dist/main.lynx.bundle`.

Native hosts resize the app above the keyboard and paint the bottom system-bar inset in the navigation colour.

## Android

- Install the Android SDK with platform 37 and Build-Tools, and point `ANDROID_HOME` or `app/android/local.properties` (`sdk.dir`) at it.
- Gradle runs on any JDK 17 or newer (CI uses 25). The app compiles to Java 17 bytecode. compileSdk 37, targetSdk 36, minSdk 24.
- The build fails with "Run npm run build first." when the bundle is missing.
- Needs a device or emulator with Vulkan 1.0.3, which MapLibre's default artifact requires, and an arm ABI (`armeabi-v7a` or `arm64-v8a`; Fresco's x86_64 libraries are not 16 KB aligned). Use an arm64 emulator image.

```sh
cd app/android
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

## iOS

Needs Xcode 26 and Ruby with Bundler. Deployment target is iOS 15.6.

```sh
npm run build
cd app/ios
bundle install
bundle exec pod install
open RouteMaker.xcworkspace
```

- CocoaPods comes from `app/Gemfile` (1.17). MapLibre comes from Swift Package Manager through the Xcode project.
- The session lives in the Keychain and is wiped on the first launch after a reinstall. `PrivacyInfo.xcprivacy` is the privacy manifest.

## API URL

Native builds embed the server URL.

|         | Android                                         | iOS                                             |
| ------- | ----------------------------------------------- | ----------------------------------------------- |
| Debug   | `http://10.0.2.2:8787` (emulator to host)       | `http://127.0.0.1:8787` (simulator)             |
| Release | `https://routemaker-worker.nandium.workers.dev` | `https://routemaker-worker.nandium.workers.dev` |

- Debug builds point at `npm run dev`. Android allows cleartext HTTP in debug builds only.
- Override, for staging or your own deployment:
  - Android: `-ProuteMakerApiBaseUrl=<url>` or the `ROUTEMAKER_API_BASE_URL` environment variable.
  - iOS: the `ROUTEMAKER_API_BASE_URL` build setting, for example `xcodebuild ... ROUTEMAKER_API_BASE_URL=<url>`.
- Release builds accept HTTPS URLs only and fail otherwise.
- The web build needs no URL; it calls the origin that served it. Share links use the same URL.

## Updating Lynx

Native Lynx versions must match on both platforms:

1. Set `lynx` in `android/gradle/libs.versions.toml` (Dependabot ignores the Lynx packages).
2. Set `LYNX_VERSION` in `ios/Podfile`, then refresh the five `LYNX_ARCHIVE_SHA256` digests. The recipe is in the Podfile: `curl -sL <archive url> | shasum -a 256` for each archive.
3. Run `bundle exec pod install`, then build both platforms.

## Brand assets

`src/brand.ts` is the only source of logo geometry and palette. After editing it:

```sh
brew install librsvg webp   # provides rsvg-convert and cwebp
npm run brand:assets -w app
```

This regenerates the light and dark icons in `resource/` and the iOS and Android launcher assets, and records their digests in `resource/brand-assets.json`. The outputs are committed so native builds need no image tools. `npm run check` fails when any of them is stale.
