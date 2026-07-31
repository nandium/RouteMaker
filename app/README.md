# RouteMaker app

One ReactLynx bundle renders the product UI on Android, iOS, and the web host.
The native shells host Lynx 4 directly; there is no intermediate application
framework or generated native project. Rspeedy 0.15 builds the bundle with
Rspack 2 and Rsbuild 2.
Mapbox and wall-photo annotation are lazy-loaded browser tools because retaining
those strong web primitives costs less than custom native bridges.

Native and browser storage are separate, so opening a hosted tool from Android
or iOS asks you to sign in there. On the website, the product UI and tools share
the same browser session.

From `app/`:

```sh
npm install
npm test
npm run build:web
```

Run `npm run build` before a native build. Android and iOS both package the same
`dist/main.lynx.bundle`; copying it into platform-specific asset directories
would create two stale sources of truth.

Debug builds deliberately point at local development servers: Android emulators
use `http://10.0.2.2:8787`, while iOS simulators use
`http://127.0.0.1:8787`. Android permits cleartext traffic only in Debug;
iOS uses its local loopback address without a release networking exception.

CI runs Gradle on JDK 25; select JDK 25 as the Gradle JVM in local shells and
Android Studio as well. The Android module also requests a JDK 25 compiler
toolchain, but emits Java 17 bytecode because Android devices run ART rather
than a Java 25 JVM. The compiler toolchain, bytecode, and Android SDK levels are
centralized in `android/gradle/libs.versions.toml`; CI's runtime JDK is selected
independently in `.github/workflows/ci.yml`.

For Android, override the debug endpoint when needed with either a Gradle
property or environment variable:

```sh
npm run build
(cd android && ./gradlew :app:assembleDebug \
  -ProuteMakerApiBaseUrl=http://10.0.2.2:8787)
```

Release tasks require an HTTPS endpoint and fail before building if it is missing
or invalid. Supply the same property (or `ROUTEMAKER_API_BASE_URL`) in CI; no
emulator URL is used as a release fallback:

```sh
(cd android && ./gradlew :app:assembleRelease \
  -ProuteMakerApiBaseUrl=https://api.example.com
)
```

For iOS, the Debug build setting provides the simulator URL. Release has no
endpoint default and the project validation phase requires a valid HTTPS URL
with a host; pass it as an xcodebuild setting (or define it in the release
build configuration):

```sh
npm run build
(cd ios && bundle install && bundle exec pod install)

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcodebuild -workspace ios/RouteMaker.xcworkspace \
  -scheme RouteMaker -configuration Release \
  ROUTEMAKER_API_BASE_URL=https://api.example.com
```
