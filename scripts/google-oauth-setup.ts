import "./env";
import { google } from "googleapis";
import { createInterface } from "node:readline/promises";

/**
 * One-time setup to get a Calendar refresh token for GOOGLE_OAUTH_REFRESH_TOKEN.
 * Usage: npm run oauth:google
 * Requires GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 * GOOGLE_OAUTH_REDIRECT_URI already set in .env.local.
 */
async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI in .env.local first " +
        "(redirect URI must also be registered as an authorized redirect URI on the OAuth client in Google Cloud Console).",
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to reissue a refresh_token even if this app was authorized before.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });

  console.log("\n1. Open this URL, sign in with the demo Google account, and approve access:\n");
  console.log(authUrl);
  console.log(
    `\n2. Google will redirect you to ${redirectUri}?code=...&scope=...`,
  );
  console.log(
    "   The page will likely fail to load (nothing is listening there) — that's fine.",
  );
  console.log("   Copy just the `code` value from the browser's address bar.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("Paste the code here: ")).trim();
  rl.close();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.log(
      "\nNo refresh_token was returned. This happens if the account already granted " +
        "access before. Revoke it at https://myaccount.google.com/permissions and run this again.",
    );
    process.exit(1);
  }

  console.log("\nAdd this to .env.local:\n");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
