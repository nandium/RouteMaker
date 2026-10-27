# RouteMaker

Climbers mark holds on a wall photo and publish the route to a gym. Others like it, log their ascents (send, grade, note), and follow the setters.

- **App** (`app/`): one ReactLynx UI for Android, iOS, and the web, plus browser-only tools: the gym map, the route editor (an ONNX hold detector runs on the device), and the email-link pages. See [app/README.md](app/README.md).
- **Worker** (`worker/`): one Cloudflare Worker serving the static site, `/api`, `/media`, and link-preview HTML for `/routes/:id`. D1 stores data and route photos.
- **Firebase Authentication** (REST) owns passwords and account email. The Worker keeps profiles, roles, and revocable sessions.
- **Contracts**: `app/src/client-contract.ts` holds the HTTP types, paths, and shared limits, which the app and the Worker both use. It stays import-free because the Worker imports it. `app/src/host-contract.ts` lists the modules, props, and events each native and web host provides to the app.

Why it is built this way: [docs/adr/0001-lynx-and-cloudflare-worker.md](docs/adr/0001-lynx-and-cloudflare-worker.md). Working on it: [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick start

Needs Node 24.15 or newer (`.nvmrc` has 24) and npm 11.16 or newer, which current Node 24 releases bundle. Packages are npm workspaces, installed once at the root.

```sh
npm ci
npm run dev
```

Open <http://localhost:8787>.

- `npm run dev` builds the app, applies D1 migrations to a local database (one gym is seeded), and starts the Worker. Rerun it to pick up app changes.
- Browsing works as is. Sign-up and sign-in answer 503 until the Worker has a Firebase key.
- To sign in locally: `cp worker/.dev.vars.example worker/.dev.vars`, set `FIREBASE_API_KEY`, and finish the [Firebase setup](#firebase-setup). Sign-in needs a verified email.
- Use a separate Firebase project for local work and point its email action URL at `http://localhost:8787/auth/action`, so the production emails keep their links.
- Debug Android and iOS builds talk to this server: `http://10.0.2.2:8787` (emulator) and `http://127.0.0.1:8787` (simulator). See [app/README.md](app/README.md).

## Commands

Run from the repo root.

| Command          | What it does                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`    | Build, migrate the local database, start the Worker on :8787.                                                                                         |
| `npm run build`  | Build `app/dist` (Lynx bundles, embedded by Android and iOS) and `app/web/dist` (the site the Worker serves).                                         |
| `npm test`       | The app's tests, then the Worker's.                                                                                                                   |
| `npm run check`  | Prettier, then the app (brand assets, host contract, types, tests, build), then the Worker (types, tests, `wrangler deploy --dry-run`). CI runs this. |
| `npm run format` | Prettier on the whole repo.                                                                                                                           |
| `npm run deploy` | Build, apply D1 migrations to production, deploy the Worker.                                                                                          |

One workspace only: `npm test -w app`, `npm run check -w worker`. The Worker check needs the app built, which the app check does first.

## Deploy

Production: <https://routemaker-worker.nandium.workers.dev>. Cloudflare hosts the site, Worker, and D1 database as one project. The D1 database ID is committed in `worker/wrangler.toml`, so every deploy targets the same database.

**CI deploys.** A push to `main` runs the check job, then the "Deploy to Cloudflare" job (GitHub environment `production`): build, apply D1 migrations, deploy. Add two secrets to that environment:

- `CLOUDFLARE_API_TOKEN`: permissions Workers Scripts: Edit and D1: Edit.
- `CLOUDFLARE_ACCOUNT_ID`.

**Manual deploy:** `npm run deploy` with `wrangler login` or the same two variables in the environment.

**First time:**

1. From `worker/`, run `npx wrangler login`, then `npx wrangler secret put FIREBASE_API_KEY`.
2. Push to `main` or run `npm run deploy`.
3. Finish the [Firebase setup](#firebase-setup) with the deployed URL.
4. Make yourself admin. Sign up in the app and verify the email, then from `worker/`:

   ```sh
   npx wrangler d1 execute DB --remote --command "UPDATE users SET role='admin' WHERE email='you@example.com'"
   ```

   Use the lower-case address. Admins review reports and gym requests and can disable users.

**Own Cloudflare account:** run `npx wrangler d1 create routemaker-worker` in `worker/` and replace `database_id` in `worker/wrangler.toml`. Native release builds also need your URL ([app/README.md](app/README.md#api-url)).

Migrations live in `worker/migrations/` and apply in order before each deploy, so the previous Worker runs on the new schema until the new one is live. Keep a migration compatible with the previous Worker (add tables and columns; drop in a later release). While nothing is in production, a migration may be a hard cut.

### Firebase setup

In the Firebase project (the free Spark plan is enough):

- Turn on the Email/Password provider.
- Set the action URL of the verification and password-reset emails to `https://<site>/auth/action`.
- Restrict the Web API key to the Identity Toolkit API.
- Turn on email enumeration protection.
- Set the password policy to at least 8 characters, the Worker's minimum.

## Limits

Values live in `app/src/client-contract.ts` (shared with the app: photo sizes, name, email, and password lengths) and `worker/src/limits.ts`.

- Photo: baseline JPEG, at most 512 KiB and 1600 px. Thumbnail: at most 64 KiB and 640 px. The browser compresses both before upload.
- 20 photos per account, 200 across the site: about 112 MiB, well inside D1's 500 MB Free-plan database.
- 3 published routes per account per day, 5 pending gym requests per account, 5 signed-in sessions per account.
- Lists return up to 100 items, except the gym list, which is unbounded and small by nature. The app shows 24 routes at a time and filters and sorts the list on the device.
- Cloudflare allows 25 MiB per static asset. The largest here, the ONNX Runtime WASM and the detector model, are about 14 MB and 12 MB.

## Privacy

- Device location is requested only while a map is open, to centre it. If it is declined or pending, the map falls back to Cloudflare's coarse request location (rounded to two decimals), then to an approved gym, then to a default view of Singapore. RouteMaker does not store or cache these coordinates.
- Place search goes through the Worker to the public Photon geocoder. Photon receives the submitted query and the map centre rounded to three decimals. Queries are 3-100 characters, submitted explicitly, and return at most 5 results.
- Gym coordinates are product data in D1.
- Maps use OpenFreeMap's public tiles, on the web and in the native apps. OpenFreeMap sees the requester's IP address and the area being viewed. No map account or token exists.
- Photos stay on the device until a route is published, and hold detection runs there. A route draft (photo and markings) stays in the browser's IndexedDB, tied to its owner, until it is published or discarded, or a different account opens the route editor. Signing out and an expired session leave it.
- The Worker's per-request invocation logs are off, so URLs (including search coordinates) are not retained. Console errors are still logged.
- Sessions: iOS Keychain (this device only, wiped on the first launch after a reinstall), Android private app storage, browser `localStorage`. Android backups are off. Opening a browser tool from a native app hands the session over with a one-time code (valid 120 seconds) in the URL fragment, which no server sees. The browser asks "Continue as @name?" (or "Switch to @name?" when another account is signed in) before it stores the session; Cancel revokes it.
- Deleting an account (Account screen, password required) removes the Firebase identity and the user's data, including routes and photos. Reports they filed stay, anonymised.
- The iOS privacy manifest declares email, name, user ID, and user content, for app functionality only and never for tracking.

## Abuse and cost

- The Worker throttles in D1 (`worker/src/throttle.ts`; values in `worker/src/limits.ts`). Over a limit it answers 429 with `Retry-After`.
  - 3 emails per address per hour, shared by sign-up and password-reset requests.
  - 20 auth requests per client IP per minute, shared by sign-up, sign-in, password reset, email verification, and hand-off redemption.
  - 30 place searches per client IP per minute.
  - Locally there is no client address, so only the per-address email limit applies.
- Per-account caps bound spam: routes per day, photos, pending gym requests, open reports (20 per reporter), sessions.
- Names and notes reject control and direction-changing characters, and a few usernames (`admin`, `support`, ...) are reserved.
- Unverified accounts are hidden from profiles, follows, and reports until their first sign-in. They are never purged.
- Sign-up says when an email or username is already registered, an accepted trade-off. Sign-in and password-reset replies do not reveal whether an address has an account.
- Many verified accounts can still use up the 200-photo site cap. Admins can remove routes to free space.
- Cloudflare's Free plans fail closed at their limits instead of billing overage. Firebase Spark has daily sign-in and email quotas.

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

- `app/web/_headers` sets a content security policy per page. Lynx pages (`/*`) need `'unsafe-eval'` because web-core evaluates the app bundle. The three tool pages (`/gyms/map`, `/routes/new`, `/auth/action`) never load the Lynx runtime and each gets only what it uses. The MapLibre worker script has its own rule for the tile origin, and only `/gyms/map` may use the device location. `app/web/headers.test.ts` checks each page, the hash of web-core's inline bootstrap script, and that `worker/wrangler.toml` keeps the tool pages out of the Worker.
- The Worker adds `nosniff`, `no-referrer`, same-origin resource policy, a `default-src 'none'` CSP, and HSTS to every `/api` and `/media` response. Share previews at `/routes/:id` keep the shell's headers.
- Session tokens are 256 random bits, stored hashed, valid 30 days. A password reset signs out every device. Request bodies must be JSON or multipart and are size-checked as they stream in.
- Dependencies and CI follow the supply-chain policy in [CONTRIBUTING.md](CONTRIBUTING.md#dependencies-and-supply-chain).
