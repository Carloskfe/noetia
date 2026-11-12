# PO-037 — NEM-024 Checkpoint B Amendment 2 (Option B): Cancellation Before Lock Commit

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 Checkpoint B — Product Owner Authorization: Amendment 2 — Option B*). **APPROVED — NARROW SCOPE ONLY.**
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #56, reviewed commit `e4a45bc` (Checkpoint B report §12, F-2 / N-B1)
**Implementation:** Amendment 2 only, within Checkpoint B

> Identifier: `PO-037` verified unused on all remote branches on 2026-11-10; continues after PO-036.

## Decision

**Option B approved.** The B-2 terminal-record exception (NEM-024 Amendment 1) is **extended** to a terminal `cancelled` record **without a committed session lock**.

When an explicit cancellation is observed **before the step-4 session-lock transaction commits**:
1. the session lock does not commit;
2. the unlocked book-selection state is preserved;
3. `turnCount` is not incremented;
4. the never-sent reservation is released through the existing Gateway;
5. an idempotent terminal `cancelled` record is persisted with `turnIndex = NULL`;
6. the observed release outcome is preserved (`released` | `unconfirmed`);
7. a same-key replay returns `cancelled`, with no other reservation or provider call.

The decision must be race-safe. A cancellation observed only **after** the lock commits keeps the existing post-lock semantics, and an accepted turn is never retroactively unlocked.

## Safeguards

- The Gateway and the NEM-021 ledger remain the sole billing authorities; no ledger access from `TurnService`.
- The session-lock and turn-count transaction guarantees, the unique idempotency key, the one-provisional-turn index, PostgreSQL fencing, and terminal monotonicity are preserved.
- No release once a provider attempt has begun; "released" only when the Gateway confirms.
- No new infrastructure.

## Not authorized

Checkpoints C, D, E; merge; deployment or production activation; production AI providers; infrastructure changes; unrelated refactoring; additional protected-contract exceptions.
