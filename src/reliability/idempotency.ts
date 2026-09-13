import type { ActionResult } from "@/agent/schemas";

/**
 * In-memory idempotency store keyed by operationId. Per CLAUDE.md, the MVP
 * has no database — this is process-local and resets on restart, which is
 * acceptable for a single-process hackathon demo but must not be treated as
 * durable. Prevents duplicate Calendar events / Zinc orders when the
 * /api/execute endpoint (or a client) is called twice for the same action
 * (e.g. double-click, network retry).
 */
class IdempotencyStore {
  private results = new Map<string, ActionResult>();
  private inFlight = new Map<string, Promise<ActionResult>>();

  /**
   * Returns the cached result for `operationId` if the write already
   * completed or is in flight; otherwise runs `perform` exactly once and
   * caches the outcome. Only successful results are cached permanently —
   * failed attempts are evicted so a later call can retry the write.
   */
  async getOrCreate(
    operationId: string,
    perform: () => Promise<ActionResult>,
  ): Promise<ActionResult> {
    const existing = this.results.get(operationId);
    if (existing) return existing;

    const pending = this.inFlight.get(operationId);
    if (pending) return pending;

    const promise = perform()
      .then((result) => {
        if (result.status !== "failed") {
          this.results.set(operationId, result);
        }
        return result;
      })
      .finally(() => {
        this.inFlight.delete(operationId);
      });

    this.inFlight.set(operationId, promise);
    return promise;
  }
}

/** Process-wide singleton — Next.js API routes share this module instance. */
const processState = globalThis as typeof globalThis & { landingIdempotency?: IdempotencyStore };
export const idempotencyStore = processState.landingIdempotency ??= new IdempotencyStore();
