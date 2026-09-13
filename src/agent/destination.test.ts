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
    const search = vi
      .spyOn(maps, "textSearch")
      .mockResolvedValue([
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
});
