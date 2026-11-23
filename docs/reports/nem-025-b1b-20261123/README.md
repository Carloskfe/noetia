# NEM-025 Checkpoint B1-B: Mobile Interface Completeness, completion report

**Authorization:** PO execution authorization "NEM-025 / CHECKPOINT B1-B — MOBILE INTERFACE COMPLETENESS" (B1-B only).
**Status:** implemented on a Draft PR stacked on Checkpoint A. **MANDATORY STOP:** awaiting independent PA review. No B2, no merge, no deployment, no OTA, no mobile build, French not enabled.

## 1. Verified baseline and dependencies

All heads were re-checked on 2026-11-23 before work started and match the authorization.

| Ref | SHA | State |
|---|---|---|
| `main` | `8f2f294378a8cdc7472f2849ce533981605fcb01` | unchanged |
| PR #77, approved NEM-025 spec and PO record | `4ef2906` | Draft |
| PR #78, Checkpoint A (`feat/nem-025-checkpoint-a`) | `81143790e661126dbf862201565d6c98ab111019` | Draft. **B1-B branches from this exact head** |
| PR #79, Checkpoint B preparation and mobile inventory | `e24c729` | Draft |
| PR #80, B1-A (accepted) | `28aa668082875e26cde5ce8e4cfae7d48c0a51fd` | Draft, **not modified** |
| PR #69, CI-4.0 (`react-test-renderer`) | `3bc8712` | Draft, **not merged, dependency not installed** |
| PR #70, CI-4.1 | `9f4a192` | Draft |
| PR #72, PR-A (M-D3/M-D6 lifecycle) | `395e6e9` | Draft |

- **Branch:** `feat/nem-025-checkpoint-b1b`. The Draft PR targets `feat/nem-025-checkpoint-a`, so its diff contains only B1-B. Nothing was merged or cherry-picked.
- **B1-A independence:** B1-B touches only `services/mobile/` and this report; B1-A touches only `services/web/` and its own report. The two branches do not overlap.
- **CI:** CI runs only on PRs into `main`, so it **does not run on this stacked PR**. All results in §8 are local.

## 2. Changed files and commits

| Commit | Content |
|---|---|
| `1f31dc1` | Golden master captured on **unchanged** Checkpoint A code (17 surfaces, ES and EN) |
| `3c4d68d` | Dictionary keys (en/es/fr-CA) and presentation helpers, with tests |
| `301248b` | Surface refactors, updated golden master, fr-CA, gate and navigation-state tests |
| this commit | This report |

**Source (11 files, `services/mobile/src/`):**
- `i18n/en.ts`, `i18n/es.ts`, `i18n/fr-ca.ts`: new keys `nav.*`, `lang.sublabels`, `common.errorTitle`, `auth.social.*` (labels and 8 errors), `reader.audioLoadError`, `clubs.live.*` (status, range, labels, 3 errors).
- `i18n/errors.ts` (new): `liveSessionErrorMessage`, which maps live-session socket errors to localized text; the server's raw text is never shown.
- `i18n/format.ts` (new): `intlLocale`, `formatLongDate`, `formatDateTime` (presentation only; no currency).
- `navigation/MainNavigator.tsx`: tab labels (`tabLabel`) and stack back titles from the dictionary.
- `screens/LanguageScreen.tsx`: option sub-labels from the dictionary (labels stay endonyms).
- `auth/SocialAuthButtons.tsx`: divider, button text, accessibility names and error messages.
- `screens/library/LibraryScreen.tsx`: header (M-D1), error stored as a kind and resolved at render (M-D2).
- `components/AudioPlayerBar.tsx`: loading text, and load-failure text (M-D4) shown in the interface language.
- `screens/clubs/LiveSessionScreen.tsx`: status, phrase range, listener pill, "you", chat title, mapped socket error.
- `screens/clubs/ClubScreen.tsx`: alert title, phrase range, poll and session dates.
- `screens/fragments/FragmentsScreen.tsx`: fragment date in the interface language.

**Tests (`services/mobile/tests/unit/`):**
- `golden-master/harness.ts` (new) and `golden-master/b1b-mobile.spec.tsx` (new) with its snapshot.
- `i18n/errors.spec.ts`, `i18n/format.spec.ts`, `i18n/b1b-keys.spec.ts` (new).
- `i18n/fr-ca.spec.ts`: three cognates added to the reviewed allowlist (`nav.clubs`, `nav.fragments`, `nav.club`).

**Not touched:**
- `hooks/useAudioPlayer.ts`, `hooks/useClubSession.ts`, `screens/reader/ReaderScreen.tsx`, the offline modules;
- `screens/ConsentScreen.tsx`, `offline/consent-storage.ts`, `screens/PaywallScreen.tsx`;
- `i18n/index.tsx`, `i18n/locales.ts` (Checkpoint A gate and preference logic);
- `package.json`, the lockfile, Jest config and thresholds;
- `services/api`, `services/web`, CI, infrastructure.

## 3. Mobile localization coverage matrix

| Area | Surface | Before | After | Status |
|---|---|---|---|---|
| **M-1** | Bottom tabs | Spanish literals for every language | `t.nav.*`; re-render on language change keeps navigation state | DONE |
| M-1 | Stack back titles (Reader, ClubDetail, LiveSession) | Spanish literals | `t.nav.*` | DONE |
| M-1 | Stack titles | book, club or session name (content) | unchanged | content, not UI |
| **M-2** | Social sign-in divider, buttons, accessibility names | Spanish literals | `t.auth.social.*` | DONE |
| M-2 | Social sign-in errors (8) | Spanish literals | `t.auth.social.errors.*` | DONE |
| M-2 | Language screen sub-labels | mixed ("Latin America", "Inglés", "French (Canada)") | interface language | DONE (correction) |
| M-2 | Login, register, onboarding tour, account | already localized; no raw API text | unchanged | VERIFIED (golden master) |
| **M-3** | Library header (M-D1) | "Biblioteca" for every language | `t.library.title` | DONE |
| M-3 | Library load error (M-D2) | message frozen at mount language | kind resolved at render | DONE |
| M-3 | Audio bar loading | "Cargando…" | `t.common.loading` | DONE |
| M-3 | Audio load failure (M-D4) | Spanish string from the hook shown verbatim | interface language at display; **hook unchanged** | DONE (display) |
| M-3 | Reader errors and labels | already localized | unchanged (protected) | VERIFIED |
| **M-4** | Live session status, range, pill, "you", chat title | Spanish literals | `t.clubs.live.*` | DONE |
| M-4 | Live session socket error | raw English server text ("Not a club member") | mapped, localized | DONE |
| M-4 | Club join error alert title | "Error" | `t.common.errorTitle` | DONE |
| M-4 | Club session phrase range | "Frases a–b" | `t.clubs.live.phrases` | DONE |
| M-4 | Club poll and session dates | device locale | interface locale | DONE |
| M-4 | Club list, chat, discussion, polls, sessions labels | already localized | unchanged | VERIFIED |
| **M-5** | Consent screen | ES+EN bilingual legal summaries | **unchanged** | BLOCKED: legal (§6) |
| **M-6** | Fragment dates | `'es'` for every language | interface locale (`es` kept for Spanish) | DONE |
| — | Paywall prices | USD | unchanged (USD-only; PR #60 owns paywall changes) | out of scope |
| — | Push notification text | built by the API | unchanged | B2 |

## 4. EN/ES regression and golden-master evidence

- **Method:** `1f31dc1` recorded, before any refactor, the first-render visible text and accessibility attributes (`accessibilityLabel`, `accessibilityHint`, `placeholder`, `title`) of 17 surfaces in ES and EN (34 entries). Dates are masked as `<date:LOCALE>` so the snapshot records which locale a surface asks for without depending on the machine.
- **Harness:** the mobile package has no React renderer (`react-test-renderer` is only in PR #69). The harness follows the pattern the existing screen specs already use: hooks are stubbed and components are called directly, recursing into child components. It uses existing tooling only and adds no dependency.
- **Result:** **3 surfaces unchanged** (account, clubs-list, consent). **14 surfaces changed, in 18 of 34 entries (4 ES, 14 EN).** Each changed entry is listed below.

**Spanish entries changed (4):**

| ID | Entry | Before | After | Reason |
|---|---|---|---|---|
| S-1 | `language-screen` ES | sub-label "Latin America" (English) | "Latinoamérica" | Spanish UI showed an English sub-label |
| S-2 | `live-session/connected-paused-error` ES | "Not a club member" (raw server text) | "No eres miembro de este club." | raw API message removed |
| S-3 | `club/polls` ES | `<date:device>` | `<date:es>` | dates in the interface language |
| S-4 | `club/sessions` ES | `<date:device>` | `<date:es>` | same |
| — | All other ES entries | — | byte-identical | — |

**English entries changed (14):** each replaces Spanish (or raw server) text shown to English users.

| ID | Entry | Before → after |
|---|---|---|
| E-1 | `navigation` EN | tabs "Biblioteca/Clubes/Fragmentos/Cuenta" → "Library/Clubs/Fragments/Account"; back titles "Biblioteca/Clubes" → "Library/Clubs" ("Club" unchanged) |
| E-2 | `language-screen` EN | sub-label "Inglés" → "English" |
| E-3, E-4, E-5 | `social-auth-buttons`, `login`, `register` EN | "o continúa con", "Continuar con Google/Facebook" (text and accessibility names) → English |
| E-6, E-7 | `library/loaded`, `library/empty` EN | header "Biblioteca" → "Library" (M-D1) |
| E-8 | `audio-bar/loading` EN | "Cargando…" → "Loading…" |
| E-9 | `audio-bar/error` EN | "No se pudo cargar el audio." → "Could not load the audio." (M-D4) |
| E-10 | `live-session/connected-paused-error` EN | "2 escuchando", "Frases 10–40", "Not a club member", "⏸ En pausa", "Tú", "Chat en vivo" → "2 listening", "Phrases 10–40", "You are not a member of this club.", "⏸ Paused", "You", "Live chat" |
| E-11 | `live-session/connecting-playing` EN | "Conectando…", "🎧 Sincronizando…" and the same labels → English |
| E-12 | `club/sessions` EN | `<date:device>` → `<date:en-US>`; "Frases 10–40 · Libro" → "Phrases 10–40 · Libro" (book title stays in its language) |
| E-13 | `club/polls` EN | `<date:device>` → `<date:en-US>` |
| E-14 | `fragments` EN | `<date:es>` → `<date:en-US>` |

**Other evidence:**
- `b1b-keys.spec.ts` asserts that every new Spanish dictionary value equals the literal it replaced.
- Book content (titles, authors, quotations, chat messages, club names) is data and stays in its original language.
- No product policy, legal copy, price or financial meaning changed.

## 5. Previously identified localization defects corrected

| Defect (PR #79) | Correction | Test |
|---|---|---|
| Spanish tab labels for EN users (inventory §3) | `t.nav.*`; tabs and back titles follow the interface language | golden `navigation`; navigation-state test |
| **M-D1** Library header "Biblioteca" for every language | `t.library.title` | golden `library/*` EN |
| **M-D2** stale `t` in the library `load` callback | error stored as a kind, text resolved at render; the callback, its dependencies and its async flow are unchanged | golden `library/*`; typecheck |
| **M-D4** `useAudioPlayer` sets a Spanish error string | the audio bar shows `t.reader.audioLoadError` whenever the hook reports an error. **The hook is not modified** (protected audio lifecycle; PR #72 also edits it) | golden `audio-bar/error` |
| Social sign-in in Spanish for EN users | `t.auth.social.*` | golden `social-auth-buttons`, `login`, `register`; social error test (es/en/fr-CA) |
| Live-chat and session labels in Spanish | `t.clubs.live.*` | golden `live-session/*` |
| Club alert "Error" literal | `t.common.errorTitle` | dictionary parity |
| Language sub-labels mixed languages | interface language | golden `language-screen`; `b1b-keys.spec` |
| Raw socket error text | `liveSessionErrorMessage` | `errors.spec.ts`; golden S-2 |

## 6. Remaining defects and boundaries excluded for safety

| Item | Why excluded | What it needs |
|---|---|---|
| **Consent screen (M-5)** | Its body is a legal summary of the Privacy Policy and Terms, in ES and EN side by side. A French screen requires legal translation and review (Québec consumer-language rules may apply; legal must confirm). The chrome (title, buttons, decline alert) is inseparable from that bilingual layout and its acceptance flow, so it was not changed. Dictionary keys `consent.*` already exist in en/es/fr-CA and are unused. | Legal translation and approval, then a separate authorization |
| Consent flow for French users | While the gate is off, French can't be selected, so no user reaches it in French. If the gate were enabled, French users would see the ES/EN consent screen. **This is a release blocker for enabling French.** | Legal work above |
| `useAudioPlayer` still holds a Spanish string internally | Changing the hook would touch the protected audio lifecycle and conflict with PR #72. The display is already localized. | Optional error-code change after #72 lands, separately authorized |
| `useClubSession` stores the raw server message | Same reason (protected session hook; PR #72 edits it). The display is mapped. | — |
| `ReaderScreen` error text frozen at the language active when the error occurred | Reader state is protected; the text is already localized | Optional, separately authorized |
| Icon-only controls without accessibility labels (audio bar ◀15/▶/15▶/speed/✕, live-session play button, member avatars) | Adding new labels is new accessibility scope, not localization of existing labels | Recommended follow-up (small) |
| Club join error `already_member` falls to the generic message | Behavior, not localization | Optional |
| Login 429 shows the generic error (web shows "too many attempts") | No raw text is exposed; parity is optional | Optional |
| `navigation/TabNavigator.tsx` | Unused legacy navigator with no labels | Remove (separate decision) |
| Paywall prices and push notification text | USD-only / PR #60; push content is B2 | — |

## 7. French gating and privacy verification

- **Gate:** `EXPO_PUBLIC_FR_CA_ENABLED` is not set anywhere. B1-B adds no new route to French.
  - The language screen hides French by default and for `TRUE`, `1`, `yes`, `' true'` and `''`. It offers French only for exactly `true` (golden spec, gate block).
  - All new French copy is reached only through the active interface language, which can't be `fr-CA` while the gate is off (Checkpoint A provider, unchanged).
- **Preferences and privacy:** `i18n/index.tsx` and `i18n/locales.ts` are unchanged. Checkpoint A tests still pass:
  - stored `fr-CA` is ignored while gated;
  - malformed and legacy values are ignored;
  - es/en preferences are kept;
  - the server preference never leaks another account's device value;
  - anonymous users keep the local preference.
- **Navigation state (M-1):** the navigators read the language context and re-render with the same navigator type, keys, route names and screen component references, so React Navigation keeps every screen mounted and its state. Tested by comparing the ES and EN navigator trees. A runtime switch inside a real `NavigationContainer` needs a renderer (PR #69) or device QA (§10).
- **No French legal exposure:** the consent screen renders identically in fr-CA and ES (asserted), with no French legal text.

## 8. Unit tests, coverage, typecheck and lint (local, Node 20, `--maxWorkers=2`)

| Check | Checkpoint A (#78) | B1-B |
|---|---|---|
| Mobile unit tests | 198 passed (27 suites) | **257 passed (31 suites)** |
| Mobile coverage stmts / branches / funcs / lines | 30.76 / 16.29 / 22.48 / 32.35 | **44.2 / 35.84 / 31.57 / 47.19** |
| Mobile typecheck (`tsc --noEmit`) | pass | pass |
| Lint | no mobile lint script | — |
| API / web | untouched | untouched |

## 9. Existing versus introduced CI failures

- **Introduced:** none. Every test passes; typecheck passes.
- **Pre-existing:** the mobile 80% coverage gate fails on `main`, on #78 and here. B1-B raises every metric but does not reach 80% (CI-4 plan, issue #68). The api branch-coverage gap and the E2E environment failure (PR #64) are unrelated and unaffected.
- No threshold, Jest config, CI file or dependency changed. CI does not run on this stacked PR (§1).

## 10. Dependencies on PRs #69, #70 and #72

- **No file overlap.** #69, #70 and #72 change `package.json`, `tests/__mocks__/react-native.ts`, `tests/support/*`, hook specs and `LibraryScreen.spec.ts`. #72 changes `useAudioPlayer.ts` and `useClubSession.ts`. **B1-B changes none of these.**
- **Compatible assertions:**
  - #69's `LibraryScreen.spec.ts` asserts Spanish header and section text, which B1-B keeps, and English section titles, which are unchanged. It does not assert the English header.
  - #70 asserts only that the audio error is a non-empty string, which still holds because the hook is unchanged.
- **#72's hook fixes** are independent: B1-B maps the hooks' outputs at display time.
- **Existing conflict, not introduced by B1-B:** #70 and #72 add `tests/unit/i18n/index.spec.ts`, which #78 also creates (PR #79 §9).
- **Rendering limitation:** without `react-test-renderer` (#69), B1-B tests cover the first render with stubbed hooks. They do not run effects, async loading or user interaction. A full render pass, including a runtime language switch inside `NavigationContainer`, is recommended after #69 lands, or on a device.

## 11. Protected-systems confirmation

Untouched:
- API transactional emails and push content;
- payments, Stripe, subscriptions, `PAYMENTS_ENABLED`, paywall;
- USD-only policy (no CAD, no exchange rates);
- the 2.22% Causas commitment;
- Noetia+/NoetiaX "Coming Soon";
- book ownership and reading progress;
- Escucha Activa synchronization and the audio lifecycle (`useAudioPlayer`, `useClubSession`, `ReaderScreen`, live-session audio effects);
- NEM-026 ingestion and publication;
- legal agreements, the consent screen and consent records;
- schema, infrastructure, CI thresholds and production configuration.

All three French gates are untouched and off.

## 12. Draft PR

See the PR this report belongs to (base `feat/nem-025-checkpoint-a`). The head SHA is given in the PR comment that publishes this report.

## 13. Remaining blockers (not implemented; outside B1-B)

| # | Blocker | Kind |
|---|---|---|
| R-1 | French consent screen needs legal translation and approval (M-5) | Legal |
| R-2 | Qualified Canadian-French review of all mobile fr-CA copy; terminology D-T1 to D-T6 (e.g. "Clavardage", "Séance", "vous") | Linguistic |
| R-3 | French visual QA on devices (tab bar at 11 pt, buttons, live-session header); automated checks only bound tab-label length | Testing |
| R-4 | Full rendering and runtime language-switch tests need `react-test-renderer` (PR #69, not authorized here) or device QA | Testing |
| R-5 | Push notification language and content (B2) | B2 |
| R-6 | Integration: rebase and re-verify against #69/#70/#72 and #60 (mobile paywall keys) before any merge; CI evidence missing on the stacked PR | Integration |
| R-7 | Optional hook-level error codes for `useAudioPlayer`/`useClubSession` after #72 | Audio/session (separate authorization) |

**MANDATORY STOP AFTER B1-B — awaiting independent Product Architecture review.**
