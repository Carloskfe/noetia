# NEM-025 Checkpoint B: localization surface inventory

**Basis:** PR #78 (Checkpoint A) head `81143790e661126dbf862201565d6c98ab111019`, on `main` `8f2f294`.

**Method:**
- An automated scan of every `.ts`/`.tsx` file outside the dictionaries for JSX text, literal UI attributes (`placeholder`, `aria-label`, `title`, `alt`, `accessibilityLabel`), inline `es`/`en` ternaries and bilingual object literals, plus a manual review of string literals passed to `setError`, `alert`, `confirm` and `Alert.alert`.
- The scan is a heuristic: counts are lower bounds. The proposed corrections are design only; nothing is implemented.

**Status legend:**
- **GAP:** a fr-CA user sees Spanish or English.
- **PRE-EXISTING:** also wrong for EN or ES users today.
- **OK-NAME:** a legitimate untranslated name, title, quotation or address.

Word counts are approximate source words in the file (bilingual files contain ES + EN).

## 1. Web: inline bilingual pages (copy outside the dictionaries; fr-CA falls back to English)

| File | Inline ternaries / bilingual objects | ~Words | Status | Proposed correction |
|---|---|---|---|---|
| `app/(library)/upload-guide/content.tsx` | 68 ternaries, 115 JSX texts, 8 attrs | 1 548 | GAP (largest single surface; author supply chain) | Move to a new `uploadGuide` dictionary namespace (es/en/fr-CA); replace `l === 'es' ? … : …` with `t.uploadGuide.*` |
| `app/(corporate)/company/content.tsx` | 8 / 15 | 603 | GAP | `corporate.company` namespace |
| `app/(corporate)/about/content.tsx` | 8 / 6 | 602 | GAP | `corporate.about` |
| `app/(corporate)/trust/content.tsx` | 5 / 12 | 489 | GAP (privacy/trust statements: legal-adjacent) | `corporate.trust`; legal review of the FR wording |
| `app/(corporate)/how-we-build/content.tsx` | 6 / 19 | 1 082 | GAP | `corporate.howWeBuild` |
| `app/(corporate)/milestones/content.tsx` | 6 / 18 | 733 | GAP | `corporate.milestones` (contains the 2,22 % Causas line) |
| `app/(corporate)/careers/content.tsx` | 5 / 12 | 760 | GAP | `corporate.careers` |
| `app/(corporate)/team/content.tsx` | 6 / 5 | 414 | GAP | `corporate.team` |
| `app/(corporate)/contact/content.tsx` | 4 / 8 | 410 | GAP (addresses OK-NAME) | `corporate.contact` |
| `app/(corporate)/_components.tsx` | 8 / 6 | — | GAP: its own **ES/EN toggle** bypasses `LanguagePicker` and the fr-CA gate; "Iniciar sesión"/"Crear cuenta" literals | Replace the toggle with `LanguagePicker` (gate-aware); labels from `t.landing.nav` |
| `app/causas/page.tsx` | 16 / 9 | 687 | GAP (2.22 % commitment copy; **must not change the figure**) | `causasPage` namespace; FR keeps "2,22 %"; reuse the existing test pattern |
| `components/BookGrid.tsx` | `LANG_LABELS` | — | GAP (language badge labels) | Badge labels from the dictionary; the book language stays ISO (`fr`) |
| `app/s/[id]/page.tsx` | 1 (`pickLang()` es/en from `Accept-Language`) | — | GAP (public invite page) | Map `fr*` → `fr-CA` **only when the gate is on** |

## 2. Web: surfaces with no i18n at all (Spanish or English literals)

| File | Examples | Status | Proposed correction |
|---|---|---|---|
| `app/(account)/account/billing/page.tsx` (no `useTranslation`) | "Cargando…", "Facturación", "No tienes un plan activo." (14 texts) | **PRE-EXISTING** (EN users see Spanish) + GAP | Use the existing `t.billing.*` keys, which already exist in en/es/fr-CA. **Note:** PR #60 rewrites billing copy, so coordinate |
| `components/WaitlistForm.tsx` | "¡Ya estás en la lista!", "Te avisaremos por correo…" (6 + 2 attrs) | PRE-EXISTING + GAP | `waitlist` namespace |
| `components/EmailVerificationBanner.tsx` | "¡Correo enviado!", "Cerrar" | PRE-EXISTING + GAP | `account.confirmEmail*` keys + `common.close` |
| `app/onboarding/interests/page.tsx` | "¿Qué te interesa leer?" | PRE-EXISTING (a key exists: `onboarding.interests.title`) | Use the key |
| `app/(library)/discover/collection/[slug]/page.tsx` | "Volver", "Colección" | PRE-EXISTING + GAP | `common.back`, new `discover.collection` |
| `app/(clubs)/clubs/[id]/sessions/[sessionId]/live/page.tsx` | `setError('Sesión no encontrada.')`, "No se pudo cargar la sesión." | PRE-EXISTING + GAP | `clubs.sessions.errors.*` |
| `app/(clubs)/clubs/[id]/page.tsx` | `confirm('¿Salir del club?')`, `alert('Enlace copiado al portapapeles')` | PRE-EXISTING + GAP | `clubs.page.leaveConfirm`, `clubs.page.linkCopied` |
| `components/ClubSessionCard.tsx` | `confirm('¿Cancelar esta sesión?')` | PRE-EXISTING + GAP | `clubs.sessions.cancelConfirm` |
| `app/(clubs)/clubs/new/page.tsx` | `setError('Select a starting book.')` | PRE-EXISTING (ES users see English) + GAP | `clubs.create.bookRequired` |
| `components/ClubDiscussion.tsx` | "Frase #", aria "Delete" | PRE-EXISTING + GAP | dictionary keys |
| `components/ClubChat.tsx` | aria "Delete" | PRE-EXISTING + GAP | `common.delete` |
| `components/EscuchaJuntosRoom.tsx` | "Este libro no tiene audio disponible.", aria "Playback position" | PRE-EXISTING + GAP | `clubs.live.*` |
| `components/ClubCard.tsx` | "1 token" | GAP | `clubs.tokenRequired` |
| `components/PlanCard.tsx` (no i18n) | "Current plan" | PRE-EXISTING + GAP | `pricing.currentPlan` (exists) |
| `app/(account)/layout.tsx` | "Account" | PRE-EXISTING + GAP | `account.title` |
| `app/(library)/profile/page.tsx` | attr "Cuenta" | PRE-EXISTING + GAP | `account.title` |
| `app/auth/callback/page.tsx` | "Signing you in…" | PRE-EXISTING + GAP | `auth.login.submitting` or a new key |
| `app/(social)/social/page.tsx` | "Share" | PRE-EXISTING + GAP | key |
| `app/(legal)/legal/LegalPage.tsx` | "Versión MVP — sujeta a revisión legal", ES/EN document toggle | GAP (legal; see §5) | Gate-aware toggle; FR documents are a legal dependency |
| `app/(reader)/reader/[id]/page.tsx` | "10s" labels | OK-NAME (units) | none |
| `components/ReaderTopBar.tsx` | "A−", "A+" | OK-NAME (symbols); aria labels already keyed | none |
| `components/Footer.tsx`, `AppTopBar.tsx`, `WelcomeSplash.tsx` | "NOETIA", addresses | OK-NAME | none (addresses change only per the PR #75 rename plan) |
| `app/(admin)/author/page.tsx` (no i18n) | "Portal de autores", "Publica tu libro…" (34 texts, 9 attrs) | PRE-EXISTING (Spanish-only author portal) + GAP | `authorPortal` namespace. **Product priority #2 (authors)**; PO to decide whether the author portal is in Checkpoint B scope |
| `app/(admin)/admin/page.tsx` (no i18n) | "Usado", "Expirado", "Disponible" (31 texts) | Internal admin tool | Recommend **out of scope** (internal staff tool); PO decision |
| `app/LandingContent.tsx` | (scan hits are SVG icon names) | OK | none |

**Server error strings surfaced verbatim:** `lib/api.ts:65` throws `data.message`. `login`, `register` and `confirm-email` show `err.message` before the localized fallback. API messages are English ("Invalid credentials", "Invalid or expired reset token"). **PRE-EXISTING** (ES users see English) and a GAP. Proposed: map by HTTP status or error code on the client, and never display a raw server message.

**Metadata / SEO (19 files with static `metadata`):**
- Files: `app/layout.tsx` (static `<html lang="es">`, `openGraph.locale='es_LA'`), `app/page.tsx`, `(auth)/layout.tsx`, `(library)/layout.tsx`, `(clubs)/layout.tsx`, `(billing)/pricing/layout.tsx` (also has the stale "$9.99" fixed on PR #60), 8 corporate pages, `upload-guide/page.tsx`, 3 legal pages and `s/[id]/page.tsx`.
- **No fr-CA SEO is possible without a locale-routing design.** NEM-025 §5.6 requires a design and a **STOP for PA before any route migration**.

## 3. Mobile

| File | Examples | Status | Proposed correction |
|---|---|---|---|
| `src/navigation/MainNavigator.tsx` | `TAB_LABELS` = Biblioteca / Clubes / Fragmentos / Cuenta; `headerBackTitle: 'Clubes'` | **PRE-EXISTING** (EN users see Spanish tabs) + GAP | Tab labels from `t` (needs a `nav` namespace); the navigator must re-render on a language change |
| `src/screens/ConsentScreen.tsx` (no i18n) | "Privacidad y Términos", "Política de Privacidad", ES/EN document toggle, `Alert.alert` (17 texts) | GAP; **legal** (consent gate) | Gate-aware; FR legal text is a legal dependency (see §5) |
| `src/auth/SocialAuthButtons.tsx` (no i18n) | "o continúa con", "Continuar con Google/Facebook" (also `accessibilityLabel`) | PRE-EXISTING + GAP | `auth.social.*` keys (web already has `auth.socialAuth`) |
| `src/components/AudioPlayerBar.tsx` | "Cargando…" | PRE-EXISTING + GAP | `common.loading` |
| `src/hooks/useAudioPlayer.ts:102` | `setError('No se pudo cargar el audio.')` | **PRE-EXISTING defect M-D4** (CI-4.1) | Return an error code; the screen renders `t` |
| `src/screens/library/LibraryScreen.tsx` | "Biblioteca" header | **PRE-EXISTING defect M-D1** (CI-4.0); also **M-D2** (stale `t` in `load` callback) | `t.library.title`; fix the callback dependencies |
| `src/screens/clubs/LiveSessionScreen.tsx` | "Chat en vivo" | PRE-EXISTING + GAP | key |
| `src/screens/clubs/ClubScreen.tsx` | `Alert.alert('Error', …)` | PRE-EXISTING + GAP | `common.error` |
| `src/screens/LanguageScreen.tsx` | option sub-labels ("Latin America", "Inglés", "French (Canada)") | Minor GAP | Sub-labels from the dictionary |
| Push notification display (`src/hooks/usePushNotifications.ts`) | the server builds the text; the client only displays it | see the transactional inventory | — |

**Rendering-test gap:** `react-test-renderer` is **not on `main`** (added by CI-4.0, PR #69, unmerged). No mobile screen can be render-tested today, and adding the dependency is outside preparation scope.

## 4. Transactional communications (API)

### 4.1 Email (`services/api/src/email/email.service.ts`, 8 templates, `type Lang = 'es' | 'en'`, ~69 inline `isEn` ternaries)

| Flow | Caller | How the language is chosen today | Status |
|---|---|---|---|
| Email confirmation at **registration** | `auth.service.ts:28` | **No language passed → always Spanish** | **PRE-EXISTING** (EN registrants get Spanish) |
| Email confirmation **resend** | `auth.service.ts:52` | `user.uiLanguage as 'es'\|'en'` (fr-CA → Spanish) | fr-CA GAP |
| Password reset | `auth.service.ts:169` | `uiLanguage` cast | fr-CA GAP (security-critical) |
| Account deletion (farewell) | `users.service.ts:74` | `uiLanguage` cast | fr-CA GAP |
| Gift card to **recipient** (often a non-user) | `gifts.service.ts:121` | none → Spanish | PRE-EXISTING; recipient language unknown |
| Gift confirmation to buyer | `gifts.service.ts:124` | none → Spanish | PRE-EXISTING |
| Plan (Duo/Family) invite (invitee may be a non-user) | `subscriptions.service.ts:383` | none → Spanish; inviter fallback name "Un usuario" | PRE-EXISTING |
| Waitlist confirmation / invite | `waitlist.service.ts:27,40` | none → Spanish; fallback name "lector/a" | PRE-EXISTING |
| **Designed, not built:** payment-exception, resolution, duplicate-book refund and gift-redeemed notices | PR #60 R2 addenda B/E | — | must ship with fr-CA from the start if built after Checkpoint B |

### 4.2 Push (`services/api/src/push/push.service.ts`, `buildContent(lang)` with `en = lang === 'en'`)

| Type | Sender | Copy today | Status |
|---|---|---|---|
| `invite_accepted` | `subscriptions.service.ts:419` | ES/EN | fr-CA GAP |
| `gift_claimed` | `gifts.service.ts:160` | ES/EN | fr-CA GAP |
| `club_session_scheduled` | `club-sessions.service.ts:56` | **falls to `default`: title "Noetia", body `String(vars.message ?? '')` = empty** | **PRE-EXISTING defect** (empty body for every language) |
| `club_nearby_comment` | `club-discussions.service.ts:68` | same `default` → empty body | **PRE-EXISTING defect** |
| `club_new_book` | `club-books.service.ts:58` | same `default` → empty body | **PRE-EXISTING defect** |

## 5. Legal and consent surfaces (legal dependency, not an engineering translation task)

- `services/web/lib/legal/{terms-of-service,privacy-policy,cookie-policy}.ts` (ES + EN; ~1 634 / 1 762 / 534 words).
- The web `LegalPage` toggle and the mobile `ConsentScreen` offer ES/EN only.
- French versions require legal translation and review. Québec French-language requirements for consumer contracts may apply **before** a Québec user can consent. This is not legal advice; legal must confirm.
