# ADR 0001: ReactLynx client and one Cloudflare Worker

Status: accepted.

## Decision

- One ReactLynx UI serves Android, iOS, and the web. The native shells host Lynx directly and add only what Lynx cannot do: session storage, share, navigation, appearance, and the map.
- Three pages are browser-only tools: the gym map, the route editor, and the email-link pages. They load no Lynx runtime.
- One TypeScript Cloudflare Worker serves the static site, `/api`, `/media`, and link-preview HTML for `/routes/:id`. D1 stores product data and bounded JPEG route photos as BLOBs.
- Firebase Authentication (REST) owns passwords, email verification, and password-reset mail. The Worker issues its own revocable sessions and stays the authority for profiles and roles.
- Hold detection runs on the device: a YOLOv4-tiny ONNX model in a Web Worker on the single-threaded WASM backend. Canvas resizes the photo and burns the annotations into the JPEG before upload.
- MapLibre draws maps: GL JS on the web, MapLibre Native in the Android and iOS shells. ReactLynx keeps gym data and navigation; the native map returns only the chosen gym ID.
- No other services: no model server, containers, object storage, or queues.

## Why

- **One Worker.** Accounts, gyms, routes, likes, ascents, follows, reports, and moderation need no distributed services. One deploy and one D1 transaction boundary cover them.
- **Firebase for passwords.** A secure PBKDF2 cost exceeds the free Worker's CPU budget, and lowering it would weaken passwords. Firebase Spark provides the identity lifecycle without an SDK or refresh-token state in each Lynx host.
- **Detection on the device.** Photos stay local until publishing, and no inference server exists to run or pay for. The WASM-only runtime needs no cross-origin isolation and keeps every static asset under Cloudflare's 25 MiB limit. One CPU thread is fast enough for this model; the model download is the main first-use cost.
- **Browser-only tools.** Rebuilding Canvas and ONNX Runtime in Swift, Kotlin, and Lynx would cost more than it returns. Keeping the tools off the Lynx runtime also lets them run under a strict content security policy without `eval`.
- **One map boundary.** The native shells present MapLibre Native behind a thin controller, so ReactLynx keeps all product state and API logic and the shells hold none.
- **Link previews from the Worker.** Link-preview crawlers do not run the app, so the Worker adds preview tags to the shell for `/routes/:id`.
- **D1 BLOBs, deliberately narrow.** A photo is at most 512 KiB, its thumbnail 64 KiB; an account holds 20 photos and the site 200. That caps photos near 112 MiB, inside D1's 500 MB Free database, and avoids the only Cloudflare product that needs metered billing.

## Boundaries

- Client wire types, shared limits, and API paths live in `app/src/client-contract.ts`, which the Worker imports. The host bridge lives in `app/src/host-contract.ts`, and a script checks it against the Kotlin, Swift, and web hosts. Visual values live in one token file. Worker limits live in `worker/src/limits.ts`.
- The Worker routes explicitly in `worker/src/index.ts`, and each handler checks who may call it first. That gives locality without repositories, service classes, generic transports, or dependency injection.

## Consequences

- Local and production share one Firebase REST flow.
- The web tool page finishes Firebase email actions, so a completed password reset can revoke old sessions. Revoking when mail is only requested would let anyone log out an account by knowing its email.
- A native app signs the browser in with a one-time code in the URL fragment. The browser asks for one confirmation before storing the session, so a forwarded link cannot silently switch accounts.
- Request throttling is a D1 table, not a separate service.
- D1 media is served through the Worker. Hiding a route clears its photo and thumbnail in the same statement.
- Worker and D1 Free-plan exhaustion fails closed instead of creating overage. Firebase email keeps its daily quotas.
- There is no fallback server: an outage at Cloudflare or Firebase is an outage of RouteMaker.
