import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchNearbyEssentials } from "@/integrations/google-maps";

/** Builds a minimal Places API (New) raw place object for mocking responses. */
function mockRawPlace(
  id: string,
  primaryType: string,
  overrides: Partial<{ rating: number; priceLevel: string }> = {},
) {
  return {
    id,
    displayName: { text: `Place ${id}` },
    formattedAddress: "123 Main St",
    location: { latitude: -25.43, longitude: -49.27 },
    rating: overrides.rating ?? 4.5,
    priceLevel: overrides.priceLevel ?? "PRICE_LEVEL_MODERATE",
    currentOpeningHours: { openNow: true },
    primaryType,
    types: [primaryType],
  };
}

describe("fetchNearbyEssentials", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fetches all four categories, tags each place correctly, and attaches transit minutes", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if (url.includes("computeRouteMatrix")) {
        // Return one element per destination, in the same order sent —
        // 1 min, 2 min, 3 min, 4 min for restaurant/grocery/pharmacy/park.
        const elements = (body.destinations as unknown[]).map((_, index) => ({
          destinationIndex: index,
          duration: `${(index + 1) * 60}s`,
          condition: "ROUTE_EXISTS",
        }));
        return { ok: true, json: async () => elements } as Response;
      }

      if (url.includes(":searchNearby")) {
        const type = (body.includedTypes as string[])[0] ?? "";
        const placeByType: Record<string, unknown> = {
          restaurant: mockRawPlace("r1", "restaurant"),
          grocery_store: mockRawPlace("g1", "grocery_store"),
          pharmacy: mockRawPlace("p1", "pharmacy"),
          park: mockRawPlace("k1", "park"),
        };
        const place = placeByType[type];
        return { ok: true, json: async () => ({ places: place ? [place] : [] }) } as Response;
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNearbyEssentials({ lat: -25.4284, lng: -49.2733 }, 1500);

    expect(result.restaurants).toHaveLength(1);
    expect(result.restaurants[0]!.category).toBe("restaurant");
    expect(result.groceries[0]!.category).toBe("grocery");
    expect(result.pharmacies[0]!.category).toBe("pharmacy");
    expect(result.parks[0]!.category).toBe("park");

    // Transit minutes attached in the flattened order the function builds
    // internally: restaurants, groceries, pharmacies, parks.
    expect(result.restaurants[0]!.transitDurationMinutes).toBe(1);
    expect(result.groceries[0]!.transitDurationMinutes).toBe(2);
    expect(result.pharmacies[0]!.transitDurationMinutes).toBe(3);
    expect(result.parks[0]!.transitDurationMinutes).toBe(4);

    // Rating and price level come straight from the Places response itself —
    // no separate call needed.
    expect(result.restaurants[0]!.rating).toBe(4.5);
    expect(result.restaurants[0]!.priceLevel).toBe(2); // PRICE_LEVEL_MODERATE
  });

  it("leaves transitDurationMinutes undefined when transit can't reach a place", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(":searchNearby")) {
        return { ok: true, json: async () => ({ places: [mockRawPlace("x1", "restaurant")] }) } as Response;
      }
      if (url.includes("computeRouteMatrix")) {
        return {
          ok: true,
          json: async () => [{ destinationIndex: 0, condition: "ROUTE_NOT_FOUND" }],
        } as Response;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNearbyEssentials({ lat: 0, lng: 0 });
    expect(result.restaurants[0]!.transitDurationMinutes).toBeUndefined();
  });

  it("throws a clear error when computeRouteMatrix responds with a non-OK status", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(":searchNearby")) {
        return { ok: true, json: async () => ({ places: [mockRawPlace("x1", "restaurant")] }) } as Response;
      }
      if (url.includes("computeRouteMatrix")) {
        return { ok: false, status: 403, text: async () => "Routes API not enabled" } as Response;
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchNearbyEssentials({ lat: 0, lng: 0 })).rejects.toThrow(
      /computeRouteMatrix.*failed: 403/,
    );
  });
});
