```markdown
# Landing — your first 72 hours, handled

AI relocation agent for students and young professionals arriving in a new
city. It reads your schedule, understands your budget and preferences,
searches your new neighborhood, builds a starter essentials cart, and
executes the approved plan across three external apps. See
[CLAUDE.md](CLAUDE.md) for the full product/architecture spec.

## What we built

Landing turns "I just moved somewhere new" into a handled checklist instead
of an open-ended research project. The agent reads your Google Calendar for
arrival and existing commitments, ranks nearby restaurants and grocery
stores from Google Places, and finds/prices arrival essentials through
Zinc's sandbox — then, only after explicit approval, writes the plan back
as real Calendar events and a sandboxed Zinc order.

Built by a Minerva University team who does this move — a new country, a
new city — several times over the course of the degree. This isn't a
recommendation engine; it's the tool we wanted the last time we landed
somewhere new.

## External integrations

- **Google Maps Platform** — Places API (New) for text/nearby search and
  place details; used to recommend restaurants and grocery stores near the
  destination, filtered and ranked deterministically.
- **Google Calendar** — reads events in the arrival window to detect free
  time and conflicts; creates the approved itinerary events, preserving the
  returned event IDs.
- **Zinc** — searches basic arrival essentials and creates orders only in
  the Zinc sandbox, including exercising out-of-stock and price-exceeded
  failure paths without spending real money.

## Setup

\`\`\`bash
npm install
cp .env.example .env.local   # fill in keys as they become available
npm run dev                  # http://localhost:3000
\`\`\`

With no keys set, `DEMO_MODE=true` (the `.env.example` default) makes both
endpoints work end-to-end against the fixtures in `src/fixtures/`.

\`\`\`bash
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"destination":"Boston, MA","approximateAddress":"Fenway, Boston, MA","arrivalAt":"2026-09-15T18:00:00.000Z","budget":150,"demoMode":true}'
\`\`\`

Take the `planId` and `proposedActions[].actionId` values from that response
into `/api/execute`:

\`\`\`bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"planId":"<planId>","approvedActionIds":["<actionId>", "..."]}'
\`\`\`

## Project layout

\`\`\`text
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
\`\`\`

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

**1. Automated unit/integration tests (no credentials, no network)**

\`\`\`bash
npm test
\`\`\`

Runs on [Vitest](https://vitest.dev) (a Jest-compatible test runner/API —
`describe`/`it`/`expect`), currently **10 test files, 39 tests: 38 passing,
1 skipped**. The one skip is `zinc.live.test.ts`'s live-sandbox case, which
only runs when a real `ZINC_API_KEY` is present (see layer 2 below).

| File | What it proves |
|---|---|
| `src/agent/ranking.test.ts` | Deterministic scoring; weight is redistributed across preference/price/distance/rating/hours when a signal is missing, and the redistribution is recorded in the trace. |
| `src/agent/orchestrator.test.ts` | Full plan/execute orchestration: budget enforcement, calendar-conflict detection, partial results when an integration fails, and the demo-mode plan → approve → execute round trip. |
| `src/agent/orchestrator.zinc-failure.test.ts` | Zinc out-of-stock / price-exceeded is surfaced as a failed `ActionResult`, never reported as success. |
| `src/agent/address.test.ts`, `destination.test.ts` | Address/place-ID resolution and destination parsing edge cases. |
| `src/reliability/retry.test.ts` | Timeout + exactly one automatic retry with backoff per external call. |
| `src/reliability/idempotency.test.ts` | Repeated `/api/execute` calls with the same `operationId` return the original `ActionResult` instead of writing twice. |
| `src/integrations/zinc.fixtures.test.ts` | Zinc adapter against recorded fixtures (search + sandbox order shapes). |
| `src/integrations/zinc.live.test.ts` | Same adapter against the real Zinc sandbox when `ZINC_API_KEY` is set (skipped otherwise, never faked). |
| `scripts/google-maps.test.ts` | Places API (New) response normalization. |

CI-equivalent checks, all clean on this build:

\`\`\`bash
npm test        # 38 passed, 1 skipped
npm run typecheck
npm run lint
npm run build
\`\`\`

**2. Each integration in isolation** — once you have that integration's env
vars in `.env.local`, call its adapter directly, no server needed:

\`\`\`bash
npm run check:maps -- "grocery store near Fenway, Boston"
npm run check:calendar                 # lists events in the next 72h
npm run check:calendar -- --write      # also creates a real test event
npm run check:zinc -- "paper towels"
npm run check:zinc -- --order          # places a sandbox order (test-success)
npm run check:zinc -- --order --fail   # sandbox order that goes out-of-stock
\`\`\`

Calendar needs a refresh token first — `GOOGLE_OAUTH_REFRESH_TOKEN` isn't
something you type in by hand, it comes from a one-time consent flow:

\`\`\`bash
npm run oauth:google
\`\`\`

It prints a Google consent URL, you approve access, paste back the `code`
from the redirected (broken, that's expected) URL, and it prints the
refresh token to add to `.env.local`.

**3. Full MVP against the three live APIs**

\`\`\`bash
# .env.local: all three integrations' keys set, DEMO_MODE=false
npm run dev
curl -X POST http://localhost:3000/api/plan -H "Content-Type: application/json" -d '{
  "destination":"Boston, MA",
  "approximateAddress":"Fenway, Boston, MA",
  "arrivalAt":"2026-09-15T18:00:00.000Z",
  "budget":150
}'
# then /api/execute with the returned planId + actionIds, as in Setup above
\`\`\`

Check the response's `warnings` and `trace` — a live run with all three
integrations reachable should have an empty `warnings` array and one `trace`
entry per external call.

## How reliability was tested

Reliability was verified at two levels: an automated Vitest suite that runs
on every change with no credentials or network calls, and manual runs
against the **real Google Maps/Calendar APIs and the real Zinc sandbox**
(never production Zinc, never real money) for the scenarios that require a
live external response.

- **Google Calendar sandbox**: a real Google account connected via OAuth
  (`npm run oauth:google`, minimum `calendar.events` scope, refresh token
  kept only in `.env.local`, never committed or logged). `check:calendar`
  reads real events and, with `--write`, creates a real test event to
  confirm the returned event ID round-trips.
- **Zinc sandbox**: a `zn_test_...` sandbox key against Zinc's documented
  sandbox product URLs (`test-success`, `test-out-of-stock`,
  `test-price-exceeded`). No real product is ever ordered and no payment
  credential is used. `check:zinc -- --order --fail` deliberately drives the
  out-of-stock path to confirm it comes back as a failed, non-retryable
  `ActionResult` rather than a false success.
- **Google Places (New)**: live text/nearby search and place details via
  `check:maps`, normalized by the same adapter the app uses, so ranking
  test data matches what the live API actually returns.

| # | Scenario | Covered by | Result |
|---|---|---|---|
| 1 | Happy path (all 3 integrations) | `orchestrator.test.ts` (demo) + manual live run (Setup §3) | Pass |
| 2 | Total exceeds budget | `orchestrator.test.ts` budget-enforcement cases | Pass |
| 3 | Proposed activity conflicts with Calendar | `orchestrator.test.ts` conflict case + `check:calendar` against real events | Pass |
| 4 | Recommended place closed at proposed time | `ranking.test.ts` open-at-time weighting | Pass |
| 5 | Places returns no result in initial radius | `orchestrator.test.ts` partial-result case | Pass |
| 6 | `/api/execute` called twice with the same action | `idempotency.test.ts` + manual double-`curl` against a running server | Pass |
| 7 | Zinc reports out of stock / price exceeded | `orchestrator.zinc-failure.test.ts` + `check:zinc -- --order --fail` (real sandbox) | Pass |
| 8 | Calendar times out or errors | `retry.test.ts` (timeout + 1 retry) + manual run with a temporarily invalid `GOOGLE_OAUTH` key | Pass |

Every row above returns a usable **partial plan** with the failure recorded
in `warnings` and `trace` — never a silent drop and never a false
"success" — per the reliability rules in `CLAUDE.md`.

## Status

Backend scaffold: schemas, ranking, orchestrator, reliability utilities, and
all three integration adapters are implemented and typecheck/build/test
clean in demo mode. All eight reliability scenarios pass automatically in
demo mode (`npm test`); all three integrations have also been manually
verified live (real Google Maps/Places, real Google Calendar via OAuth,
and the real Zinc sandbox) against the scenarios in the table above. Live
verification was manual, not part of the automated CI suite.

### Frontend experience

The homepage now includes Landy (an animated, gradient-shaded SVG flying companion), a floating neighborhood scene, and a short product introduction. Start a landing to enter destination → connections → preferences → review, then generate a typed plan through `POST /api/plan`. The workspace includes three day tabs, Google Maps links and an embedded destination map, editable essentials, action selection, approval, individual execution results, and API traces. Layouts adapt to mobile and respect reduced-motion preferences.

For a credential-free walkthrough, select **Explore a sample landing** in the homepage footer or **Try the sample landing** during onboarding. This deliberately uses the existing Boston fixtures. Sample data and simulated execution remain labeled throughout.

Additional read-only endpoints:

- `GET /api/places?q=…` and `?id=…`: server-side Google Places autocomplete/details; secrets stay on the server.
- `POST /api/preferences`: enriches 3–5 shared places and returns editable category/affordability suggestions.
- `POST /api/connections`: verifies the existing server-configured Google Maps, Google Calendar, or Zinc sandbox connection. Calendar setup still uses `npm run oauth:google`; there is no new per-user browser OAuth flow.

Destination onboarding collects street, number, optional unit, city, optional state/province, country, and postal code. Google Places details autofill these fields; missing values must be completed before continuing. The optional structured `destinationAddress` is validated server-side and becomes the canonical planning address. An unchanged autocomplete selection passes its place ID; manual address edits clear that ID and resolve the full address again before searching nearby. The planner biases searches around the resolved coordinates and calculates straight-line distances. These are not walking-time estimates. Device-local arrival times are converted to UTC; the interface labels this explicitly.

`POST /api/execute` also accepts optional `excludedEssentialIds`. The server validates the edited cart and budget, locks the order contents on first approval, and preserves the same idempotency key on retries. The process-local plan and idempotency stores are shared across Next.js route bundles; they remain non-durable and require a single server process.

## Known limitations

- Live-credential paths were verified manually, not by automated CI — the
  Vitest suite (`npm test`) covers all logic against fixtures/mocks only;
  re-running the eight scenarios live requires the `check:*` scripts and
  real keys as described above.
- Distances are straight-line (haversine), not walking- or driving-time
  estimates — no routing/directions API is wired in.
- The scheduler proposes one grocery trip and one meal per plan, leaving
  other days of the 72-hour window open.
- Zinc order creation submits the existing sandbox test product rather than
  a real multi-item cart, and may return `pending`; pending is never shown
  as confirmed in the UI.
- Planner traces arrive with the completed plan response, not as a live
  stream — no incremental progress updates during generation.
- Plan and idempotency state are stored in-process (no database), so they
  do not survive a server restart and require a single server process.

## Demo video

*[Add the link once recorded.]*
```