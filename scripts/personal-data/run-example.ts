/**
 * run-example.ts
 *
 * Standalone example — run with: npm run personal:calendar
 *
 * Separate from the Next.js app itself; this is just for you to test
 * and use the personal-data scripts directly from the command line.
 */

import { listEvents, createEvent, updateEvent } from "./googleCalendarPersonal";
import { getLatestReviews } from "./mapsReviews";
import * as path from "path";

async function main() {
  // --- Calendar: read upcoming events ---
  const events = await listEvents({ maxResults: 10 });
  console.log(`Found ${events.length} upcoming events:`);
  for (const e of events) {
    console.log(`- ${e.summary} (${e.start?.dateTime ?? e.start?.date})`);
  }

  // --- Calendar: create a new event ---
  const created = await createEvent({
    summary: "Test event from agent",
    description: "Created via the Calendar API script",
    start: "2026-09-20T09:00:00-07:00",
    end: "2026-09-20T09:30:00-07:00",
    timeZone: "America/Los_Angeles",
  });
  console.log(`Created event: ${created.id}`);

  // --- Calendar: update that event ---
  if (created.id) {
    await updateEvent(created.id, { summary: "Updated test event" });
    console.log(`Updated event: ${created.id}`);
  }

  // --- Maps: parse the latest Takeout export on disk ---
  // Point this at wherever your Reviews.json currently lives.
  // It's gitignored, so this path is only meaningful on your own machine.
  const { all, newSinceLastRun } = getLatestReviews(
    path.join(process.cwd())
  );
  console.log(`Total reviews in export: ${all.length}`);
  console.log(`New since last check: ${newSinceLastRun.length}`);
}

main().catch(console.error);
