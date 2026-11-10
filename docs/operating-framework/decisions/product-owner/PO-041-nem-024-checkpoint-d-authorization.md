# PO-041 — NEM-024 Checkpoint D: Execution Authorization (Minimal Bilingual Web Q&A)

**Status:** `DECIDED` — Product Owner, 2026-11-10 (*NEM-024 — PO-040 Acceptance and PO-041 Checkpoint D Authorization*, Part 2). **CHECKPOINT D ONLY.**
**Domain:** AI services, Web, Governance · **Authority:** Product Owner
**Date:** 2026-11-10 · **Baseline:** Draft PR #56 at `0c629d3` · **Governance:** [PO-040](PO-040-nem-024-checkpoint-c-formal-acceptance.md) (Checkpoint C accepted)

> Identifier: `PO-041` verified unused on all remote branches on 2026-11-10; continues after PO-040.

## Decision

The Product Owner authorizes **NEM-024 Checkpoint D — Minimal Bilingual Web Q&A**, per the approved mission (§5 item 13, §5.1, §5.2, AC-14) and [doc 14](../../../architecture/three-tier-intelligence/14-e6-minimal-ux-proposal.md). Only the web route `services/web/app/(research)/research/[sessionId]` is in scope.

## Required functionality

1. **Capability gating:** render only when the existing probe authorizes; handle loading, denial, and feature-disabled states safely.
2. **Session context:** selected books, session-lock status, exclusions, read-only and fork notices.
3. **History:** load the session's persisted turns; no invented memory and no new persistence.
4. **Ask:** through the approved SSE endpoint, with an idempotency key.
5. **Progress:** content-free `checking`, `searching`, `composing`.
6. **Cancellation:** explicit, through the existing endpoint. A browser disconnect never cancels.
7. **Recovery:** same-key replay after a reload or disconnect, with no duplicate reservation or billing.
8. **Answers:** origin labels, verified citations, a citation dialog with the excerpt or `sourceState`, and an "Open book" link (reader unmodified).
9. **Failures:** failed, cancelled, interrupted, pending, and unrecorded are clearly distinguished.
10. **Bilingual:** EN/ES through the existing i18n, with Noetia terminology and voice.
11. **Accessibility:** keyboard use, focus management, accessible dialog, live-region progress.

Reuse `apiFetch`, Tailwind, `LanguageProvider`, and the translation infrastructure. No new UI framework, service, or infrastructure dependency.

## Scope exclusions

- Session creation, book selection, session management.
- A global navigation or book-page entry (needs separate PA authorization).
- My Knowledge, Ask My Highlights, highlight search.
- Research Brief, NoetiaX depth screens, mobile.
- Reader changes or exact-position deep links.
- Providers, paid AI, production activation.

## Verification

Tests must cover:

- EN/ES translations and error-code mapping;
- capability gating and unauthorized access;
- SSE parsing, ordering, and terminal outcomes;
- reload and idempotent replay;
- explicit cancel versus disconnect;
- citation rendering and rights-aware excerpt states;
- keyboard and screen-reader accessibility;
- D-8 unrecorded messaging.

Relevant frontend and API regression checks must be run.

## Boundaries and stop conditions

- **Not authorized:** Checkpoint E; merging, deployment, production activation; changes to protected backend contracts.
- If a required frontend behaviour cannot be built without changing an accepted A–C contract: **stop and request PA review.**
- **STOP** after Checkpoint D implementation and verification, for independent PA review.

## Exceptions carried forward (not waived)

As in PO-040 (items 1–9).
