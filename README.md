# Landing — backend setup

AI relocation agent for the first 72 hours in a new city. See [CLAUDE.md](CLAUDE.md)
for the full product/architecture spec. This README covers backend setup only
— the frontend (4-screen flow) comes later.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys as they become available
npm run dev                  # http://localhost:3000
```

With no keys set, `DEMO_MODE=true` (the `.env.example` default) makes both
endpoints work end-to-end against the fixtures in `src/fixtures/`.

```bash
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"destination":"Boston, MA","approximateAddress":"Fenway, Boston, MA","arrivalAt":"2026-09-15T18:00:00.000Z","budget":150,"demoMode":true}'
```

Take the `planId` and `proposedActions[].actionId` values from that response
into `/api/execute`:

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"planId":"<planId>","approvedActionIds":["<actionId>", "..."]}'
```

## Project layout

```text
src/
  app/api/plan/route.ts       POST /api/plan    — no external writes
  app/api/execute/route.ts    POST /api/execute — approval-gated writes
  agent/
    schemas.ts                 zod schemas + types for every contract
    ranking.ts                 deterministic place scoring
    orchestrator.ts            ties integrations + ranking into a LandingPlan
  integrations/
    google-maps.ts             Places API (New): text/nearby search, details
    google-calendar.ts         OAuth2 + events.list/insert
    zinc.ts                    v2 API: product search, sandbox orders
  reliability/
    trace.ts                   per-request tool call trace
    retry.ts                   timeout + 1 retry with backoff
    idempotency.ts             in-memory operationId -> ActionResult store
  fixtures/
    demo-profile.json          sample PlanRequest for demo mode
    api-responses/             normalized fixture data (demo fallback only)
```

## Filling in credentials

Each integration reads its own env vars (see `.env.example`) and throws a
clear error if they're missing — nothing else needs to change to go from
demo mode to live:

- **Google Maps / Calendar dev**: fill `GOOGLE_MAPS_API_KEY` and the
  `GOOGLE_OAUTH_*` vars, set `DEMO_MODE=false`, and call `/api/plan`. Places
  results have no `distanceMeters` yet (no geocoding step wired in — see the
  `TODO(maps)` in `google-maps.ts`).
- **Zinc dev**: fill `ZINC_API_KEY` with a `zn_test_...` sandbox key. Use the
  documented sandbox product URLs in `zinc.ts` (`test-success`,
  `test-out-of-stock`, `test-price-exceeded`) while testing order creation —
  see the `TODO(zinc)` in `orchestrator.ts` about mapping real search
  results to orderable product URLs.

## Testing, in three layers

**1. Unit tests (no credentials, no network)**

```bash
npm test
```

Covers ranking (weight redistribution when signals are missing), retry
(timeout + single retry), idempotency (no duplicate writes on a repeated
call), and a full demo-mode plan → execute round trip.

**2. Each integration in isolation** — once you have that integration's env
vars in `.env.local`, call its adapter directly, no server needed:

```bash
npm run check:maps -- "grocery store near Fenway, Boston"
npm run check:calendar                 # lists events in the next 72h
npm run check:calendar -- --write      # also creates a real test event
npm run check:zinc -- "paper towels"
npm run check:zinc -- --order          # places a sandbox order (test-success)
npm run check:zinc -- --order --fail   # sandbox order that goes out-of-stock
```

Calendar needs a refresh token first — `GOOGLE_OAUTH_REFRESH_TOKEN` isn't
something you type in by hand, it comes from a one-time consent flow:

```bash
npm run oauth:google
```

It prints a Google consent URL, you approve access, paste back the `code`
from the redirected (broken, that's expected) URL, and it prints the
refresh token to add to `.env.local`.

**3. Full MVP against the three live APIs**

```bash
# .env.local: all three integrations' keys set, DEMO_MODE=false
npm run dev
curl -X POST http://localhost:3000/api/plan -H "Content-Type: application/json" -d '{
  "destination":"Boston, MA",
  "approximateAddress":"Fenway, Boston, MA",
  "arrivalAt":"2026-09-15T18:00:00.000Z",
  "budget":150
}'
# then /api/execute with the returned planId + actionIds, as in Setup above
```

Check the response's `warnings` and `trace` — a live run with all three
integrations reachable should have an empty `warnings` array and one `trace`
entry per external call. Walk through the eight reliability scenarios in
CLAUDE.md manually against this (budget exceeded, calendar conflict, closed
place, no Places results, double `/api/execute` call, Zinc out-of-stock via
`check:zinc -- --order --fail`, Calendar/Maps errors by temporarily using a
bad key).

## Status

Backend scaffold: schemas, ranking, orchestrator, reliability utilities, and
all three integration adapters are implemented and typecheck/build/test
clean in demo mode. Live-credential paths are untested pending real API
keys. Frontend not started.
