# RouteMaker

RouteMaker lets climbers mark holds on a wall photo, publish the route to a
gym, and discuss, vote on, and grade it together.

The revival has two runtime parts:

- `app/` — one ReactLynx product UI for Android, iOS, and the web. Mapbox,
  Canvas, and the browser-local ONNX detector are loaded only by the web tools.
- `worker/` — one TypeScript Cloudflare Worker serving the website and API,
  with one D1 database for product data and tightly compressed route photos.

Firebase Authentication owns passwords, verification mail, and password-reset
mail. The Worker keeps profiles, roles, and revocable app sessions, so Firebase
does not spread through the product code.

There is no Python service, model server, container, compatibility API, or
legacy AWS/Ionic runtime.

## Run locally

Use Node 22 or 24.

```sh
cd app
npm ci

cd ../worker
npm ci
npm run dev
```

Open <http://127.0.0.1:8787>. The local command applies the D1 migration,
builds the website, and starts the Worker. Put a Firebase Web API key in
`worker/.dev.vars` first:

```text
FIREBASE_API_KEY=your-key
ADMIN_EMAIL=you@example.com
```

To enable the interactive gym map, copy `app/.env.example` to `app/.env` and
add one URL-restricted Mapbox public token. The token belongs to the site, not
each visitor; without it, RouteMaker shows the approved gym list instead.

Web navigation uses resource paths such as `/gyms`, `/routes/:id`, and
`/users/:username`; account and tool pages have their own paths too. Cloudflare
falls back to the app shell for these paths so shared links and browser refresh
work without a second web server. Native screens keep the same state flow and
ignore the optional browser-history bridge.

Enable Email/Password sign-in in the Firebase project. In Authentication →
Templates, set the action URL for verification and reset mail to the deployed
RouteMaker `/auth/action` URL. The web shell handles both links and revokes old
app sessions only after a password is changed.

## Deploy

Cloudflare hosts the static site, Worker, and D1 database as one project.
Firebase Spark supplies authentication and account email. Create the production
D1 database once, then copy its name and ID into the `[[d1_databases]]` entry in
`worker/wrangler.toml` (both `database_name` and `database_id` are required for
remote migrations and deploys):

```sh
cd worker
npx wrangler login
npx wrangler d1 create routemaker-worker
# Add the returned database_name and database_id to worker/wrangler.toml.
npx wrangler secret put FIREBASE_API_KEY
npx wrangler secret put ADMIN_EMAIL
npm run deploy
```

`ADMIN_EMAIL` is the account that becomes the first administrator. Restrict the
Firebase key to the Identity Toolkit API. Keep `app/.env` on the machine that
builds the site so the Mapbox token is included in later releases. Later
releases need only:

```sh
cd worker
npm run deploy
```

Cloudflare's free Worker and D1 plans stop serving writes or requests at their
free limits rather than creating metered overage. Firebase Spark also has daily
authentication/email quotas.

Route photos are raw JPEG BLOBs in D1, never Base64. The browser compresses
them to at most 512 KiB and 1600 px; accounts may retain 20 photos and publish
three routes per day. Uploads accept baseline Huffman JPEGs, the format emitted
by the browser canvas. The site accepts at most 200 photos, which creates a
hard 100 MiB photo ceiling inside D1's 500 MB Free-plan database limit.

## Verify

```sh
cd app
npm run check
cd android && ./gradlew assembleDebug

cd ../../worker
npm run check
```

The ONNX model and its WASM runtime are both below Cloudflare's 25 MiB
per-static-asset limit. Detection runs locally in a dedicated browser worker;
photos stored in D1 are already resized, annotated JPEGs.
