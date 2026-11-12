# PO-042 — NEM-024 Checkpoint D: Formal Acceptance

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — Checkpoint D Formal Acceptance and Checkpoint E Execution Authorization*, §2). **CHECKPOINT D ACCEPTED FOR DEVELOPMENT PROGRESSION.**
**Domain:** AI services, Web, Governance · **Authority:** Product Owner · **Review:** independent Product Architecture
**Date:** 2026-11-10 · **Source:** Draft PR #56, reviewed baseline `be47cf2` ([Checkpoint D report](../../../reports/2026-11-10-NEM-024-checkpoint-d-report.md), incl. §10); authorization [PO-041](PO-041-nem-024-checkpoint-d-authorization.md)

> Identifier: `PO-042` verified unused on all remote branches on 2026-11-10; continues after PO-041.

## Decision

**Checkpoint D (Minimal Bilingual Web Q&A) is accepted for development progression.** PA independently reviewed Checkpoint D and its three corrections:

| Id | Correction |
|---|---|
| **F-D1 (privacy)** | Tab-scoped `sessionStorage`; account-bound recovery; 15-minute expiry; logout cleanup; legacy storage removal |
| **F-D2 (idempotency)** | Unknown-turn recovery reuses that turn's original key, even after another question |
| **F-D3 (cancellation)** | Polling resumes after inconclusive cancellation responses; a 15-second watchdog prevents indefinite waiting for an SSE terminal |

## Evidence

Engineering submitted:

- web unit tests 448/448;
- Playwright 2/2 (English and Spanish);
- TypeScript and lint clean;
- web branch coverage 76.25%, below the existing gate;
- no backend changes.

**PA inspected the relevant source changes but did not independently rerun these tests.**

## Documented limitations (preserved)

- **Tab-only recovery:** a question is recovered only in the tab that sent it. Other tabs see the turn through history.
- **Storage expiry:** recovery data expires after 15 minutes. A logout that does not go through `clearToken` leaves the entry until the tab closes, the expiry passes, or another account is detected.
- **Older unknown turn after a newer question and a reload:** only the latest pending question is stored, so recovering the older unknown turn after a reload relies on history. In-page "Check again" still uses the original key.
- **Web coverage below its existing gate** (pre-existing; raised by Checkpoint D).

## Not authorized by this decision

Merging; staging or production deployment; activation; paid providers; infrastructure changes. Checkpoint E is authorized separately by [PO-043](PO-043-nem-024-checkpoint-e-authorization.md).
