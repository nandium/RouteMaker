# ADR 0001: Hard-cut to Lynx and one Cloudflare Worker

## Status

Accepted.

## Decision

RouteMaker has one ReactLynx product UI and one TypeScript Cloudflare Worker.
The Worker serves the built website and API; D1 stores product data and bounded
JPEG route photos. Firebase Authentication owns passwords, email verification,
and password-reset delivery. The Worker issues its own small revocable sessions
and remains the authority for profiles and roles.

The trained YOLOv4-tiny detector runs in the browser as ONNX. A dedicated Web
Worker prepares a 416×416 tensor and runs the portable WASM backend. Canvas
resizes and burns annotations into a JPEG before upload.

The former Ionic app, AWS services, Python server, Docker image, R2 bucket,
server-side prediction endpoint, training artifacts, and compatibility paths
are removed. Git history is the archive.

## Why

The product needs accounts, gyms, routes, voting, grades, comments, reports,
moderation, and a social feed; it does not need distributed application
services. One Worker gives these features a single deployment and one D1
transaction boundary.

Password derivation was deliberately moved out of the Worker. A secure PBKDF2
cost exceeds the free Worker's CPU budget; lowering it to fit would trade away
password security. Firebase Spark provides the required identity lifecycle
without putting an SDK or refresh-token state into each Lynx host.

Moving inference to the client removes the only native-service dependency.
The WASM-only runtime stays below Cloudflare's static-asset limit and avoids
cross-origin isolation requirements. On this small model, one CPU thread is
already interactive, while model download remains the dominant first-use cost.

Mapbox and photo editing remain browser-native because reproducing those mature
surfaces in Swift, Kotlin, and Lynx would add more code than value. Native apps
open the same hosted tools and keep the main product UI in ReactLynx.

D1 BLOB storage is deliberately narrow rather than pretending to be a general
object store. Each JPEG is capped at 512 KiB, each account at 20 photos, and the
site at 200 photos. This makes the maximum photo footprint 100 MiB and removes
the only Cloudflare product that requires enabling metered billing.

## Boundaries

Client wire types and API paths are centralized together. Visual values live in
one token file. Detector constants live with its decoder. Worker limits and
runtime constants live with shared Worker helpers. Values are not centralized
across unrelated build systems merely to create a global constants bucket.

The Worker has three product domains—auth/profile, routes/social, and admin—and
an explicit router. This is enough structure for locality without repositories,
service classes, generic transports, or dependency injection.

## Consequences

Local and production auth use the same Firebase REST flow. The plain web shell
finishes Firebase email actions so a completed password reset can revoke old
RouteMaker sessions; revoking them when mail is merely requested would let
anyone log out an account by knowing its email. D1 media is served through the
Worker and cleared in the same transaction that hides a route.

Cloudflare and Firebase free limits are suitable for a small revival. Worker
and D1 Free-plan exhaustion fails closed instead of creating metered overage;
Firebase email still has daily quotas. The architecture minimizes services and
explicitly caps its largest data type.

This is a hard cut. There is no fallback server or dual-write migration path.
