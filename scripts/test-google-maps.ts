import "./env";
import { textSearch, placeDetails, autocomplete } from "../src/integrations/google-maps";

/**
 * Manual check for the Places API (New) adapter — no server needed.
 * Usage: npm run check:maps -- "coffee near Fenway, Boston"
 */
async function main() {
  const query = process.argv[2] ?? "grocery store near Fenway, Boston";

  console.log(`\n--- textSearch("${query}") ---`);
  const results = await textSearch(query);
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n${results.length} place(s) found.`);

  if (results[0]) {
    console.log(`\n--- placeDetails("${results[0].placeId}") ---`);
    console.log(JSON.stringify(await placeDetails(results[0].placeId), null, 2));
  }

  console.log(`\n--- autocomplete("trader joe") ---`);
  console.log(JSON.stringify(await autocomplete("trader joe"), null, 2));
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
