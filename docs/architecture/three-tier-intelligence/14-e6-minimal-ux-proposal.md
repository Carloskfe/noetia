# 14 — E6 Minimal Web/Mobile UX Proposal (DISCOVERY, DRAFT)

**Status:** DRAFT, documentation-only — **revision 2** (PA review R-2, R-4, R-5). No UI code exists for intelligence today: web and mobile contain no research, session, or Ask My Highlights screens; only marketing copy mentions Noetia+. This is a proposal for the **minimum viable Noetia+ question-and-answer experience**.

Constraints:
- no new UI framework, no new service;
- reuse the Next.js 14 app router + Tailwind (web) and Expo 51 / React Native 0.74 (mobile);
- reuse the existing `apiFetch` / mobile `client.ts`, the i18n providers, and the voice guide;
- reader components untouched.

## 1. Scope: who builds it

The P0 packet (Draft PR #48) assigns the frontend to **E9**, while this discovery was asked to cover UX. **D-1** decides between:
- (a) E6 delivers the backend plus a minimal web Q&A screen behind the existing flag; E9 completes the rest;
- (b) E6 backend only (API, persistence, streaming transport), with all UI in E9 (P0 packet).

Both remain open. **This document applies only if D-1(a) is chosen.** Otherwise it is input to E9.

**Revision 2 (R-2, D-2 C):** the first implementation has **no user knowledge**:
- the "Tus notas" (`user_content`) segment in the mock-up below appears only after a later, separately authorized step;
- the first slice shows book passages and synthesis only.

Mobile follows **D-6 (TT-20)**. Provisional P0 recommendation: web first.

## 2. Screens (web MVP)

### 2.1 Research session (`/research/[sessionId]`)

```
┌──────────────────────────────────────────────────────────────┐
│ ← Biblioteca     Sesión de investigación        [Bifurcar]   │
│ Libros (bloqueados tras la primera pregunta):                │
│  [📘 Libro A] [📘 Libro B] [📕 Libro C · no disponible ⓘ]     │
├──────────────────────────────────────────────────────────────┤
│  Tú: ¿Qué papel tiene el faro en ambos libros?               │
│                                                              │
│  Noetia:                                                     │
│   ▌ Del libro  En «Libro A» el faro aparece como… [1] [2]    │
│   ▌ Síntesis   Ambos textos usan el faro como…               │
│   ▌ Tus notas  Anotaste que… [n1]                            │
│   ⓘ 1 libro excluido de esta respuesta (no disponible)       │
├──────────────────────────────────────────────────────────────┤
│ [ Escribe tu pregunta…                       ] [Preguntar]   │
│  Capacidad mensual: ▓▓▓▓▓░░░ (TT-10 copy)                    │
└──────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Book chips | Selected set. **Lock indicator** after the first accepted turn (PO-027 rule 5). An excluded book is shown greyed with a neutral reason ("not available for research right now"). `Fork` creates a new session (existing endpoint) |
| Conversation | Turns persisted server-side (`GET …/turns`); question and answer pairs; newest at the bottom |
| Origin labels | `library` → "From the book", `synthesis` → "Synthesis", `user_content` → "Your notes", `broader` → (hidden until TT-18). Labels are text plus an icon, **not colour only** |
| Citations | Numbered chips `[1]`. Activating one opens an **excerpt panel** with the verified passage text (already returned by the server), book title, and "Open book". Stage 1 has **no exact reader position**, because chapter and phrase data are NULL (NEM-023 Amendment 1) and the reader is phrase-indexed. "Open book" therefore opens the reader at the user's current position (link only; reader untouched). Exact deep links need an approved `sync_maps` mapping later |
| Disclosures | Banner per answer for `exclusions` (ineligible, unindexed, stale, unavailable, index not permitted), worded as facts (product rule §7) |

### 2.2 Entry points

- From a book page: "Research with Noetia+" → create a session with that book.
- From the library: multi-select up to the tier limit (server-enforced; the UI mirrors `limit_reached`).
- Hidden entirely unless the flag/entitlement probe succeeds. There is no endpoint for that probe today; **E6 adds `GET /knowledge/me` (tier, capabilities, limits; no budget values)** or reuses the `create` denial (D-3 lists it).

## 3. States

| State | Trigger | UI |
|---|---|---|
| Idle | — | Input enabled; the hint suggests concrete questions (E5 AND semantics: fewer, specific words) |
| Submitting | POST sent | Input disabled; "Preparando…" (voice guide: verb + `…`) |
| Stages (web stream) | SSE `stage` events: `checking`, `searching`, `composing` | Step text: "Comprobando tus libros…", "Buscando pasajes…", "Redactando respuesta…" |
| Answer arrives | `segment` events (per attempt, after validation) or JSON | Render all segments at once. **There is no token-by-token typing**: NEM-022 F-1/F-3 release text only after validation and settlement, an accepted guarantee. The UI must not fake typing that implies partial unvalidated text |
| Cancelled | User presses "Cancelar" (explicit cancel endpoint) | Turn shown as "Cancelada". If the provider had started: "Puede contar en tu capacidad mientras se confirma." (held until reconciliation) |
| Connection lost | Tab closed / network drop / app backgrounded | **Not a cancellation** (D-9 a). On return, the client fetches the turn (same key / `GET …/turns/:turnId`) and shows the answer |
| Unrecorded | `status: 'unrecorded'` | Show the answer with a small note: "No pudimos guardar esta respuesta en tu historial." |
| Interrupted | History shows `interrupted` | "Esta pregunta se interrumpió. Vuelve a preguntar." (new key) |
| Error | `code` | Mapped copy (below); a retry button only where retry is meaningful |
| Read-only session | `session_read_only` | Input replaced by "Esta sesión es de solo lectura. Bifúrcala para continuar." |
| Budget exhausted | `budget_exhausted` | Input disabled until reset; TT-11 copy (hard stop + upgrade if eligible; no token language, `BOOK TOKEN ≠ AI USAGE`) |

### Error copy (es, voice guide: tú form, statement + action, no `¡`, no "Error:")

| Code | ES | EN |
|---|---|---|
| `turn_failed`, `scope_violation` | Algo salió mal. Inténtalo de nuevo. | Something went wrong. Try again. |
| `budget_exhausted` | Has usado tu capacidad mensual para esta función. | You've used your monthly capacity for this feature. |
| `budget_unavailable`, `unresolved_reservations` | Esta función no está disponible ahora. Inténtalo más tarde. | This feature isn't available right now. Try again later. |
| `no_eligible_books` | Ninguno de los libros seleccionados está disponible para investigar. | None of the selected books is available for research. |
| `set_changed` | Los libros de la sesión cambiaron. Vuelve a preguntar. | The session's books changed. Ask again. |
| `session_read_only` | Esta sesión es de solo lectura. Bifúrcala para continuar. | This session is read-only. Fork it to continue. |

All strings go through `lib/i18n/{en,es}.ts` (web parity test). Mobile strings are added only if mobile is in scope (4-file rule for shared copy).

## 4. Rights revocation during a session

- New turn: the excluded book's chip turns grey; the banner discloses it; answers come from the remaining books.
- Earlier answers: excerpts are re-materialized on every history read; for a revoked, changed, or purged source the citation shows "Fuente no disponible" (`sourceState`), and the answer text stays (D-10 a default; final policy TT-14).
- At answer time, if a citation's position cannot be resolved: show the verified excerpt without the "Open book" position hint ("Posición no disponible").

## 5. Retries and idempotency

- The client generates one `idempotencyKey` per question (UUID-like, matches `^[A-Za-z0-9_-]{8,64}$`).
- "Reintentar" after a network failure **reuses the same key**, so the server returns the stored turn and nothing is charged twice. This requires the E6 replay behaviour; today a reused key returns `duplicate_turn` 409.
- "Preguntar de nuevo" after `turn_failed` uses a **new key** (new reservation).

## 6. Accessibility

- Conversation region `role="log"` with `aria-live="polite"`; announce the stage text and "Respuesta lista". Never announce partial text.
- Citations are buttons with accessible names ("Cita 1, Libro A"). The excerpt panel is a dialog with focus trap and return focus.
- Origin labels are conveyed by text, not colour; contrast meets WCAG AA in light and dark (reader dark mode exists).
- Input: visible label, `Enter` submits, `Shift+Enter` adds a newline, `Esc` cancels an in-flight turn (also a button).
- Respect `prefers-reduced-motion` for stage animations.

## 7. Mobile specifics (only if D-6 includes mobile)

- **Non-streaming** (React Native 0.74 `fetch` has no stream body): a single request with stage text driven by a client timer, cancel via `AbortController`.
- Keyboard-avoiding input; the excerpt panel as a bottom sheet (reuse the existing sheet pattern from the fragments and chapter drawers).
- Background/foreground: a request interrupted by backgrounding is retried with the **same key** (replay).
- Offline: questions are not queued offline (requires the server); a clear offline message.
- **Store billing (TT-20):** no premium purchase UI on mobile in the MVP; entitlement comes from the web/back-end.

## 8. Explicitly out of the MVP

Ask My Highlights screen (TT-27) · highlight search · Research Brief (E7) · NoetiaX depth (E8) · capacity numbers (TT-10 wording only) · Expand / `broader` (TT-18) · exact reader deep links · token-by-token streaming.
