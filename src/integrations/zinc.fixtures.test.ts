import { afterEach, describe, expect, it, vi } from "vitest";

import * as zinc from "@/integrations/zinc";
import successFixture from "@/fixtures/api-responses/zinc-order-success.json";
import outOfStockFixture from "@/fixtures/api-responses/zinc-order-out-of-stock.json";

/**
 * Recorded Zinc API responses for a successful order and an out-of-stock
 * order (per the doc's "gravar response fixture" fallback for when the
 * sandbox is unavailable). These tests exercise zinc.ts's parsing against
 * that recorded data — no network call, no ZINC_API_KEY required.
 */
describe("zinc.getOrder against recorded fixtures", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function stubFetchWith(body: unknown) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it("normalizes a successful, order_placed response", async () => {
    vi.stubEnv("ZINC_API_KEY", "zn_test_fixture");
    stubFetchWith(successFixture);

    const status = await zinc.getOrder(successFixture.id);
    expect(status).toEqual({
      id: successFixture.id,
      status: "order_placed",
      merchantOrderIds: ["113-7654321-7654321"],
      totalCents: 4900,
    });
  });

  it("normalizes an out-of-stock, order_failed response without ever looking like success", async () => {
    vi.stubEnv("ZINC_API_KEY", "zn_test_fixture");
    stubFetchWith(outOfStockFixture);

    const status = await zinc.getOrder(outOfStockFixture.id);
    expect(status.status).toBe("order_failed");
    expect(status.merchantOrderIds).toEqual([]);
    expect(status.totalCents).toBeUndefined();
  });
});
