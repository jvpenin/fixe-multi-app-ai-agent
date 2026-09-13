/**
 * fetch-essentials.ts
 *
 * Standalone script — run with:
 *   npx tsx scripts/fetch-essentials.ts --address "Rua XV de Novembro, Curitiba"
 *   npx tsx scripts/fetch-essentials.ts --lat -25.4284 --lng -49.2733
 *   npx tsx scripts/fetch-essentials.ts --address "..." --radius 1500
 *   npx tsx scripts/fetch-essentials.ts --address "..." --budget 50 --interests coffee,vegan
 *
 * Fetches nearby places, scores each with the same deterministic fit-score
 * engine used by the app (src/agent/ranking.ts — CLAUDE.md "Ranking"), and
 * prints a presentable, sorted report per category instead of a raw dump.
 *
 * Loads GOOGLE_MAPS_API_KEY from .env.local (if present) or .env
 * automatically (Node 20.12+ / 21.7+ native env file loading — no dotenv
 * package needed).
 */

import { existsSync } from "node:fs";

try {
  process.loadEnvFile?.(existsSync(".env.local") ? ".env.local" : ".env");
} catch {
  // Neither file exists or is readable — fall through and let the
  // GOOGLE_MAPS_API_KEY check below give a clear error instead.
}

import { fetchNearbyEssentials, distanceMeters } from "../src/integrations/google-maps";
import { rankPlaces } from "../src/agent/ranking";
import type { NormalizedPlace, PlaceRecommendation, UserPreferenceProfile } from "../src/agent/schemas";

/** Geocoding API: turns a free-text address into { lat, lng }. Not part of
 * src/integrations/google-maps.ts yet — kept local to this script until
 * there's a second caller that needs it. */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set (check .env)");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    status: string;
    error_message?: string;
    results: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[];
  };

  const result = data.results[0];
  if (data.status !== "OK" || !result) {
    const reason = data.error_message ? ` — ${data.error_message}` : "";
    throw new Error(`No geocoding result for "${address}" (status: ${data.status})${reason}`);
  }

  const { location } = result.geometry;
  console.log(`Geocoded "${address}" -> ${result.formatted_address} (${location.lat}, ${location.lng})`);
  return { lat: location.lat, lng: location.lng };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };

  const address = get("--address");
  const lat = get("--lat");
  const lng = get("--lng");
  const radius = get("--radius");
  const budget = get("--budget");
  const interests = get("--interests");

  return {
    address,
    lat: lat ? parseFloat(lat) : undefined,
    lng: lng ? parseFloat(lng) : undefined,
    radiusMeters: radius ? parseInt(radius, 10) : 2000,
    budget: budget ? parseFloat(budget) : 0,
    interests: interests ? interests.split(",").map((s) => s.trim()) : [],
  };
}

/** Attaches straight-line distance from `origin` to each place, so the
 * ranking engine's distance signal isn't skipped for lack of the field. */
function withDistance<T extends NormalizedPlace>(places: T[], origin: { lat: number; lng: number }): T[] {
  return places.map((place) => ({ ...place, distanceMeters: distanceMeters(origin, place.location) }));
}

function formatFit(score: number): string {
  const pct = Math.round(score * 100);
  const filled = Math.round(score * 10);
  const bar = "#".repeat(filled) + "-".repeat(10 - filled);
  return `[${bar}] ${pct}%`;
}

function printRecommendation(place: PlaceRecommendation) {
  const rating =
    place.rating !== undefined
      ? `${place.rating}★${place.userRatingCount !== undefined ? ` (${place.userRatingCount})` : ""}`
      : "no rating";
  const price = place.priceLevel !== undefined ? "$".repeat(place.priceLevel + 1) : "?";
  const distance = place.distanceMeters !== undefined ? `${Math.round(place.distanceMeters)}m` : "distance unknown";
  const transit =
    place.transitDurationMinutes !== undefined ? `, ${place.transitDurationMinutes} min transit` : "";

  console.log(`  ${formatFit(place.score)}  ${place.name}`);
  console.log(`      ${rating} · ${price} · ${distance}${transit} — ${place.address ?? ""}`);
  if (place.missingSignals.length > 0) {
    console.log(`      (missing: ${place.missingSignals.join(", ")} — weight redistributed)`);
  }
}

function printSection(title: string, places: NormalizedPlace[], profile: UserPreferenceProfile) {
  const ranked = rankPlaces(places, profile);
  console.log(`\n${title} (${ranked.length}):`);
  ranked.forEach(printRecommendation);
}

async function main() {
  const { address, lat, lng, radiusMeters, budget, interests } = parseArgs();

  let origin: { lat: number; lng: number };
  if (address) {
    origin = await geocodeAddress(address);
  } else if (lat !== undefined && lng !== undefined) {
    origin = { lat, lng };
  } else {
    console.error(
      'Usage:\n  npx tsx scripts/fetch-essentials.ts --address "some address"\n  npx tsx scripts/fetch-essentials.ts --lat -25.4284 --lng -49.2733\nOptional: --radius <meters> (default 2000), --budget <number>, --interests coffee,vegan',
    );
    process.exit(1);
  }

  const profile: UserPreferenceProfile = {
    dietaryRestrictions: [],
    budget,
    transportation: "walking",
    interests,
    favoritePlaceIds: [],
  };

  const { restaurants, groceries, pharmacies, parks } = await fetchNearbyEssentials(origin, radiusMeters);

  printSection("Restaurants", withDistance(restaurants, origin), profile);
  printSection("Groceries", withDistance(groceries, origin), profile);
  printSection("Pharmacies", withDistance(pharmacies, origin), profile);
  printSection("Parks", withDistance(parks, origin), profile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
