import { describe, expect, it } from "vitest";

import { rankPlaces, scorePlace } from "@/agent/ranking";
import type { NormalizedPlace, UserPreferenceProfile } from "@/agent/schemas";

const profile: UserPreferenceProfile = {
  dietaryRestrictions: [],
  budget: 100,
  transportation: "walking",
  interests: ["coffee"],
  favoritePlaceIds: ["fav-1"],
};

const fullPlace: NormalizedPlace = {
  placeId: "fav-1",
  name: "Favorite Cafe",
  category: "restaurant",
  location: { lat: 0, lng: 0 },
  rating: 5,
  priceLevel: 0,
  openNow: true,
  distanceMeters: 0,
};

describe("scorePlace", () => {
  it("gives a perfect score when every signal is maximally favorable", () => {
    const { score, missingSignals } = scorePlace(fullPlace, profile);
    expect(missingSignals).toEqual([]);
    expect(score).toBeCloseTo(1, 4);
  });

  it("redistributes weight across available signals when a field is missing", () => {
    const partialPlace: NormalizedPlace = { ...fullPlace, rating: undefined, priceLevel: undefined };
    const { score, missingSignals, scoreBreakdown } = scorePlace(partialPlace, profile);
    expect(missingSignals.sort()).toEqual(["affordability", "rating"]);
    // remaining weights (preferenceMatch, distance, openAtProposedTime) sum to 1
    const total = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(score, 4);
    expect(score).toBeGreaterThan(0);
  });

  it("never lets score exceed 1 even when all signals are present", () => {
    const { score } = scorePlace(fullPlace, profile);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("rankPlaces", () => {
  it("sorts highest score first", () => {
    const worse: NormalizedPlace = {
      ...fullPlace,
      placeId: "other",
      name: "Random Diner",
      rating: 1,
      priceLevel: 4,
      openNow: false,
      distanceMeters: 5000,
    };
    const ranked = rankPlaces([worse, fullPlace], profile);
    expect(ranked[0]?.placeId).toBe("fav-1");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});

describe("ratingScore (review-count-aware)", () => {
  it("falls back to the raw rating when userRatingCount is unknown", () => {
    // fullPlace has rating: 5 and no userRatingCount — matches today's
    // behavior exactly, so a perfect score is still achievable.
    const { score, missingSignals } = scorePlace(fullPlace, profile);
    expect(missingSignals).toEqual([]);
    expect(score).toBeCloseTo(1, 4);
  });

  it("shrinks a high rating backed by few reviews toward the prior mean", () => {
    const fewReviews: NormalizedPlace = { ...fullPlace, rating: 5, userRatingCount: 2 };
    const manyReviews: NormalizedPlace = { ...fullPlace, rating: 4.6, userRatingCount: 1000 };

    const fewScore = scorePlace(fewReviews, profile).score;
    const manyScore = scorePlace(manyReviews, profile).score;

    // Without shrinkage, 5.0 > 4.6 would always win on the rating signal
    // alone. With the Bayesian prior, the well-reviewed 4.6★ place should
    // come out ahead once its rating signal is trusted at near-face-value
    // while the 2-review 5★ place gets pulled toward the 4.0 prior.
    expect(manyScore).toBeGreaterThan(fewScore);
  });

  it("treats userRatingCount: 0 as no evidence, pulling the score toward the prior", () => {
    const untested: NormalizedPlace = { ...fullPlace, rating: 5, userRatingCount: 0 };
    const { scoreBreakdown } = scorePlace(untested, profile);
    // rating contribution should be well below the max possible (weight 0.15
    // redistributed among 5 available signals here, i.e. still 0.15 since
    // all signals are present) — 5/5 would give 0.15 exactly.
    expect(scoreBreakdown.rating).toBeLessThan(0.15);
  });
});
