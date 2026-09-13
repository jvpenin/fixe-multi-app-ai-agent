import { NextResponse } from "next/server";
import { z } from "zod";
import { placeDetails } from "@/integrations/google-maps";
import type { NormalizedPlace } from "@/agent/schemas";
import fixture from "@/fixtures/api-responses/places.json";
const RequestSchema = z.object({
  placeIds: z.array(z.string().min(1)).min(3).max(5),
  demoMode: z.boolean(),
});
export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Select 3–5 favorite places." },
      { status: 400 },
    );
  const data = parsed.data;
  const responses = data.demoMode
    ? []
    : await Promise.allSettled(
        data.placeIds.map((id) => placeDetails(id, AbortSignal.timeout(8000))),
      );
  const places: NormalizedPlace[] = data.demoMode
    ? (fixture as NormalizedPlace[])
    : responses.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!places.length)
    return NextResponse.json(
      {
        error:
          "Could not learn from these places. Your selected interests will still be used.",
      },
      { status: 503 },
    );
  const preferences = new Set<string>();
  for (const place of places) {
    if (place.category === "restaurant") preferences.add("Casual restaurants");
    if (place.category === "grocery") preferences.add("Grocery stores");
    if (place.priceLevel !== undefined && place.priceLevel <= 1)
      preferences.add("Affordable places");
    if (/coffee|café|cafe|bakery/i.test(place.name))
      preferences.add("Coffee & bakeries");
  }
  return NextResponse.json({
    preferences: [...preferences],
    sample: data.demoMode,
    partial: responses.some((r) => r.status === "rejected"),
  });
}
