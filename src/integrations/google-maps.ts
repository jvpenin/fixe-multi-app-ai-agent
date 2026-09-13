import { addressFromGoogle, type AddressComponent } from "@/agent/address";
import { NormalizedPlaceSchema, type NormalizedPlace, type PlaceCategory } from "@/agent/schemas";

/**
 * Places API (New) adapter. Docs:
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 * https://developers.google.com/maps/documentation/places/web-service/nearby-search
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * Every function here does ONE thing: call the API and normalize the
 * response into `NormalizedPlace`. No ranking, no retry, no trace — the
 * orchestrator wraps calls with `withRetry`/`traced` (see src/reliability).
 */

const PLACES_BASE_URL = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.primaryType",
  "places.types",
].join(",");

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

// Google's PRICE_LEVEL_* enum, in ascending order, matching Places API (New).
const PRICE_LEVELS = [
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE",
] as const;

function priceLevelToNumber(level: string | undefined): number | undefined {
  if (!level) return undefined;
  const index = PRICE_LEVELS.indexOf(level as (typeof PRICE_LEVELS)[number]);
  return index === -1 ? undefined : index;
}

function inferCategory(types: string[] | undefined, primaryType: string | undefined): PlaceCategory {
  const all = [primaryType, ...(types ?? [])].filter(Boolean) as string[];
  if (all.some((t) => t === "restaurant" || t === "cafe" || t === "meal_takeaway" || t === "bakery")) {
    return "restaurant";
  }
  if (all.some((t) => t === "grocery_store" || t === "supermarket" || t === "convenience_store")) {
    return "grocery";
  }
  return "other";
}

// Raw shape we read off the Places API (New) JSON response. Deliberately
// loose (fields are optional) — Google's response shape is only as
// trustworthy as the field mask we requested, so we defend with optional
// chaining and validate the NORMALIZED output with zod, not this raw shape.
type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
  types?: string[];
};

function normalize(raw: RawPlace): NormalizedPlace {
  const place = {
    placeId: raw.id,
    name: raw.displayName?.text ?? "Unknown place",
    category: inferCategory(raw.types, raw.primaryType),
    address: raw.formattedAddress,
    addressFields: raw.addressComponents ? addressFromGoogle(raw.addressComponents) : undefined,
    location: {
      lat: raw.location?.latitude ?? 0,
      lng: raw.location?.longitude ?? 0,
    },
    rating: raw.rating,
    priceLevel: priceLevelToNumber(raw.priceLevel),
    openNow: raw.currentOpeningHours?.openNow,
  };
  return NormalizedPlaceSchema.parse(place);
}

async function postSearch(
  path: "searchText" | "searchNearby",
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RawPlace[]> {
  const response = await fetch(`${PLACES_BASE_URL}/places:${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new Error(`places:${path} failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { places?: RawPlace[] };
  return data.places ?? [];
}

export async function textSearch(
  query: string,
  center?: { lat: number; lng: number },
  radiusMeters = 2000,
  signal?: AbortSignal,
): Promise<NormalizedPlace[]> {
  // TODO(maps): once geocoding is wired in, always pass `center` so
  // `distanceMeters` can be computed (see orchestrator.ts) — the distance
  // ranking signal is skipped (weight redistributed) without it.
  const raw = await postSearch(
    "searchText",
    {
      textQuery: query,
      maxResultCount: 20,
      ...(center
        ? {
            locationBias: {
              circle: {
                center: { latitude: center.lat, longitude: center.lng },
                radius: radiusMeters,
              },
            },
          }
        : {}),
    },
    signal,
  );
  return raw.map(normalize);
}

/** Haversine distance in meters — used to fill `distanceMeters` once a
 * reference center point (e.g. from geocoding the user's address) is known. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function nearbySearch(
  includedTypes: string[],
  center: { lat: number; lng: number },
  radiusMeters = 2000,
  signal?: AbortSignal,
): Promise<NormalizedPlace[]> {
  const raw = await postSearch(
    "searchNearby",
    {
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: radiusMeters,
        },
      },
    },
    signal,
  );
  return raw.map(normalize);
}

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "rating",
  "priceLevel",
  "currentOpeningHours.openNow",
  "primaryType",
  "types",
].join(",");

export async function placeDetails(
  placeId: string,
  signal?: AbortSignal,
): Promise<NormalizedPlace> {
  const response = await fetch(`${PLACES_BASE_URL}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`place details failed: ${response.status} ${await response.text()}`);
  }
  const raw = (await response.json()) as RawPlace;
  return normalize(raw);
}

/**
 * Autocomplete for the onboarding "pick 3-5 favorite places" flow (see
 * CLAUDE.md "Important Google Maps limitation" — this is a consent-based
 * input, NOT a read of the user's private Google Maps history).
 */
export async function autocomplete(
  input: string,
  signal?: AbortSignal,
): Promise<{ placeId: string; text: string }[]> {
  const response = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
    },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`places:autocomplete failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as {
    suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text?: { text?: string } } => !!p?.placeId)
    .map((p) => ({ placeId: p.placeId, text: p.text?.text ?? "" }));
}
