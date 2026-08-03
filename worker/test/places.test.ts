import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { placeSearch } from "../src/places";

describe("place search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes Photon results behind the app contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
        expect(url.searchParams.get("q")).toBe("Boulder+ Aperia");
        expect(url.searchParams.get("limit")).toBe("5");
        expect(url.searchParams.get("lat")).toBe("1.352");
        expect(url.searchParams.get("lon")).toBe("103.820");
        expect(init?.cache).toBe("no-store");
        const feature = {
          type: "Feature",
          properties: {
            name: "Boulder+",
            housenumber: "12",
            street: "Kallang Avenue",
            city: "Singapore",
            country: "Singapore",
          },
          geometry: {
            type: "Point",
            coordinates: [103.8638367, 1.3097138],
          },
        };
        return Response.json({
          type: "FeatureCollection",
          features: [feature, feature],
        });
      }),
    );

    const response = await SELF.fetch(
      "https://routemaker.test/api/places?q=Boulder%2B%20Aperia&lat=1.3521&lon=103.8198",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual([
      {
        name: "Boulder+",
        address: "12 Kallang Avenue, Singapore",
        latitude: 1.3097138,
        longitude: 103.8638367,
      },
    ]);
  });

  it("returns Cloudflare's coarse request location without a provider call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const request = new Request("https://routemaker.test/api/location", {
      cf: { latitude: "1.3521", longitude: "103.8198" },
    });

    const response = await SELF.fetch(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      latitude: 1.35,
      longitude: 103.82,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns no coarse location when Cloudflare metadata is unavailable", async () => {
    const response = await SELF.fetch("https://routemaker.test/api/location");

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("skips malformed Photon features instead of failing the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          features: [
            null,
            "invalid",
            {
              properties: { name: "Valid gym" },
              geometry: { coordinates: [103.8, 1.3] },
            },
          ],
        }),
      ),
    );

    const response = await SELF.fetch(
      "https://routemaker.test/api/places?q=Singapore&lat=1.3521&lon=103.8198",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        name: "Valid gym",
        address: "",
        latitude: 1.3,
        longitude: 103.8,
      },
    ]);
  });

  it("rejects unbounded queries without calling Photon", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const response = await SELF.fetch(
      "https://routemaker.test/api/places?q=ab&lat=1.3521&lon=103.8198",
    );

    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("turns invalid provider responses into a useful gateway error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );

    const response = await SELF.fetch(
      "https://routemaker.test/api/places?q=Singapore&lat=1.3521&lon=103.8198",
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      detail: "Place search returned an invalid response",
    });
  });

  it("rejects an invalid map center without calling Photon", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const response = await SELF.fetch(
      "https://routemaker.test/api/places?q=Singapore&lat=91&lon=103.8198",
    );

    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels Photon when the incoming request is aborted", async () => {
    let providerSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            providerSignal = init?.signal ?? undefined;
            providerSignal?.addEventListener(
              "abort",
              () => reject(providerSignal?.reason),
              {
                once: true,
              },
            );
          }),
      ),
    );
    const controller = new AbortController();
    const response = placeSearch(
      new Request(
        "https://routemaker.test/api/places?q=Singapore&lat=1.3521&lon=103.8198",
        { signal: controller.signal },
      ),
    );

    await vi.waitFor(() => expect(providerSignal).toBeDefined());
    controller.abort();

    await expect(response).rejects.toBeInstanceOf(Response);
    expect(providerSignal?.aborted).toBe(true);
  });
});
