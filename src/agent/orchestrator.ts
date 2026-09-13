import { randomUUID } from "node:crypto";

import {
  LandingPlanSchema,
  PlanRequestSchema,
  type ActionResult,
  type EssentialItem,
  type ExecuteRequest,
  type ExecuteResponse,
  type LandingPlan,
  type NormalizedPlace,
  type PlanRequest,
  type ProposedAction,
} from "@/agent/schemas";
import { rankPlaces } from "@/agent/ranking";
import * as googleMaps from "@/integrations/google-maps";
import * as googleCalendar from "@/integrations/google-calendar";
import * as zinc from "@/integrations/zinc";
import { Tracer, traced } from "@/reliability/trace";
import { withRetry } from "@/reliability/retry";
import { idempotencyStore } from "@/reliability/idempotency";

import demoProfileFixture from "@/fixtures/demo-profile.json";
import placesFixture from "@/fixtures/api-responses/places.json";
import calendarEventsFixture from "@/fixtures/api-responses/calendar-events.json";
import zincEssentialsFixture from "@/fixtures/api-responses/zinc-essentials.json";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const DEMO_SHIPPING_ADDRESS: zinc.ShippingAddress = {
  firstName: "Demo",
  lastName: "User",
  addressLine1: "123 Main St",
  city: "Boston",
  state: "MA",
  postalCode: "02215",
  phoneNumber: "+16175550123",
  country: "US",
};
const DEMO_CUSTOMER_EMAIL = "demo@example.com";

/** Ready-to-use PlanRequest built from src/fixtures/demo-profile.json. */
export const demoPlanRequest: PlanRequest = PlanRequestSchema.parse(demoProfileFixture);

/**
 * In-memory store so /api/execute can look up the plan an approval refers
 * to (and whether it was generated in demo mode) by `planId`. No database
 * per CLAUDE.md — this is process-local and resets on restart, which is
 * fine for a single-process hackathon demo.
 */
type StoredPlan = { plan: LandingPlan; demoMode: boolean; approvedCart?: string };
// Share the process-local store across Next.js route bundles and development reloads.
const processState = globalThis as typeof globalThis & { landingPlans?: Map<string, StoredPlan> };
const planStore = processState.landingPlans ??= new Map<string, StoredPlan>();

function isDemoMode(request: PlanRequest): boolean {
  if (request.demoMode !== undefined) return request.demoMode;
  return process.env.DEMO_MODE === "true";
}

// ---------------------------------------------------------------------------
// Plan generation (CLAUDE.md "Primary workflow" steps 2-8)
// ---------------------------------------------------------------------------

export async function generatePlan(request: PlanRequest): Promise<LandingPlan> {
  const tracer = new Tracer();
  const warnings: string[] = [];
  const demoMode = isDemoMode(request);
  if (demoMode) {
    warnings.push("Demo mode: using recorded fixture data, not live API calls.");
  }

  const profile = {
    dietaryRestrictions: request.preferenceOverrides?.dietaryRestrictions ?? [],
    budget: request.budget,
    transportation: request.preferenceOverrides?.transportation ?? ("walking" as const),
    interests: request.preferenceOverrides?.interests ?? [],
    favoritePlaceIds: request.favoritePlaceIds,
  };

  const [events, places, essentials] = await Promise.all([
    loadCalendarEvents(request, demoMode, tracer, warnings),
    loadPlaces(request, demoMode, tracer, warnings),
    loadEssentials(request, demoMode, tracer, warnings),
  ]);

  const recommendations = rankPlaces(places, profile);
  const planId = randomUUID();
  const proposedActions = buildProposedActions({
    planId,
    recommendations,
    essentials,
    events,
    arrivalAt: request.arrivalAt,
    warnings,
  });

  // The proposed Zinc order lists everything available and lets the user
  // approve, edit (excludedEssentialIds), or reject it — see
  // executeApprovedActions' budget check, which is the actual enforcement
  // point (RF11 / RNF07: "nunca executar acima do teto"). This total is
  // informational so the plan is explainable before that gate.
  const essentialsTotalCents = essentials
    .filter((item) => item.available)
    .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  if (essentialsTotalCents / 100 > request.budget) {
    warnings.push("Estimated essentials total exceeds the stated budget; remove items before approving.");
  }

  const plan = LandingPlanSchema.parse({
    planId,
    destination: request.destination,
    arrivalAt: request.arrivalAt,
    profile,
    recommendations,
    essentials,
    proposedActions,
    estimatedTotal: Number((essentialsTotalCents / 100).toFixed(2)),
    warnings,
    trace: tracer.list(),
  });

  planStore.set(planId, { plan, demoMode });
  return plan;
}

async function loadCalendarEvents(
  request: PlanRequest,
  demoMode: boolean,
  tracer: Tracer,
  warnings: string[],
): Promise<googleCalendar.CalendarEvent[]> {
  if (demoMode) return calendarEventsFixture as googleCalendar.CalendarEvent[];

  const timeMin = request.arrivalAt;
  const timeMax = new Date(Date.parse(request.arrivalAt) + SEVENTY_TWO_HOURS_MS).toISOString();
  try {
    return await withRetry(
      () =>
        traced(
          tracer,
          { tool: "google-calendar", operation: "listEvents", attempt: 1 },
          (events: googleCalendar.CalendarEvent[]) => events[0]?.id,
          () => googleCalendar.listEvents(timeMin, timeMax),
        ),
      { operation: "google-calendar.listEvents" },
    );
  } catch (error) {
    warnings.push(`Google Calendar unavailable: ${errorMessage(error)}`);
    return [];
  }
}

async function loadPlaces(
  request: PlanRequest,
  demoMode: boolean,
  tracer: Tracer,
  warnings: string[],
): Promise<NormalizedPlace[]> {
  if (demoMode) return placesFixture as NormalizedPlace[];

  try {
    const destination = request.destinationPlaceId
      ? await traced(tracer, { tool: "google-maps", operation: "destinationDetails", attempt: 1 },
          (place: NormalizedPlace) => place.placeId,
          () => googleMaps.placeDetails(request.destinationPlaceId!, AbortSignal.timeout(8000)))
      : undefined;
    const center = destination?.location;
    const [restaurants, groceries] = await Promise.all([
      withRetry(
        () =>
          traced(
            tracer,
            { tool: "google-maps", operation: "textSearch:restaurants", attempt: 1 },
            (r: NormalizedPlace[]) => r[0]?.placeId,
            () => googleMaps.textSearch(`restaurants near ${request.approximateAddress}`, center),
          ),
        { operation: "google-maps.textSearch:restaurants" },
      ),
      withRetry(
        () =>
          traced(
            tracer,
            { tool: "google-maps", operation: "textSearch:groceries", attempt: 1 },
            (r: NormalizedPlace[]) => r[0]?.placeId,
            () => googleMaps.textSearch(`grocery stores near ${request.approximateAddress}`, center),
          ),
        { operation: "google-maps.textSearch:groceries" },
      ),
    ]);
    const combined = [...new Map([...restaurants, ...groceries].map(place => [place.placeId, {
      ...place,
      ...(center ? { distanceMeters: googleMaps.distanceMeters(center, place.location) } : {}),
    }])).values()];
    if (combined.length === 0) {
      warnings.push("Google Places returned no results in the initial search.");
    }
    return combined;
  } catch (error) {
    warnings.push(`Google Places unavailable: ${errorMessage(error)}`);
    return [];
  }
}

async function loadEssentials(
  request: PlanRequest,
  demoMode: boolean,
  tracer: Tracer,
  warnings: string[],
): Promise<EssentialItem[]> {
  if (demoMode) return zincEssentialsFixture as EssentialItem[];

  try {
    const results = await withRetry(
      () =>
        traced(
          tracer,
          { tool: "zinc", operation: "search", attempt: 1 },
          (r: zinc.SearchResult[]) => r[0]?.productId,
          () => zinc.search("dorm move-in essentials"),
        ),
      { operation: "zinc.search" },
    );
    return results.map((r) => ({
      productId: r.productId,
      title: r.title,
      priceCents: r.priceCents,
      quantity: 1,
      available: r.available,
      imageUrl: r.imageUrl,
    }));
  } catch (error) {
    warnings.push(`Zinc unavailable: ${errorMessage(error)}`);
    return [];
  }
}

/**
 * Proposes at most one Calendar event per top recommendation category and
 * one aggregated Zinc order, scheduled into free slots within the first 72
 * hours. Deterministic placeholder scheduling — refine once the Calendar
 * dev has real free/busy semantics and timezone handling in place.
 */
function buildProposedActions(args: {
  planId: string;
  recommendations: ReturnType<typeof rankPlaces>;
  essentials: EssentialItem[];
  events: googleCalendar.CalendarEvent[];
  arrivalAt: string;
  warnings: string[];
}): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const windowStart = new Date(args.arrivalAt);
  const windowEnd = new Date(windowStart.getTime() + SEVENTY_TWO_HOURS_MS);
  const busy = [...args.events];

  const topGrocery = pickOpenCandidate(args.recommendations, "grocery", args.warnings);
  const grocerySlot = topGrocery && findFreeSlot(busy, windowStart, windowEnd, 45);
  if (topGrocery && grocerySlot) {
    busy.push({ id: "proposed-grocery", summary: "Grocery run", ...grocerySlot });
    actions.push({
      actionId: randomUUID(),
      integration: "google-calendar",
      operationId: `${args.planId}-calendar-grocery`,
      summary: `Grocery run: ${topGrocery.name}`,
      payload: {
        summary: `Grocery run: ${topGrocery.name}`,
        start: grocerySlot.start,
        end: grocerySlot.end,
        placeId: topGrocery.placeId,
      },
    });
  }

  const topRestaurant = pickOpenCandidate(args.recommendations, "restaurant", args.warnings);
  const mealSlot = topRestaurant && findFreeSlot(busy, windowStart, windowEnd, 60);
  if (topRestaurant && mealSlot) {
    actions.push({
      actionId: randomUUID(),
      integration: "google-calendar",
      operationId: `${args.planId}-calendar-meal`,
      summary: `Meal: ${topRestaurant.name}`,
      payload: {
        summary: `Meal: ${topRestaurant.name}`,
        start: mealSlot.start,
        end: mealSlot.end,
        placeId: topRestaurant.placeId,
      },
    });
  }

  // Proposes everything available; budget enforcement happens at approval
  // time in executeApprovedActions (the user edits the cart there via
  // excludedEssentialIds before it's ever executed).
  const availableEssentials = args.essentials.filter((item) => item.available);
  if (availableEssentials.length > 0) {
    actions.push({
      actionId: randomUUID(),
      integration: "zinc",
      operationId: `${args.planId}-zinc-order`,
      summary: `Order ${availableEssentials.length} essentials`,
      payload: {
        items: availableEssentials.map((item) => ({
          productId: item.productId,
          title: item.title,
          quantity: item.quantity,
          priceCents: item.priceCents,
        })),
      },
    });
  }

  return actions;
}

/**
 * Picks the highest-ranked candidate in `category` that isn't closed at the
 * proposed time. `recommendations` is already sorted best-first by
 * rankPlaces(), so a closed place ahead of the chosen one is explicitly
 * skipped and logged — never silently proposed (doc section 7, "Lugar
 * fechado": "Excluir candidato ou alertar explicitamente").
 */
export function pickOpenCandidate(
  recommendations: ReturnType<typeof rankPlaces>,
  category: "grocery" | "restaurant",
  warnings: string[],
): ReturnType<typeof rankPlaces>[number] | undefined {
  const candidates = recommendations.filter((r) => r.category === category);
  const chosen = candidates.find((r) => r.openNow !== false);
  for (const place of candidates) {
    if (place === chosen) break;
    if (place.openNow === false) {
      warnings.push(`${place.name} ranked highest for ${category} but is closed at the proposed time; excluded.`);
    }
  }
  if (!chosen && candidates.length > 0) {
    warnings.push(`No open ${category} found among the recommendations; no ${category} action proposed.`);
  }
  return chosen;
}

function findFreeSlot(
  events: googleCalendar.CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  durationMinutes: number,
): { start: string; end: string } | undefined {
  const stepMs = 30 * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;
  for (
    let t = windowStart.getTime();
    t + durationMs <= windowEnd.getTime();
    t += stepMs
  ) {
    const start = new Date(t).toISOString();
    const end = new Date(t + durationMs).toISOString();
    if (!googleCalendar.hasConflict(start, end, events)) {
      return { start, end };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Execution (CLAUDE.md "Primary workflow" step 10 — approval-gated writes)
// ---------------------------------------------------------------------------

export async function executeApprovedActions(request: ExecuteRequest): Promise<ExecuteResponse> {
  const entry = planStore.get(request.planId);
  if (!entry) {
    throw new Error(`Unknown planId: ${request.planId}`);
  }
  const { plan, demoMode } = entry;
  if (request.approvedActionIds.some(id => !plan.proposedActions.some(a => a.actionId === id))) {
    throw new Error("Unknown approved action ID");
  }
  const excluded = [...new Set(request.excludedEssentialIds ?? [])].sort();
  if (excluded.some(id => !plan.essentials.some(item => item.productId === id))) {
    throw new Error("Unknown essential item");
  }
  const cartKey = JSON.stringify(excluded);
  const zincAction = plan.proposedActions.find((a) => a.integration === "zinc");
  const includesOrder = zincAction !== undefined && request.approvedActionIds.includes(zincAction.actionId);
  if (includesOrder) {
    if (entry.approvedCart !== undefined && entry.approvedCart !== cartKey) {
      throw new Error("This order was already approved with a different cart. Build a new plan to change it.");
    }
    // Validate against the proposed action's own payload (the actual order
    // that will be sent to Zinc) rather than re-deriving the list from
    // plan.essentials — they happen to match today, but this stays correct
    // if the two ever diverge (e.g. per-item exclusions upstream).
    const proposedItems = zincAction.payload.items as { productId: string; priceCents: number; quantity: number }[];
    const items = proposedItems.filter((item) => !excluded.includes(item.productId));
    if (!items.length) throw new Error("Select at least one essential or deselect the Zinc order.");
    if (items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) > Math.round(plan.profile.budget * 100)) {
      throw new Error("The approved essentials exceed your budget.");
    }
    entry.approvedCart = cartKey;
  }

  const tracer = new Tracer();
  const approvedActions = plan.proposedActions.filter((action) =>
    request.approvedActionIds.includes(action.actionId),
  ).map(action => action.integration !== "zinc" ? action : {
    ...action,
    payload: { ...action.payload, items: (action.payload.items as { productId: string }[]).filter(item => !excluded.includes(item.productId)) },
  });

  const results = await Promise.all(
    approvedActions.map((action) => executeOneAction(action, tracer, demoMode)),
  );

  return { planId: request.planId, results, trace: tracer.list() };
}

async function executeOneAction(
  action: ProposedAction,
  tracer: Tracer,
  demoMode: boolean,
): Promise<ActionResult> {
  return idempotencyStore.getOrCreate(action.operationId, () => {
    if (demoMode) return simulateAction(action, tracer);
    return action.integration === "google-calendar"
      ? executeCalendarAction(action, tracer)
      : executeZincAction(action, tracer);
  });
}

/**
 * Demo-mode execution: no live credentials required. Still goes through the
 * idempotency store and produces a real trace entry, but the externalId is
 * clearly marked as a demo id — never presented as a live confirmation
 * (CLAUDE.md: fixtures/demo data must not look like fake live responses).
 */
async function simulateAction(action: ProposedAction, tracer: Tracer): Promise<ActionResult> {
  const start = Date.now();
  const externalId = `demo-${action.integration}-${action.actionId}`;
  tracer.record({
    tool: action.integration === "google-calendar" ? "google-calendar" : "zinc",
    operation: action.integration === "google-calendar" ? "createEvent (demo)" : "createOrder (demo)",
    status: "success",
    durationMs: Date.now() - start,
    attempt: 1,
    maskedExternalId: `demo***${action.actionId.slice(-2)}`,
  });
  return {
    actionId: action.actionId,
    integration: action.integration,
    status: action.integration === "zinc" ? "pending" : "success",
    externalId,
    retryable: false,
  };
}

async function executeCalendarAction(action: ProposedAction, tracer: Tracer): Promise<ActionResult> {
  const payload = action.payload as { summary: string; start: string; end: string };
  try {
    const created = await withRetry(
      () =>
        traced(
          tracer,
          { tool: "google-calendar", operation: "createEvent", attempt: 1 },
          (r: googleCalendar.CreatedEvent) => r.id,
          () =>
            googleCalendar.createEvent({
              summary: payload.summary,
              start: payload.start,
              end: payload.end,
              operationId: action.operationId,
            }),
        ),
      { operation: "google-calendar.createEvent" },
    );
    return {
      actionId: action.actionId,
      integration: "google-calendar",
      status: "success",
      externalId: created.id,
      retryable: false,
    };
  } catch (error) {
    return {
      actionId: action.actionId,
      integration: "google-calendar",
      status: "failed",
      errorCode: errorMessage(error),
      retryable: true,
    };
  }
}

async function executeZincAction(action: ProposedAction, tracer: Tracer): Promise<ActionResult> {
  const payload = action.payload as {
    items: { productId: string; title: string; quantity: number; priceCents: number }[];
  };
  const maxPriceCents = payload.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  try {
    // TODO(zinc): `productId` values from live search are not directly
    // orderable URLs. Until the retailer URL mapping is confirmed, this
    // targets the documented sandbox success product so the reliability
    // scenarios (out-of-stock, price-exceeded) can be exercised with the
    // corresponding test URLs instead. Swap in real product URLs once
    // confirmed against https://www.zinc.com/docs/v2/api-reference.
    const created = await withRetry(
      () =>
        traced(
          tracer,
          { tool: "zinc", operation: "createOrder", attempt: 1 },
          (r: zinc.CreatedOrder) => r.id,
          () =>
            zinc.createOrder({
              productUrl: "https://zinc.com/shop/products/test-success",
              quantity: 1,
              maxPriceCents: Math.max(maxPriceCents, 1),
              shippingAddress: DEMO_SHIPPING_ADDRESS,
              customerEmail: DEMO_CUSTOMER_EMAIL,
              idempotencyKey: zinc.toIdempotencyKey(action.operationId),
            }),
        ),
      { operation: "zinc.createOrder" },
    );
    return {
      actionId: action.actionId,
      integration: "zinc",
      status: created.status === "order_failed" ? "failed" : "pending",
      externalId: created.id,
      retryable: created.status === "order_failed",
    };
  } catch (error) {
    return {
      actionId: action.actionId,
      integration: "zinc",
      status: "failed",
      errorCode: errorMessage(error),
      retryable: true,
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}
