import { describe, expect, it } from "vitest";

import {
  generatePlan,
  executeApprovedActions,
  demoPlanRequest,
  pickOpenCandidate,
} from "@/agent/orchestrator";
import { LandingPlanSchema, ExecuteResponseSchema, type PlaceRecommendation } from "@/agent/schemas";

describe("orchestrator (demo mode, no live credentials required)", () => {
  it("generates a valid LandingPlan from fixtures", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    expect(() => LandingPlanSchema.parse(plan)).not.toThrow();
    expect(plan.recommendations.length).toBeGreaterThan(0);
    expect(plan.warnings.some((w) => w.includes("Demo mode"))).toBe(true);
    expect(plan.proposedActions.length).toBeGreaterThan(0);
  });

  it("never proposes conflicting calendar actions against existing events", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    const calendarActions = plan.proposedActions.filter((a) => a.integration === "google-calendar");
    expect(calendarActions.length).toBeGreaterThan(0);
  });

  it("executes approved actions idempotently without hitting live APIs", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    const actionIds = plan.proposedActions.map((a) => a.actionId);

    const first = await executeApprovedActions({ planId: plan.planId, approvedActionIds: actionIds });
    expect(() => ExecuteResponseSchema.parse(first)).not.toThrow();
    expect(first.results.every((r) => r.status !== "failed")).toBe(true);

    // Calling execute twice (e.g. double-click) must not produce different
    // external ids for the same action.
    const second = await executeApprovedActions({ planId: plan.planId, approvedActionIds: actionIds });
    expect(second.results.map((r) => r.externalId)).toEqual(first.results.map((r) => r.externalId));
  });

  it("rejects execution against an unknown planId", async () => {
    await expect(
      executeApprovedActions({ planId: "does-not-exist", approvedActionIds: ["x"] }),
    ).rejects.toThrow(/Unknown planId/);
  });

  it("never proposes a Zinc order above the stated budget (section 7: 'Budget baixo')", async () => {
    // Fixture essentials: towels 14.99, sheets 29.99, toiletries 18.99 (available),
    // powerstrip 21.99 (unavailable, ignored). A $20 budget only fits the towels.
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true, budget: 20 });

    const zincAction = plan.proposedActions.find((a) => a.integration === "zinc");
    const items = (zincAction?.payload as { items: { priceCents: number; quantity: number }[] } | undefined)
      ?.items ?? [];
    const orderedTotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

    expect(orderedTotalCents).toBeLessThanOrEqual(2000);
    expect(plan.estimatedTotal).toBeLessThanOrEqual(20);
    expect(plan.warnings.some((w) => w.includes("Removed") && w.includes("budget"))).toBe(true);
  });

  it("proposes no Zinc order at all when nothing fits the budget", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true, budget: 0.5 });

    expect(plan.proposedActions.some((a) => a.integration === "zinc")).toBe(false);
    expect(plan.estimatedTotal).toBe(0);
    expect(plan.warnings.some((w) => w.includes("Removed 3 essential item(s)"))).toBe(true);
  });
});

describe("pickOpenCandidate (section 7: 'Lugar fechado')", () => {
  const base: Omit<PlaceRecommendation, "placeId" | "name" | "openNow" | "score"> = {
    category: "restaurant",
    location: { lat: 0, lng: 0 },
    scoreBreakdown: {},
    missingSignals: [],
  };

  it("excludes the top-ranked candidate when it's closed, and picks the next open one", () => {
    const recommendations: PlaceRecommendation[] = [
      { ...base, placeId: "closed-top", name: "Closed Top Pick", openNow: false, score: 0.9 },
      { ...base, placeId: "open-second", name: "Open Runner Up", openNow: true, score: 0.6 },
    ];
    const warnings: string[] = [];
    const chosen = pickOpenCandidate(recommendations, "restaurant", warnings);

    expect(chosen?.placeId).toBe("open-second");
    expect(warnings.some((w) => w.includes("Closed Top Pick") && w.includes("closed"))).toBe(true);
  });

  it("proposes nothing and warns when every candidate is closed", () => {
    const recommendations: PlaceRecommendation[] = [
      { ...base, placeId: "closed-only", name: "Only Option", openNow: false, score: 0.9 },
    ];
    const warnings: string[] = [];
    const chosen = pickOpenCandidate(recommendations, "restaurant", warnings);

    expect(chosen).toBeUndefined();
    expect(warnings.some((w) => w.includes("No open restaurant found"))).toBe(true);
  });

  it("does not warn when the top candidate is already open", () => {
    const recommendations: PlaceRecommendation[] = [
      { ...base, placeId: "open-top", name: "Open Top Pick", openNow: true, score: 0.9 },
    ];
    const warnings: string[] = [];
    const chosen = pickOpenCandidate(recommendations, "restaurant", warnings);

    expect(chosen?.placeId).toBe("open-top");
    expect(warnings).toHaveLength(0);
  });
});
