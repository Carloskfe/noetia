# PO-039 — NEM-024 Checkpoint C: Execution Authorization (Transport and Capability Probe)

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 Checkpoint C — Product Owner Execution Authorization*). **CHECKPOINT C ONLY.**
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Baseline:** Draft PR #56 at `39c0c37` · **Governance:** [PO-038](PO-038-nem-024-checkpoint-b-formal-acceptance.md) (Checkpoint B accepted)

> Identifier: `PO-039` verified unused on all remote branches on 2026-11-10; continues after PO-038.

## Decision

The Product Owner authorizes implementation of **NEM-024 Checkpoint C — Transport (SSE) and Capability Probe**, per the approved NEM-024 specification. This authorization waives no outstanding exception and does not authorize user-facing activation.

## Scope

**A. SSE streaming:** `POST /knowledge/sessions/:id/turns/stream`, with these events:

- `stage`: content-free progress;
- `segment` / `delta`: answer content only after the Gateway's validated output boundary;
- `terminal`: the final outcome, with settlement and persistence information.

Requirements:

- Preserve authentication, capability checks, eligibility, cancellation, idempotency, billing, and PostgreSQL fencing.
- **No answer text or source excerpts before Gateway validation.**
- Preserve D-8 best-effort `unrecorded` semantics, and never represent an unrecorded response as persisted.
- A transport disconnect never cancels the turn.

**B. Capability probe:** `GET /knowledge/sessions/capabilities`.

- The static route is registered before the `:id` routes.
- It requires the approved authentication and capability controls.
- It returns the user's tier, capabilities, and limits.
- It never exposes monetary budgets, ledger balances, provider configuration, or secrets.
- The existing feature-flag behaviour is preserved.

## Required verification

Deterministic unit and integration coverage of:

- SSE ordering and serialization;
- validation before any content emission;
- terminal outcomes: completed, failed, cancelled, interrupted, unrecorded;
- disconnect without implicit cancellation;
- duplicate keys and replay;
- rights and eligibility enforcement;
- the probe: authorization, response shape, route precedence;
- no sensitive content in logs or error responses.

Regression must include Checkpoints A and B. The dark simulator and fixtures are used only.

## Boundaries

- Accepted Checkpoint A/B contracts are not modified, unless a demonstrable defect is found, and that requires a separate PO decision.
- Not introduced:
  - new infrastructure;
  - new billing authority;
  - direct ledger access from E6;
  - new AI providers;
  - unapproved persistence;
  - new production feature flags or activation.
- The single-instance operating assumptions are maintained.
- If the approved SSE contract conflicts with the Gateway's validation or settlement guarantees: **stop and escalate to PA** rather than weaken either guarantee.

## Not authorized

Checkpoints D and E; merging; deployment; production activation; paid providers.

## Exceptions carried forward (not waived)

E-1, E-2, the NEM-022 coverage exception, D-8, cancellation-record persistence, in-process-only cancellation (N-B5), Q-11, and TT-14 (as listed in PO-038).
