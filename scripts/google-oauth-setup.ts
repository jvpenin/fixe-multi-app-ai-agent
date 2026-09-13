import "./env";
import { google } from "googleapis";
import * as http from "node:http";
import { URL } from "node:url";
import { exec } from "node:child_process";

/**
 * One-time setup to get a Calendar refresh token for GOOGLE_OAUTH_REFRESH_TOKEN.
 * Usage: npm run oauth:google
 * Requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET already set
 * in .env. The OAuth client must be of type "Desktop app" in
 * Google Cloud Console — that grants the loopback redirect exception this
 * script relies on (any http://localhost:<port> is accepted without
 * pre-registering a specific redirect URI).
 *
 * This opens your browser, waits for you to approve access, and catches the
 * redirect automatically with a temporary local server — no copy-pasting a
 * code by hand (same technique as scripts/personal-data/googleCalendarPersonal.ts).
 */
async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first " +
        '(Google Cloud Console -> Credentials -> Create Credentials -> OAuth client ID -> type "Desktop app").',
    );
  }

  const { server, port, codePromise } = await startLoopbackServer();
  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to reissue a refresh_token even if this app was authorized before.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });

  console.log("\nOpening this URL — sign in with the demo Google account and approve access:\n");
  console.log(authUrl);
  console.log("\n(If it doesn't open automatically, copy the URL above into a browser.)\n");
  await tryOpenBrowser(authUrl);

  const code = await codePromise;
  server.close();

  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });

  if (!tokens.refresh_token) {
    console.log(
      "\nNo refresh_token was returned. This happens if the account already granted " +
        "access before. Revoke it at https://myaccount.google.com/permissions and run this again.",
    );
    process.exit(1);
  }

  console.log("\nAdd this to .env:\n");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
}

/** Starts a temporary local HTTP server to catch Google's OAuth redirect. */
function startLoopbackServer(): Promise<{
  server: http.Server;
  port: number;
  codePromise: Promise<string>;
}> {
  return new Promise((resolveServer) => {
    let resolveCode: (code: string) => void;
    const codePromise = new Promise<string>((resolve) => {
      resolveCode = resolve;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.setHeader("Content-Type", "text/html");
      if (code) {
        res.end("<h2>Authorized. You can close this tab and return to the terminal.</h2>");
        resolveCode(code);
      } else {
        res.end(`<h2>Authorization failed${error ? `: ${error}` : ""}.</h2>`);
      }
    });

    // Port 0 = let the OS pick a free port (avoids clashing with `npm run dev` on 3000).
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveServer({ server, port, codePromise });
    });
  });
}

/** Opens the default browser to the given URL, cross-platform, best-effort. */
async function tryOpenBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "darwin" ? `open "${url}"` : platform === "win32" ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {
    // Not fatal — the URL is already printed above for manual opening.
  });
}

main().catch((error) => {
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
