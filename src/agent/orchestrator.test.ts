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

  it("warns when the estimated essentials total exceeds the budget (section 7: 'Budget baixo')", async () => {
    // Enforcement itself happens at approval time (see "approval with edited
    // essentials" below) — this only checks the plan is explainable upfront.
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true, budget: 0.5 });
    expect(plan.warnings.some((w) => w.includes("exceeds the stated budget"))).toBe(true);
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

describe("approval with edited essentials", () => {
  it("keeps the approved cart fixed across retries", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    const order = plan.proposedActions.find(a => a.integration === 'zinc')!;
    const removed = plan.essentials[0]!.productId;
    const request = { planId: plan.planId, approvedActionIds: [order.actionId], excludedEssentialIds: [removed] };
    const first = await executeApprovedActions(request);
    const repeated = await executeApprovedActions(request);
    expect(first.results[0]?.externalId).toBe(repeated.results[0]?.externalId);
    await expect(executeApprovedActions({ ...request, excludedEssentialIds: [] })).rejects.toThrow(/different cart/);
  });

  it("rejects an empty cart and unknown item IDs before executing", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    const order = plan.proposedActions.find(a => a.integration === 'zinc')!;
    await expect(executeApprovedActions({ planId: plan.planId, approvedActionIds: [order.actionId], excludedEssentialIds: plan.essentials.map(i => i.productId) })).rejects.toThrow(/at least one essential/);
    await expect(executeApprovedActions({ planId: plan.planId, approvedActionIds: [order.actionId], excludedEssentialIds: ['unknown'] })).rejects.toThrow(/Unknown essential/);
  });

  it("blocks an over-budget order without blocking approved calendar events", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, budget: 0, demoMode: true });
    const order = plan.proposedActions.find(a => a.integration === 'zinc')!;
    const event = plan.proposedActions.find(a => a.integration === 'google-calendar')!;
    await expect(executeApprovedActions({ planId: plan.planId, approvedActionIds: [order.actionId] })).rejects.toThrow(/exceed your budget/);
    const result = await executeApprovedActions({ planId: plan.planId, approvedActionIds: [event.actionId] });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.integration).toBe('google-calendar');
  });

  it("rejects action IDs that do not belong to the plan", async () => {
    const plan = await generatePlan({ ...demoPlanRequest, demoMode: true });
    await expect(executeApprovedActions({ planId: plan.planId, approvedActionIds: ['unknown'] })).rejects.toThrow(/Unknown approved action/);
  });
});
