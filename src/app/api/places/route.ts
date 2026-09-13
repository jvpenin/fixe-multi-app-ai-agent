import { NextResponse } from "next/server";
import { autocomplete, placeDetails } from "@/integrations/google-maps";
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const id = url.searchParams.get("id");
    if (id)
      return NextResponse.json(
        await placeDetails(id, AbortSignal.timeout(8000)),
      );
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 3 || query.length > 250) return NextResponse.json([]);
    return NextResponse.json(
      await autocomplete(query, AbortSignal.timeout(8000)),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Places is unavailable. Check the server Google Maps credentials or use the sample landing.",
      },
      { status: 503 },
    );
  }
}
