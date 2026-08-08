# 17 — Web & Mobile UX (Architecture, not pixels)

Design placement only — no pixel-perfect UI. Reuse existing shells (`AppTopBar`, `BottomNav`, i18n).

## Two surfaces, one API
Web (Next.js) and mobile (React Native) call the **same `/plus/*` API** and share domain logic conceptually; UI is platform-specific (as the reader already is). AI processing is server-side — **no offline AI for MVP** (offline reading is unaffected).

## Placement: contextual + a light global workspace
Recommend **both, minimally**:
- **Contextual entry points** (where intent arises):
  - **Book / Reader:** "Ask this book" (opens Ask scoped to that book) — the highest-value entry; also a fragment/highlight action "Ask about this".
  - **Fragment sheet:** "Ask my highlights" / "Summarize these".
  - **Library:** "Ask my library" (Phase 2), recommendations row.
  - **Search:** semantic search alongside existing lexical results.
  - **Citations:** tapping a citation opens the reader at `?phrase=N` (deep link) — the loop back into Escucha Activa.
- **Global Noetia+ tab/workspace:** a home for conversations, saved knowledge assets, recommendations, GROW analytics, memory/resurfacing. Keep navigation simple — one Noetia+ entry in the nav, not a sprawl.

## Web-first vs mobile-first
- **Web-first:** creation (articles/presentations/outlines), knowledge maps, GROW dashboards, long conversations (bigger screens, export).
- **Mobile-first / parity:** Ask-this-book, Ask-my-highlights, recommendations, memory resurfacing (bite-sized, notification-friendly via existing Expo push).
- **Not simultaneous:** ship web-first for MVP Ask; bring mobile Ask right behind. Don't block launch on full mobile parity.

## Reader integration (tiny, safe)
- Reader honors a new **`?phrase=N`** query param → `seekToPhrase`/`scrollIntoView` (existing). This is the only reader change and is additive/no-op when absent.
- The reader gains an **optional** "Ask" affordance that opens Noetia+ **outside** the audio/sync path — it cannot affect playback.

## Graceful states
Every Noetia+ surface degrades to a clear message (not an error) when a capability is off, over limit, unindexed, or the provider is down ([10 errors](10-api-design.md)) — and the reader is always fully usable regardless.

## i18n
All strings via the existing i18n (ES/EN); language-aware Ask ([30 → 04](04-rag-and-retrieval.md)). Spanish-first.
