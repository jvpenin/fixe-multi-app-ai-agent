import type {
  NormalizedPlace,
  PlaceRecommendation,
  UserPreferenceProfile,
} from "@/agent/schemas";

/**
 * Base weights per CLAUDE.md's "Ranking" section. When a signal is missing
 * for a place, its weight is redistributed proportionally across the
 * signals that ARE available for that place, and the gap is recorded in
 * `missingSignals` so it shows up in the trace/plan — never silently
 * dropped, never invented by the LLM.
 */
const BASE_WEIGHTS = {
  preferenceMatch: 0.3,
  affordability: 0.25,
  distance: 0.2,
  rating: 0.15,
  openAtProposedTime: 0.1,
} as const;

type SignalKey = keyof typeof BASE_WEIGHTS;

const MAX_DISTANCE_METERS = 3000; // beyond this, distance score floors at 0
const PRICE_LEVEL_MAX = 4; // Places API New: 0 (free) .. 4 (very expensive)

// Bayesian prior for the rating signal: shrinks a rating backed by few
// reviews toward a typical Google Places average, so e.g. a 5★/3-review
// place doesn't outrank a 4.6★/500-review place. Only applied when
// `userRatingCount` is present — with no count data we can't judge
// confidence, so we fall back to the raw rating instead of penalizing it.
const RATING_PRIOR_MEAN = 4.0;
const RATING_PRIOR_WEIGHT = 10; // pseudo-review-count given to the prior

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function preferenceMatchScore(
  place: NormalizedPlace,
  profile: UserPreferenceProfile,
): number | undefined {
  if (profile.favoritePlaceIds.length === 0 && profile.interests.length === 0) {
    return undefined;
  }
  if (profile.favoritePlaceIds.includes(place.placeId)) return 1;
  const name = place.name.toLowerCase();
  const matchedInterest = profile.interests.some((interest) =>
    name.includes(interest.toLowerCase()),
  );
  return matchedInterest ? 0.75 : 0.4;
}

function affordabilityScore(
  place: NormalizedPlace,
  profile: UserPreferenceProfile,
): number | undefined {
  if (place.priceLevel === undefined) return undefined;
  if (profile.budget <= 0) return 1 - place.priceLevel / PRICE_LEVEL_MAX;
  return Math.max(0, 1 - place.priceLevel / PRICE_LEVEL_MAX);
}

function distanceScore(place: NormalizedPlace): number | undefined {
  if (place.distanceMeters === undefined) return undefined;
  return Math.max(0, 1 - place.distanceMeters / MAX_DISTANCE_METERS);
}

function ratingScore(place: NormalizedPlace): number | undefined {
  if (place.rating === undefined) return undefined;
  if (place.userRatingCount === undefined) {
    return clamp01(place.rating / 5);
  }
  const weightedRating =
    (RATING_PRIOR_WEIGHT * RATING_PRIOR_MEAN + place.userRatingCount * place.rating) /
    (RATING_PRIOR_WEIGHT + place.userRatingCount);
  return clamp01(weightedRating / 5);
}

function openAtProposedTimeScore(place: NormalizedPlace): number | undefined {
  if (place.openNow === undefined) return undefined;
  return place.openNow ? 1 : 0;
}

/**
 * Scores a single normalized place against the user's preference profile.
 * Deterministic: no LLM involved. Missing fields redistribute their weight
 * across the remaining available signals (CLAUDE.md "Ranking").
 */
export function scorePlace(
  place: NormalizedPlace,
  profile: UserPreferenceProfile,
): Pick<PlaceRecommendation, "score" | "scoreBreakdown" | "missingSignals"> {
  const raw: Partial<Record<SignalKey, number>> = {
    preferenceMatch: preferenceMatchScore(place, profile),
    affordability: affordabilityScore(place, profile),
    distance: distanceScore(place),
    rating: ratingScore(place),
    openAtProposedTime: openAtProposedTimeScore(place),
  };

  const availableKeys = (Object.keys(BASE_WEIGHTS) as SignalKey[]).filter(
    (key) => raw[key] !== undefined,
  );
  const missingSignals = (Object.keys(BASE_WEIGHTS) as SignalKey[]).filter(
    (key) => raw[key] === undefined,
  );

  const availableWeightTotal = availableKeys.reduce(
    (sum, key) => sum + BASE_WEIGHTS[key],
    0,
  );

  const scoreBreakdown: Record<string, number> = {};
  let score = 0;

  if (availableWeightTotal > 0) {
    for (const key of availableKeys) {
      const redistributedWeight = BASE_WEIGHTS[key] / availableWeightTotal;
      const contribution = redistributedWeight * (raw[key] as number);
      scoreBreakdown[key] = Number(contribution.toFixed(4));
      score += contribution;
    }
  }

  return {
    score: Number(score.toFixed(4)),
    scoreBreakdown,
    missingSignals,
  };
}

/** Scores and sorts a list of normalized places, highest score first. */
export function rankPlaces(
  places: NormalizedPlace[],
  profile: UserPreferenceProfile,
): PlaceRecommendation[] {
  return places
    .map((place) => ({ ...place, ...scorePlace(place, profile) }))
    .sort((a, b) => b.score - a.score);
}
