/**
 * mapsReviews.ts
 *
 * IMPORTANT: Google does not expose a live API for a personal account's
 * Maps review history. There is no endpoint your agent can call to
 * fetch "my reviews" on demand from Google's servers directly.
 *
 * The only official path is Google Takeout, which produces a downloadable
 * export (manual, or on a recurring schedule of every 2 months for a year).
 * That export contains a `Reviews.json` file inside the "Maps (your places)"
 * or "Maps" folder.
 *
 * So "fetch on command" here means: re-run/point this at whatever the most
 * recent Takeout export currently sitting on disk is, parse it, and diff it
 * against what your agent already knows about — not a live network call to
 * Google. If you want it *closer* to real-time, set up a scheduled Takeout
 * export and have this function run against the newest downloaded archive
 * whenever your agent needs fresh data.
 */

import * as fs from "fs";
import * as path from "path";

export interface MapsReview {
  placeName: string;
  placeAddress?: string;
  rating?: number;
  reviewText?: string;
  publishedAt?: string; // ISO date, if present in the export
  reviewUrl?: string;
}

interface RawTakeoutReview {
  // Takeout's Reviews.json shape varies slightly over time / locale;
  // this covers the common fields. Adjust field names if your export differs.
  location?: {
    name?: string;
    address?: string;
  };
  reviewRating?: number | string;
  reviewText?: string;
  reviewPublishTime?: string;
  googleMapsUrl?: string;
}

/**
 * Parses a `Reviews.json` file extracted from a Google Takeout export.
 *
 * @param filePath Absolute path to the unzipped Reviews.json
 */
export function parseReviewsFile(filePath: string): MapsReview[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No file found at ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  // Takeout sometimes wraps reviews in a top-level "features" array
  // (GeoJSON-style) and sometimes as a plain array — handle both.
  const entries: RawTakeoutReview[] = Array.isArray(data)
    ? data
    : data.features?.map((f: any) => f.properties ?? f) ?? [];

  return entries.map((entry) => ({
    placeName: entry.location?.name ?? "Unknown place",
    placeAddress: entry.location?.address,
    rating:
      typeof entry.reviewRating === "string"
        ? parseFloat(entry.reviewRating)
        : entry.reviewRating,
    reviewText: entry.reviewText,
    publishedAt: entry.reviewPublishTime,
    reviewUrl: entry.googleMapsUrl,
  }));
}

/**
 * Finds the most recently modified Takeout export folder/zip under a
 * given directory (e.g. your Downloads folder) so you don't have to
 * hardcode a path every time you re-export.
 */
export function findLatestReviewsFile(searchDir: string): string | null {
  const candidates: { file: string; mtime: number }[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "Reviews.json") {
        candidates.push({
          file: fullPath,
          mtime: fs.statSync(fullPath).mtimeMs,
        });
      }
    }
  }

  if (!fs.existsSync(searchDir)) return null;
  walk(searchDir);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]!.file;
}

/**
 * Convenience "fetch on command" entry point: looks for the newest
 * Reviews.json under `searchDir`, parses it, and optionally diffs it
 * against a previously seen set (by placeName + publishedAt) so you
 * only get what's new since last time your agent checked.
 */
export function getLatestReviews(
  searchDir: string,
  previouslySeen: Set<string> = new Set()
): { all: MapsReview[]; newSinceLastRun: MapsReview[] } {
  const filePath = findLatestReviewsFile(searchDir);
  if (!filePath) {
    throw new Error(
      `No Reviews.json found under ${searchDir}. Run a Google Takeout export for Maps data first.`
    );
  }

  const all = parseReviewsFile(filePath);
  const key = (r: MapsReview) => `${r.placeName}|${r.publishedAt ?? ""}`;

  const newSinceLastRun = all.filter((r) => !previouslySeen.has(key(r)));

  return { all, newSinceLastRun };
}
