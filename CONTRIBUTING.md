# Contributing

Set up and run the project with the [README](README.md). Run `npm run check` before opening a PR; it is what CI runs. `npm test` runs the app's tests, then the Worker's. After native changes, also build the platform you touched ([app/README.md](app/README.md)).

## Conventions

- Prefer deleting code, and plain direct code, over layers, compatibility branches, and speculative abstractions. Extract a shared abstraction when three real callers make it clearer.
- Comments explain why a boundary or non-obvious flow exists. Code that reads plainly gets none. A complex function gets a short summary of its flow.
- Tests sit next to the behaviour they cover: `__tests__/` in `app/src`, `*.test.ts` beside the modules in `app/web`, `worker/test`. They exercise behaviour, not implementation.
- Prettier owns formatting (`npm run format`). Commit messages follow Conventional Commits, for example `feat(worker): add place search`.
- The Worker routes explicitly in `worker/src/index.ts`, and each handler checks who may call it first. No repositories, service classes, queues, or provider interfaces until measured change pressure earns them.

## One home per value

Each value lives at the narrowest useful scope. Do not build a global constants bucket across build systems.

| Value                                                                  | File                         |
| ---------------------------------------------------------------------- | ---------------------------- |
| API paths, wire types, shared limits (including account field lengths) | `app/src/client-contract.ts` |
| Host bridge (modules, props, events)                                   | `app/src/host-contract.ts`   |
| Worker limits                                                          | `worker/src/limits.ts`       |
| Design tokens                                                          | `app/theme.css`              |
| Logo geometry and palette                                              | `app/src/brand.ts`           |
| Detector constants                                                     | `app/web/editor/yolo.ts`     |

- `client-contract.ts` is imported by the Worker, so it stays import-free. Change it and both sides together.
- `host-contract.ts` is checked by `npm run contract:check -w app`: every module method, global prop, and event listed for a platform must be declared in its Kotlin, Swift, or web host. Add to the contract first, then implement it everywhere it is required.
- Schema changes go in a new numbered file in `worker/migrations/`. Never edit an applied migration. Migrations run before the new Worker is deployed, so keep each compatible with the previous Worker (hard cuts only while nothing is in production). Text length limits (in `limits.ts` and the client contract) are also enforced by `CHECK` constraints there; change both.

## Dependencies and supply chain

- One lockfile, at the root. Commit it. CI installs with `npm ci`.
- New releases wait seven days: the root `.npmrc` sets `min-release-age=7` for npm, and Dependabot has a matching cooldown (14 days for major versions). Dependabot opens weekly PRs for npm, Gradle, Bundler, Swift packages, and GitHub Actions.
- Overrides (`miniflare` → `undici`, `@cloudflare/vitest-plugin` → `zod`) and the install-script allow-list (`allowScripts`) live in the root `package.json`; npm reads both from the root only. A new package that ships an install script makes npm warn. Review the script, then add the package to `allowScripts` as `true` or `false`. The field needs npm 11.16 or newer, which `engines` requires.
- GitHub Actions are pinned to commit SHAs with the version in a comment. The Lynx iOS archives are pinned by SHA-256 in the Podfile, and the Gradle wrapper by its distribution checksum.
- Lynx native versions are bumped by hand, since Dependabot cannot update CocoaPods or the matching Maven artifacts. See [Updating Lynx](app/README.md#updating-lynx).

## CI

Jobs in `.github/workflows/ci.yml`:

- **Web and worker**: `npm ci`, `npm run check`.
- **Android debug build**: `npm run build`, then `./gradlew :app:assembleDebug :app:testDebugUnitTest`.
- **iOS simulator build**: `npm run build`, `pod install`, `xcodebuild` for the simulator.
- **Workflow security**: zizmor lints workflow changes.
- **Dependency review**: fails a PR that adds a dependency with a high or critical advisory.
- **Deploy to Cloudflare**: on push to `main`, after the first job passes: build, migrate, deploy, then a health check (`curl` of `/api/health` on the production URL). See [Deploy](README.md#deploy).

The first job runs on pull requests and on pushes to `main`. Deploy runs on pushes only; the other jobs run on pull requests only.
