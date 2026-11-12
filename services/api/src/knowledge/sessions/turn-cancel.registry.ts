import { Injectable } from '@nestjs/common';

/**
 * NEM-024 Checkpoint B — in-process registry of in-flight question turns, keyed by the server turn key (namespaced by
 * user and session, so another user cannot address it). Explicit cancellation aborts the owner's work through the
 * existing Gateway `AbortSignal`. A transport disconnect never uses this registry (D-9 a).
 *
 * Known limitation (documented): with more than one API instance a shared channel would be needed. The database
 * transition T3 does not depend on this registry, so a cancel still records correctly when the owner is elsewhere or gone.
 */
@Injectable()
export class TurnCancelRegistry {
  private readonly inFlight = new Map<string, AbortController>();

  register(turnKey: string): AbortSignal {
    const c = new AbortController();
    this.inFlight.set(turnKey, c);
    return c.signal;
  }

  /** Abort the in-flight owner, if any. Returns true when an owner was registered here. */
  abort(turnKey: string): boolean {
    const c = this.inFlight.get(turnKey);
    if (!c) return false;
    c.abort();
    return true;
  }

  unregister(turnKey: string, signal: AbortSignal): void {
    const c = this.inFlight.get(turnKey);
    if (c && c.signal === signal) this.inFlight.delete(turnKey);
  }

  get size(): number {
    return this.inFlight.size;
  }
}
