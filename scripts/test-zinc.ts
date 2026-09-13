import "./env";
import { search, createOrder, getOrder } from "../src/integrations/zinc";

const SANDBOX_SHIPPING_ADDRESS = {
  firstName: "Demo",
  lastName: "User",
  addressLine1: "123 Main St",
  city: "Boston",
  state: "MA",
  postalCode: "02215",
  phoneNumber: "+16175550123",
};

/**
 * Manual check for the Zinc adapter — no server needed. Requires
 * ZINC_API_KEY to be a `zn_test_...` sandbox key.
 * Usage:
 *   npm run check:zinc                      -- product search only
 *   npm run check:zinc -- --order           -- also places a sandbox order (test-success)
 *   npm run check:zinc -- --order --fail    -- places a sandbox order that fails (test-out-of-stock)
 */
async function main() {
  const query = process.argv[2]?.startsWith("--") ? undefined : process.argv[2];
  console.log(`\n--- search("${query ?? "paper towels"}") ---`);
  const results = await search(query ?? "paper towels");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n${results.length} result(s) found.`);

  if (!process.argv.includes("--order")) {
    console.log("\n(run with --order to also place a sandbox order; add --fail for the out-of-stock scenario)");
    return;
  }

  const scenario = process.argv.includes("--fail") ? "test-out-of-stock" : "test-success";
  console.log(`\n--- createOrder (sandbox scenario: ${scenario}) ---`);
  const order = await createOrder({
    productUrl: `https://zinc.com/shop/products/${scenario}`,
    maxPriceCents: 5000,
    shippingAddress: SANDBOX_SHIPPING_ADDRESS,
    customerEmail: "demo@example.com",
    idempotencyKey: `manual-test-${Date.now()}`,
  });
  console.log(JSON.stringify(order, null, 2));

  console.log("\n--- polling getOrder (out-of-stock/price-exceeded resolve asynchronously) ---");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await getOrder(order.id);
    console.log(`[attempt ${attempt}] status=${status.status}`);
    if (status.status !== "pending" && status.status !== "in_progress") {
      console.log(JSON.stringify(status, null, 2));
      break;
    }
  }
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
