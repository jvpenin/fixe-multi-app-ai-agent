/**
 * googleCalendarPersonal.ts
 *
 * NOTE: this is a separate, personal-use script — distinct from
 * src/integrations/google-calendar.ts, which is the production
 * integration used by the orchestrator (env-var based, no local
 * credential files, wired into retry/idempotency). This one is for
 * ad-hoc personal use: a local OAuth flow with credentials.json/
 * token.json sitting in the project root. Keep the two separate until
 * you decide how (or whether) to fold this into the real integration.
 *
 * Minimal wrapper around the Google Calendar API v3 for reading and
 * writing events. Uses OAuth2 (installed-app flow) so it can act on
 * behalf of a real user's calendar.
 *
 * Setup:
 *   1. In Google Cloud Console, create a project and enable the
 *      "Google Calendar API".
 *   2. Create OAuth 2.0 credentials of type "Desktop app" and download
 *      the JSON as `credentials.json` in the project root.
 *   3. npm install googleapis
 *   4. Run once with no token.json present -> it opens your browser,
 *      you approve access, and a tiny local server automatically
 *      catches the redirect and saves token.json for future runs.
 *      (No copy-pasting a code by hand.)
 */

import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { URL } from "url";

// Scopes: events = create/read/update/delete events (not calendar settings)
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

export interface SimpleEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO 8601, e.g. "2026-09-20T09:00:00-07:00"
  end: string; // ISO 8601
  timeZone?: string; // e.g. "America/Los_Angeles"
}

/** Loads (or creates) an authorized OAuth2 client. */
export async function getAuthClient(): Promise<OAuth2Client> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing ${CREDENTIALS_PATH}. Download OAuth client credentials from Google Cloud Console first.`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_secret, client_id } = credentials.installed ?? credentials.web;

  // We ignore the redirect_uris in credentials.json and instead spin up a
  // local server on an available port. Google's OAuth server allows any
  // port on http://localhost for "Desktop app" clients (the loopback
  // exception for installed apps), so this works without editing anything
  // in Cloud Console.
  const { server, port, codePromise } = await startLoopbackServer();
  const redirectUri = `http://localhost:${port}`;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  if (fs.existsSync(TOKEN_PATH)) {
    server.close();
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  return authorizeNewToken(oAuth2Client, server, codePromise);
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
      const url = new URL(req.url ?? "/", `http://localhost`);
      const code = url.searchParams.get("code");

      res.setHeader("Content-Type", "text/html");
      if (code) {
        res.end("<h2>Authorized. You can close this tab and return to the terminal.</h2>");
        resolveCode(code);
      } else {
        res.end("<h2>No authorization code found in the request.</h2>");
      }
    });

    // Port 0 = let the OS pick a free port.
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveServer({ server, port, codePromise });
    });
  });
}

/** Opens the default browser to the given URL, cross-platform, best-effort. */
async function tryOpenBrowser(url: string): Promise<void> {
  const { exec } = await import("child_process");
  const platform = process.platform;
  const command =
    platform === "darwin" ? `open "${url}"` :
    platform === "win32" ? `start "" "${url}"` :
    `xdg-open "${url}"`;

  exec(command, (err) => {
    if (err) {
      // Not fatal — the URL is already printed above for manual opening.
    }
  });
}

/** First-run flow: opens the consent URL and waits for the local server to catch the redirect. */
async function authorizeNewToken(
  oAuth2Client: OAuth2Client,
  server: http.Server,
  codePromise: Promise<string>
): Promise<OAuth2Client> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Open this URL to authorize (or it may open automatically):\n", authUrl);
  await tryOpenBrowser(authUrl);

  const code = await codePromise;
  server.close();

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Token saved to ${TOKEN_PATH}`);

  return oAuth2Client;
}

function getCalendarClient(auth: OAuth2Client): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth });
}

/**
 * Reads events from a calendar within a time window.
 * Defaults to the primary calendar and the next 30 days.
 */
export async function listEvents(options?: {
  calendarId?: string;
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}): Promise<calendar_v3.Schema$Event[]> {
  const auth = await getAuthClient();
  const calendar = getCalendarClient(auth);

  const timeMin = options?.timeMin ?? new Date();
  const timeMax =
    options?.timeMax ?? new Date(timeMin.getTime() + 30 * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: options?.calendarId ?? "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: options?.maxResults ?? 250,
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items ?? [];
}

/** Creates a new event on the given calendar (defaults to primary). */
export async function createEvent(
  event: SimpleEvent,
  calendarId: string = "primary"
): Promise<calendar_v3.Schema$Event> {
  const auth = await getAuthClient();
  const calendar = getCalendarClient(auth);

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start, timeZone: event.timeZone },
      end: { dateTime: event.end, timeZone: event.timeZone },
    },
  });

  return res.data;
}

/**
 * Updates an existing event by ID. Only the fields you pass are changed
 * (uses `patch`, so omitted fields are left as-is).
 */
export async function updateEvent(
  eventId: string,
  changes: Partial<SimpleEvent>,
  calendarId: string = "primary"
): Promise<calendar_v3.Schema$Event> {
  const auth = await getAuthClient();
  const calendar = getCalendarClient(auth);

  const requestBody: calendar_v3.Schema$Event = {};
  if (changes.summary !== undefined) requestBody.summary = changes.summary;
  if (changes.description !== undefined)
    requestBody.description = changes.description;
  if (changes.location !== undefined) requestBody.location = changes.location;
  if (changes.start !== undefined)
    requestBody.start = { dateTime: changes.start, timeZone: changes.timeZone };
  if (changes.end !== undefined)
    requestBody.end = { dateTime: changes.end, timeZone: changes.timeZone };

  const res = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody,
  });

  return res.data;
}

/** Deletes an event by ID. */
export async function deleteEvent(
  eventId: string,
  calendarId: string = "primary"
): Promise<void> {
  const auth = await getAuthClient();
  const calendar = getCalendarClient(auth);

  await calendar.events.delete({ calendarId, eventId });
}
