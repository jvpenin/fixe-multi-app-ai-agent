import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import * as zinc from "@/integrations/zinc";

/**
 * Confirms ZINC_API_KEY is valid by hitting the real Zinc sandbox the same
 * way the orchestrator does in src/agent/orchestrator.ts (search, then
 * createOrder with an idempotencyKey, then getOrder). Never touches
 * production — only sandbox test product URLs. Skipped automatically when
 * no key is configured, so DEMO_MODE / CI runs are unaffected.
 *
 * Run with a sandbox key set:
 *   ZINC_API_KEY=zn_test_... npx vitest run src/integrations/zinc.live.test.ts
 */
const hasZincKey = Boolean(process.env.ZINC_API_KEY);

describe.skipIf(!hasZincKey)("zinc live sandbox connection", () => {
  it("searches, orders, and reads back an order status, exactly like the orchestrator does", async () => {
    const results = await zinc.search("paper towels");
    expect(Array.isArray(results)).toBe(true);

    const order = await zinc.createOrder({
      productUrl: "https://zinc.com/shop/products/test-success",
      maxPriceCents: 5000,
      shippingAddress: {
        firstName: "Demo",
        lastName: "User",
        addressLine1: "123 Main St",
        city: "Boston",
        state: "MA",
        postalCode: "02215",
        phoneNumber: "+16175550123",
        country: "US",
      },
      customerEmail: "demo@example.com",
      // Zinc caps idempotency_key at 36 chars, so a bare UUID (36 chars) is
      // the longest safe value — see docs/v2/api-reference/orders/create-order.
      idempotencyKey: randomUUID(),
    });
    expect(order.id).toBeTruthy();

    const status = await zinc.getOrder(order.id);
    expect(status.id).toBe(order.id);
  });
});

describe.skipIf(hasZincKey)("zinc live sandbox connection (skipped)", () => {
  it("skips because ZINC_API_KEY is not set", () => {
    expect(hasZincKey).toBe(false);
  });
});
