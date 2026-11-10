# PO-040 — NEM-024 Checkpoint C: Formal Acceptance

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — PO-040 Acceptance and PO-041 Checkpoint D Authorization*, Part 1). **ACCEPTED FOR DEVELOPMENT PROGRESSION.**
**Domain:** AI services, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Source:** Draft PR #56, baseline `0c629d3` ([Checkpoint C report](../../../reports/2026-11-10-NEM-024-checkpoint-c-report.md)); authorization [PO-039](PO-039-nem-024-checkpoint-c-authorization.md)

> Identifier: `PO-040` verified unused on all remote branches on 2026-11-10; continues after PO-039.

## Decision

The Product Owner formally accepts **NEM-024 Checkpoint C (Transport (SSE) and Capability Probe) for development progression**, based on the independent PA review of the implementation and the reported evidence:

- 1,956/1,956 unit tests passed;
- 216/216 integration tests passed;
- global branch coverage of 80.20%;
- TypeScript clean;
- no blocking architectural defect identified.

## Accepted decisions

| Id | Decision |
|---|---|
| **D-C1** | SSE answer content is released **per turn**, after Gateway validation **and** confirmed persistence (this request's own T1 commit, G5). The only exception is the approved D-8 `unrecorded` case |
| **D-C2** | The canonical stage names are **`checking`**, **`searching`**, and **`composing`** |
| **D-C3** | After the SSE stream opens, terminal errors are an SSE `terminal` event carrying the applicable `statusCode`. Clients must inspect that event and must not assume that HTTP 200 means success |

## Exceptions preserved — not waived

All PO-038 exceptions remain open:

1. **E-1:** NEM-023 retrieval p95, 594 ms vs 150 ms.
2. **E-2:** global branch coverage is 80.20% on the reviewed stack; formal closure requires a separate decision.
3. **NEM-022 coverage exception:** open independently.
4. **D-8:** best-effort `unrecorded` delivery and its billing/response-loss residual.
5. **Cancellation persistence:** a failed terminal-record write may leave a same-key replay `pending`.
6. **Multi-instance cancellation:** in-process only; a shared mechanism needs separate approval before scaling beyond one API instance.
7. **Q-11:** W=10 remains a candidate, subject to Checkpoint E qualification.
8. **TT-14:** generated-answer retention and rights treatment are unresolved.

**New non-blocking risk:**

9. **SSE proxy idle timeout (R-C1):** there is no heartbeat, so a long silent provider attempt could hit a proxy idle timeout. The turn itself is unaffected and same-key replay recovers it. **To be evaluated at Checkpoint E.**

No exception is declared closed.

## Not authorized by this decision

Merging; deployment; production activation; paid providers; infrastructure changes. Checkpoint D is authorized separately by [PO-041](PO-041-nem-024-checkpoint-d-authorization.md).
