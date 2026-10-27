# Security policy

## Supported version

Only `main`, which is what runs in production. Fixes land there.

## Reporting a vulnerability

Report privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability**. Please do not open a public issue or pull request for a vulnerability.

Include what you found, the steps or request that reproduce it, and the impact you expect. Test only against your own accounts or a local instance (`npm run dev`), not other people's data.

In scope: the Worker and its API, the web app and its tool pages, and the Android and iOS apps. Reports about third-party services (Firebase, Cloudflare, Photon, OpenFreeMap) belong to those providers.

The hardening already in place is summarised in the [README](README.md#security).
