import "./env";
import { listEvents, createEvent, hasConflict } from "../src/integrations/google-calendar";

/**
 * Manual check for the Calendar adapter — no server needed. Requires
 * GOOGLE_OAUTH_REFRESH_TOKEN (see `npm run oauth:google`).
 * Usage:
 *   npm run check:calendar            -- lists events in the next 72h
 *   npm run check:calendar -- --write -- also creates a real test event
 */
async function main() {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  console.log(`\n--- listEvents(${now.toISOString()} .. ${in72h.toISOString()}) ---`);
  const events = await listEvents(now.toISOString(), in72h.toISOString());
  console.log(JSON.stringify(events, null, 2));
  console.log(`\n${events.length} event(s) found.`);

  if (!process.argv.includes("--write")) {
    console.log("\n(run with --write to also create a real test event on your calendar)");
    return;
  }

  const start = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  console.log(`\n--- conflict check for ${start} .. ${end} ---`);
  console.log("conflicts with an existing event:", hasConflict(start, end, events));

  console.log("\n--- createEvent (test) ---");
  const created = await createEvent({
    summary: "[Landing test] delete me",
    start,
    end,
    operationId: `manual-test-${Date.now()}`,
  });
  console.log(JSON.stringify(created, null, 2));
  console.log("\nCreated on your primary calendar — delete it manually when done checking.");
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
