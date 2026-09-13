import { z } from "zod";
import { AddressFieldsSchema, CompleteAddressSchema } from "./address";

/**
 * Typed schemas shared by the orchestrator, integration adapters, and API
 * routes. Every external response and every planner output must be parsed
 * through one of these before it is trusted (see "Reliability rules" in
 * CLAUDE.md).
 */

// ---------------------------------------------------------------------------
// User preferences
// ---------------------------------------------------------------------------

export const TransportationModeSchema = z.enum([
  "walking",
  "public-transit",
  "car",
  "bike",
]);
export type TransportationMode = z.infer<typeof TransportationModeSchema>;

export const UserPreferenceProfileSchema = z.object({
  dietaryRestrictions: z.array(z.string()).default([]),
  budget: z.number().nonnegative(),
  transportation: TransportationModeSchema.default("walking"),
  interests: z.array(z.string()).default([]),
  favoritePlaceIds: z.array(z.string()).default([]),
});
export type UserPreferenceProfile = z.infer<typeof UserPreferenceProfileSchema>;

// ---------------------------------------------------------------------------
// Places (Google Maps)
// ---------------------------------------------------------------------------

export const PlaceCategorySchema = z.enum(["restaurant", "grocery", "pharmacy", "park", "other"]);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

/** A place as normalized from Places API (New), before ranking is applied. */
export const NormalizedPlaceSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  category: PlaceCategorySchema,
  address: z.string().optional(),
  addressFields: AddressFieldsSchema.optional(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  priceLevel: z.number().int().min(0).max(4).optional(),
  openNow: z.boolean().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  transitDurationMinutes: z.number().nonnegative().optional(),
});
export type NormalizedPlace = z.infer<typeof NormalizedPlaceSchema>;

/** A place after deterministic ranking (see src/agent/ranking.ts). */
export const PlaceRecommendationSchema = NormalizedPlaceSchema.extend({
  score: z.number().min(0).max(1),
  scoreBreakdown: z.record(z.string(), z.number()),
  missingSignals: z.array(z.string()).default([]),
});
export type PlaceRecommendation = z.infer<typeof PlaceRecommendationSchema>;

// ---------------------------------------------------------------------------
// Essentials (Zinc)
// ---------------------------------------------------------------------------

export const EssentialItemSchema = z.object({
  productId: z.string(),
  title: z.string(),
  priceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive().default(1),
  available: z.boolean(),
  imageUrl: z.string().url().optional(),
});
export type EssentialItem = z.infer<typeof EssentialItemSchema>;

// ---------------------------------------------------------------------------
// Proposed / executed actions
// ---------------------------------------------------------------------------

export const ProposedActionSchema = z.object({
  actionId: z.string(),
  integration: z.enum(["google-calendar", "zinc"]),
  operationId: z.string(),
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const ActionResultSchema = z.object({
  actionId: z.string(),
  integration: z.enum(["google-calendar", "zinc"]),
  status: z.enum(["success", "failed", "pending"]),
  externalId: z.string().optional(),
  errorCode: z.string().optional(),
  retryable: z.boolean(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

export const ToolTraceEntrySchema = z.object({
  tool: z.enum(["google-maps", "google-calendar", "zinc"]),
  operation: z.string(),
  status: z.enum(["success", "failed", "pending"]),
  durationMs: z.number().nonnegative(),
  attempt: z.number().int().positive(),
  maskedExternalId: z.string().optional(),
  errorCode: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type ToolTraceEntry = z.infer<typeof ToolTraceEntrySchema>;

// ---------------------------------------------------------------------------
// Landing plan
// ---------------------------------------------------------------------------

export const LandingPlanSchema = z.object({
  planId: z.string(),
  destination: z.string(),
  arrivalAt: z.string().datetime(),
  profile: UserPreferenceProfileSchema,
  recommendations: z.array(PlaceRecommendationSchema),
  essentials: z.array(EssentialItemSchema),
  proposedActions: z.array(ProposedActionSchema),
  estimatedTotal: z.number().nonnegative(),
  warnings: z.array(z.string()),
  trace: z.array(ToolTraceEntrySchema),
});
export type LandingPlan = z.infer<typeof LandingPlanSchema>;

// ---------------------------------------------------------------------------
// API request contracts
// ---------------------------------------------------------------------------

export const PlanRequestSchema = z.object({
  destination: z.string().min(1),
  approximateAddress: z.string().min(1),
  destinationPlaceId: z.string().min(1).optional(),
  destinationAddress: CompleteAddressSchema.optional(),
  arrivalAt: z.string().datetime(),
  budget: z.number().nonnegative(),
  favoritePlaceIds: z.array(z.string()).default([]),
  preferenceOverrides: z
    .object({
      dietaryRestrictions: z.array(z.string()).optional(),
      transportation: TransportationModeSchema.optional(),
      interests: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
  demoMode: z.boolean().optional(),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const ExecuteRequestSchema = z.object({
  planId: z.string(),
  approvedActionIds: z.array(z.string()).min(1),
  excludedEssentialIds: z.array(z.string()).optional(),
});
export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

export const ExecuteResponseSchema = z.object({
  planId: z.string(),
  results: z.array(ActionResultSchema),
  trace: z.array(ToolTraceEntrySchema),
});
export type ExecuteResponse = z.infer<typeof ExecuteResponseSchema>;
