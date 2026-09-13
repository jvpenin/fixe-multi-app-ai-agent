import { describe, expect, it, vi } from "vitest";

/**
 * Section 7 ("Zinc out of stock" / price-exceeded): the app must never
 * report a Zinc order as successful when Zinc reports it failed, and must
 * mark it retryable. All three external integrations are mocked here so
 * this runs with demoMode: false (the real, non-fixture code path in
 * orchestrator.ts) without any network call or API key.
 *
 * Known limitation this test does NOT cover: per zinc.ts's own docs,
 * out-of-stock/price-exceeded normally resolve ASYNCHRONOUSLY (the order is
 * accepted as "pending" first, then later transitions to order_failed).
 * executeZincAction only inspects the immediate createOrder response and
 * does not currently poll getOrder — see the TODO at orchestrator.ts's
 * executeZincAction. This test exercises the synchronous-failure path the
 * code does handle today; catching the async transition would require
 * adding a bounded getOrder poll, which is out of scope for this pass.
 */
vi.mock("@/integrations/google-calendar", () => ({
  listEvents: vi.fn().mockResolvedValue([]),
  hasConflict: vi.fn().mockReturnValue(false),
  createEvent: vi.fn(),
}));

vi.mock("@/integrations/google-maps", () => ({
  textSearch: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/integrations/zinc", async () => {
  const actual = await vi.importActual<typeof import("@/integrations/zinc")>("@/integrations/zinc");
  return {
    ...actual,
    search: vi.fn().mockResolvedValue([
      { productId: "p1", title: "Sandbox test item", priceCents: 999, available: true },
    ]),
    createOrder: vi.fn().mockResolvedValue({ id: "order-out-of-stock-1", status: "order_failed" }),
  };
});

import { generatePlan, executeApprovedActions } from "@/agent/orchestrator";

describe("zinc order failure handling (out-of-stock / price-exceeded)", () => {
  it("never reports success and marks the action retryable when Zinc returns order_failed", async () => {
    const plan = await generatePlan({
      destination: "Boston, MA",
      approximateAddress: "Fenway-Kenmore, Boston, MA",
      arrivalAt: new Date(Date.now() + 3600_000).toISOString(),
      budget: 100,
      favoritePlaceIds: [],
      demoMode: false,
    });

    const zincAction = plan.proposedActions.find((a) => a.integration === "zinc");
    expect(zincAction).toBeTruthy();

    const { results } = await executeApprovedActions({
      planId: plan.planId,
      approvedActionIds: [zincAction!.actionId],
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).not.toBe("success");
    expect(results[0]!.status).toBe("failed");
    expect(results[0]!.retryable).toBe(true);
  });
});
