import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlan, demoPlanRequest } from "@/agent/orchestrator";
import * as maps from "@/integrations/google-maps";
import * as calendar from "@/integrations/google-calendar";
import * as zinc from "@/integrations/zinc";

afterEach(() => vi.restoreAllMocks());
describe("exact destination search", () => {
  it("anchors both searches and calculates distance from the selected destination", async () => {
    const center = { lat: 37.8, lng: -122.4 };
    vi.spyOn(maps, "placeDetails").mockResolvedValue({
      placeId: "home",
      name: "Home",
      category: "other",
      location: center,
    });
    const search = vi.spyOn(maps, "textSearch").mockResolvedValue([
      {
        placeId: "cafe",
        name: "Nearby cafe",
        category: "restaurant",
        location: { lat: 37.801, lng: -122.4 },
      },
    ]);
    vi.spyOn(calendar, "listEvents").mockResolvedValue([]);
    vi.spyOn(zinc, "search").mockResolvedValue([]);
    const plan = await generatePlan({
      ...demoPlanRequest,
      destinationPlaceId: "home",
      demoMode: false,
    });
    expect(search).toHaveBeenCalledWith(
      expect.stringContaining("restaurants near"),
      center,
    );
    expect(search).toHaveBeenCalledWith(
      expect.stringContaining("grocery stores near"),
      center,
    );
    expect(plan.recommendations).toHaveLength(1);
    expect(plan.recommendations[0]?.distanceMeters).toBeCloseTo(111.19, 1);
    expect(
      plan.trace.some(
        (t) => t.operation === "destinationDetails" && t.status === "success",
      ),
    ).toBe(true);
  });
  it("resolves the edited full address before searching nearby", async () => {
    const center = { lat: 37.8, lng: -122.4 };
    const search = vi
      .spyOn(maps, "textSearch")
      .mockResolvedValueOnce([
        { placeId: "home", name: "Home", category: "other", location: center },
      ])
      .mockResolvedValue([]);
    vi.spyOn(calendar, "listEvents").mockResolvedValue([]);
    vi.spyOn(zinc, "search").mockResolvedValue([]);
    const plan = await generatePlan({
      ...demoPlanRequest,
      demoMode: false,
      destinationAddress: {
        number: "2550",
        street: "Van Ness Avenue",
        unit: "4B",
        city: "San Francisco",
        state: "CA",
        country: "United States",
        postalCode: "94109",
      },
    });
    const address =
      "2550 Van Ness Avenue, 4B, San Francisco, CA, 94109, United States";
    expect(search).toHaveBeenNthCalledWith(
      1,
      address,
      undefined,
      2000,
      expect.any(AbortSignal),
    );
    expect(search).toHaveBeenCalledWith(`restaurants near ${address}`, center);
    expect(plan.destination).toBe("San Francisco, CA, United States");
  });
});
