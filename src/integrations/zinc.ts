/**
 * Zinc API v2 adapter (sandbox only for this MVP — see .env.example).
 * Docs: https://www.zinc.com/docs/v2/api-reference
 * Base URL is https://api.zinc.com — the "v2" is a docs/reference label,
 * not a URL path segment.
 *
 * Auth: `Authorization: Bearer <ZINC_API_KEY>`. A key with the `zn_test_`
 * prefix runs against the sandbox — no real purchase is ever made.
 *
 * Sandbox test product URLs (use these instead of real Amazon URLs while
 * testing, per https://www.zinc.com/docs/v2/api-reference/introduction/sandbox):
 *   success        -> https://zinc.com/shop/products/test-success
 *   out of stock   -> https://zinc.com/shop/products/test-out-of-stock
 *   price exceeded -> https://zinc.com/shop/products/test-price-exceeded
 *   invalid address -> https://zinc.com/shop/products/test-invalid-address
 */

import { createHash } from "node:crypto";

export type SearchResult = {
  productId: string;
  title: string;
  priceCents: number;
  available: boolean;
  imageUrl?: string;
};

export type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  phoneNumber: string;
  country?: string; // ISO 3166-1 alpha-2, defaults to US
};

export type CreateOrderInput = {
  productUrl: string;
  quantity?: number;
  maxPriceCents: number;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  /** Zinc enforces this key server-side: same key -> at most one order. */
  idempotencyKey: string;
};

export type CreatedOrder = {
  id: string;
  status: string;
};

export type OrderStatus = {
  id: string;
  status: "pending" | "in_progress" | "order_placed" | "order_failed" | "cancelled" | "cancelled_by_retailer";
  merchantOrderIds: string[];
  totalCents?: number;
};

/**
 * Zinc caps `idempotency_key` at 36 characters. Landing's `operationId`s
 * (e.g. `${planId}-zinc-order`) usually run longer, so shorten deterministically
 * — same operationId always maps to the same key, preserving RNF04.
 */
export function toIdempotencyKey(operationId: string): string {
  if (operationId.length <= 36) return operationId;
  return createHash("sha256").update(operationId).digest("hex").slice(0, 36);
}

function baseUrl(): string {
  return process.env.ZINC_API_BASE_URL ?? "https://api.zinc.com";
}

function authHeaders(): Record<string, string> {
  const key = process.env.ZINC_API_KEY;
  if (!key) throw new Error("ZINC_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** GET /products/search — $0.01 per call, metered before orders are placed. */
export async function search(
  query: string,
  retailer: "amazon" | "walmart" | "bestbuy" | "etsy" = "amazon",
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const url = new URL(`${baseUrl()}/products/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("retailer", retailer);

  const response = await fetch(url, { headers: authHeaders(), signal });
  if (!response.ok) {
    throw new Error(`zinc search failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as {
    results?: { product_id: string; title: string; price: number | null; image?: string }[];
  };
  // The search endpoint doesn't return an availability flag — it only lists
  // results it found. Availability is only confirmed by the order itself
  // (out-of-stock surfaces later as an order status, see getOrder below).
  // Some results come back with price: null (retailer didn't report one);
  // drop those rather than let a null cost corrupt budget totals downstream.
  return (data.results ?? [])
    .filter((r): r is typeof r & { price: number } => r.price != null)
    .map((r) => ({
      productId: r.product_id,
      title: r.title,
      priceCents: r.price,
      available: true,
      imageUrl: r.image,
    }));
}

/**
 * POST /orders — sandbox only. Pass `idempotencyKey` from
 * `src/reliability/idempotency.ts` so a retried /api/execute call never
 * creates a second order; Zinc itself also enforces uniqueness on this key
 * and returns `already_exists` (treat that as success, not failure).
 */
export async function createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreatedOrder> {
  const response = await fetch(`${baseUrl()}/orders`, {
    method: "POST",
    headers: authHeaders(),
    signal,
    body: JSON.stringify({
      products: [{ url: input.productUrl, quantity: input.quantity ?? 1 }],
      shipping_address: {
        first_name: input.shippingAddress.firstName,
        last_name: input.shippingAddress.lastName,
        address_line1: input.shippingAddress.addressLine1,
        address_line2: input.shippingAddress.addressLine2,
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        postal_code: input.shippingAddress.postalCode,
        phone_number: input.shippingAddress.phoneNumber,
        country: input.shippingAddress.country ?? "US",
      },
      max_price: input.maxPriceCents,
      idempotency_key: input.idempotencyKey,
      customer_notifications: { email: input.customerEmail },
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`zinc createOrder failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string; status: string };
  return { id: data.id, status: data.status };
}

/**
 * GET /orders/{id} — out-of-stock / price-exceeded are ASYNCHRONOUS: the
 * order is created successfully and only later transitions to
 * `order_failed`. Poll or check this before reporting success to the user
 * (CLAUDE.md: "never report an action as successful without API
 * confirmation").
 */
export async function getOrder(orderId: string, signal?: AbortSignal): Promise<OrderStatus> {
  const response = await fetch(`${baseUrl()}/orders/${orderId}`, {
    headers: authHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`zinc getOrder failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as {
    id: string;
    status: OrderStatus["status"];
    merchant_order_ids?: string[];
    job_result?: { price_components?: { total?: number } };
  };
  return {
    id: data.id,
    status: data.status,
    merchantOrderIds: data.merchant_order_ids ?? [],
    totalCents: data.job_result?.price_components?.total,
  };
}
