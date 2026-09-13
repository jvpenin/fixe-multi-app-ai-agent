import { NextResponse } from "next/server";
import { listEvents } from "@/integrations/google-calendar";
import { autocomplete } from "@/integrations/google-maps";
import { search } from "@/integrations/zinc";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const integration = body?.integration;
  if (!["google-maps", "google-calendar", "zinc"].includes(integration))
    return NextResponse.json({ error: "Unknown integration" }, { status: 400 });
  try {
    if (integration === "google-maps")
      await autocomplete("San Francisco", AbortSignal.timeout(8000));
    if (integration === "google-calendar")
      await listEvents(
        new Date().toISOString(),
        new Date(Date.now() + 86400000).toISOString(),
      );
    if (integration === "zinc") {
      if (!process.env.ZINC_API_KEY?.startsWith("zn_test_"))
        throw new Error("Sandbox credentials required");
      await search("soap");
    }
    return NextResponse.json({ status: "connected" });
  } catch {
    return NextResponse.json(
      {
        error:
          integration === "google-calendar"
            ? "Google Calendar is not connected. Run npm run oauth:google on the server, then retry."
            : "Connection could not be verified. Check the server credentials, then retry.",
      },
      { status: 503 },
    );
  }
}
