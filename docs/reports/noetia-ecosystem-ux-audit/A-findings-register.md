# Appendix A — Findings Register

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md). **Review only; no finding is an implementation authorization.**

## How to read this register

**Evidence references** use the form `branch@commit:path:line`.

| Branch | Commit | Permalink root |
|---|---|---|
| `main` | `6a5e5c0` | <https://github.com/Carloskfe/noetia/blob/6a5e5c0850a73a9de432be87d5be647bd138dbe7/> |
| `feat/nem-024-checkpoint-b` (Draft PR #56, **not on main**) | `860f531` | <https://github.com/Carloskfe/noetia/blob/860f53168e1a994cdb9edeb5c0c211cefe99ce50/> |
| `docs/nof-004-legal-benchmark-audit` (Draft PR #23) | `8b0e4f9` | <https://github.com/Carloskfe/noetia/blob/8b0e4f9b9d578c3bba8c35249af055f3e5d14734/docs/reports/2026-11-02-NOF-004-legal-benchmark-audit.md> |
| `fix/nof-004-terms-annual-prices` (Draft PR #22) | `d254eea` | <https://github.com/Carloskfe/noetia/blob/d254eeab2a178c813c5a19598ab5b953bd1f6726/> |

**Evidence classes:**

- **VERIFIED:** directly supported by inspected source code, or by an image file actually viewed.
- **INFERRED:** a reasonable UX inference from code, not visually verified on a rendered screen.
- **PROPOSED:** the recommendation itself; every recommendation requires approval.

**Fields:**

| Field | Values |
|---|---|
| Priority | P0 (before customer acquisition or launch), P1 (next), P2 (later) |
| Effort | Low / Medium / High, relative |
| Approval | **PO** (Product Owner), **Legal** (qualified counsel), **Design** (design approval), **Eng-auth** (separately authorized engineering change) |

No rendered screen was captured in this assessment. All UI judgements are made from source; see [Appendix E](E-evidence-method-and-limitations.md).

---

## 1. Shared design system (SH)

### SH-01 — No design tokens

| Field | Detail |
|---|---|
| Product | Shared (Noetia, Noetia+, NoetiaX) |
| Component | Whole web UI |
| Source | `main@6a5e5c0:services/web/tailwind.config.ts:9` (`extend: {}`); `globals.css` holds only the Tailwind directives |
| Existing behaviour | No colour, type, spacing or radius tokens. Palette usage counted across `app/` and `components/`: `text-gray` 542, `border-gray` 200, `bg-gray` 159, `bg-blue` 143, `text-blue` 98, `ring-blue`/`border-blue` 45 each, `indigo` about 84, `emerald` 17 in total. Navy `[#0D1B2A]` appears 71 times as an arbitrary value |
| Problem | Brand colours (navy `#0D1B2A`, emerald `#34D399`) are not the UI colours; Noetia+ and NoetiaX would inherit the drift |
| Recommendation | A semantic token set ([main report §6](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md#6-shared-visual-design-system)) as CSS variables and Tailwind theme; a codemod to replace raw palette classes; a lint rule |
| Evidence | VERIFIED (counts); PROPOSED (fix) |
| Priority / effort | P0 / High |
| Approval | Design, PO |

### SH-02 — No web font

| Field | Detail |
|---|---|
| Product | Shared |
| Component | Root layout |
| Source | `main@6a5e5c0:services/web/app/layout.tsx:21` (no `next/font`); `font-serif` 0 uses, `font-sans` 2, `font-mono` 6 |
| Existing behaviour | The browser's default sans-serif stack everywhere. The quote-card editor already offers Playfair, Merriweather, Lato, Montserrat and Dancing Script (`public/presets`) |
| Problem | No editorial identity for a reading product; typography differs between the product and its own share cards |
| Recommendation | Self-hosted serif for reading and headings, sans for UI, via `next/font` |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 / Low |
| Approval | Design |

### SH-03 — Brand emerald unusable as an accent on light surfaces

| Field | Detail |
|---|---|
| Product | Shared |
| Component | Colour system |
| Source | Contrast calculation (WCAG relative luminance) |
| Existing behaviour | `#34D399` on white is **1.92:1**; on navy **9.05:1**. The landing Causas CTA uses white text on `emerald-500` (**2.54:1**) at `main@6a5e5c0:services/web/app/LandingContent.tsx:260` |
| Problem | The brand accent cannot carry text or button fills on light backgrounds |
| Recommendation | Emerald as an accent on navy only. On light surfaces use `#047857` (5.48:1) or `#065F46` (7.68:1). CTA: navy text on emerald-400 |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | Design |

### SH-04 — Mobile and web use different accents; no mobile theme

| Field | Detail |
|---|---|
| Product | Shared (mobile) |
| Component | React Native styles |
| Source | `main@6a5e5c0:services/mobile/src/**`: hex counts `#4F46E5` 45, `#0D1B2A` 33, `#6B7280` 31; no theme file; 0 `useColorScheme` or dark references |
| Existing behaviour | Indigo primary on mobile, blue on web, emerald nowhere |
| Problem | No single identity across platforms |
| Recommendation | A `theme.ts` mirroring the web tokens |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Design |

### SH-05 — Dark mode only in the reader

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | App shell, reader |
| Source | 3 `dark:` uses in `main@6a5e5c0:services/web/{app,components}`; reader hex constants at `components/PagedReader.tsx:208` |
| Existing behaviour | Reader light/dark is implemented with local hex values; the rest of the app is light-only, except the navy landing page |
| Problem | Inconsistent theming; reader theme isn't reusable |
| Recommendation | Token-driven light, dark and sepia themes app-wide |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P2 / High |
| Approval | Design |

### SH-06 — Accessibility signals

| Field | Detail |
|---|---|
| Product | Shared |
| Component | All web screens |
| Source | Counts in `main@6a5e5c0:services/web/{app,components}` |
| Existing behaviour | `text-gray-400` 120 uses (`#9CA3AF` on white is **2.54:1**); `text-xs` 248; `text-[10px]`/`[11px]` 20; `outline-none` 64; `focus:`/`focus-visible:` 191; `aria-*` 92; `role=` 19; `sr-only` 0; `motion-safe`/`motion-reduce` 0; about 120 emoji characters used as icons; 67 inline `<svg>` |
| Problem | Likely AA contrast failures and very small text; emoji read aloud by screen readers; no reduced-motion support (INFERRED: rendered contrast depends on backgrounds) |
| Recommendation | Token minimums (body ≥ 16 px, meta ≥ 13 px at ≥ 4.5:1); `focus-visible` ring token; an SVG icon set; `prefers-reduced-motion` |
| Evidence | VERIFIED (counts); INFERRED (rendered impact); PROPOSED |
| Priority / effort | P0 / Medium |
| Approval | Design |

### SH-07 — Server-rendered language is always Spanish

| Field | Detail |
|---|---|
| Product | Shared |
| Component | Root layout, i18n provider |
| Source | `main@6a5e5c0:services/web/app/layout.tsx:21` (`<html lang="es">`); `lib/i18n/index.tsx:31,42,52` (client-side correction) |
| Existing behaviour | English users get `lang="es"` on first paint until JavaScript runs |
| Problem | Screen readers and search engines receive the wrong language initially |
| Recommendation | Resolve the locale on the server (cookie, stored user preference, `Accept-Language`) |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Eng-auth |

### SH-08 — No logo, favicon or Open Graph image in the web app

| Field | Detail |
|---|---|
| Product | Shared |
| Component | `services/web/public`, `app/` |
| Source | `main@6a5e5c0:services/web/public` holds only `backgrounds/`, `covers/` and `presets/`; no `favicon`, `icon` or `opengraph-image` under `app/` |
| Existing behaviour | The wordmark is styled text "NOETIA"; social shares of the site have no image |
| Problem | Weak brand presence in tabs, bookmarks and link previews |
| Recommendation | SVG logo and wordmark, favicon set, Open Graph images per locale |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | Design, PO |

---

## 2. Noetia core (NC)

### NC-01 — Landing metadata mixes languages and makes an unverifiable claim

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Landing page |
| Source | `main@6a5e5c0:services/web/app/page.tsx:5,10,17`; `app/layout.tsx:7` |
| Existing behaviour | English title "Where knowledge becomes visible", Spanish description, English Open Graph description "The first Knowledge Expression Platform", `locale: 'es_LA'` |
| Problem | Mixed-language previews; "first … platform" is a superlative claim with no recorded substantiation |
| Recommendation | Locale-specific metadata; remove or substantiate the claim |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | PO |

### NC-02 — Landing page bypasses i18n; off-brand gradient; emoji icons

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Landing page |
| Source | `main@6a5e5c0:services/web/app/LandingContent.tsx` (27 inline `=== 'es' ?` ternaries; `:132` blue-to-indigo gradient headline; emoji feature icons at `:215`, `:251`) |
| Existing behaviour | Copy lives in the component, not in `es.ts`/`en.ts` |
| Problem | Not covered by the i18n parity test; brand drift |
| Recommendation | Move copy to i18n; brand accent; SVG icons |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Design |

### NC-03 — Registration shows no legal links, acceptance or age attestation

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Registration |
| Source | `main@6a5e5c0:services/web/app/(auth)/register/page.tsx` (no `legal`, `terms` or `privacy` reference); also NOF-004 F-13 (`docs/nof-004-legal-benchmark-audit@8b0e4f9`) |
| Existing behaviour | An account can be created without seeing the Terms; the Terms require users to be 18 or older |
| Problem | No evidence of acceptance; possible legal exposure |
| Recommendation | Acknowledgment step ([Appendix C §6](C-legal-assessment.md#6-legal-ux-and-acknowledgment-proposal)) |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | **P0** / Medium |
| Approval | PO, Legal, Eng-auth (acceptance evidence) |

### NC-04 — Billing page is Spanish-only

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Account → Billing |
| Source | `main@6a5e5c0:services/web/app/(account)/account/billing/page.tsx:139-140` and 11 further hard-coded strings |
| Existing behaviour | "Facturación", "No tienes un plan activo." regardless of language |
| Problem | English subscribers cannot read their billing state |
| Recommendation | i18n |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 / Low |
| Approval | — (translation within policy) |

### NC-05 — Navigation has no home for fragments, legal or premium

| Field | Detail |
|---|---|
| Product | Noetia (and future premium tiers) |
| Component | `BottomNav`, `AppTopBar` |
| Source | `main@6a5e5c0:services/web/components/BottomNav.tsx:13-44` (Library, Discover, Clubs, Profile); `components/AppTopBar.tsx` (Discover, Profile, Billing) |
| Existing behaviour | `/fragments` exists but isn't in the navigation; legal links only in the footer |
| Problem | Captured knowledge is hard to find; the future "Investigar" hub has no place |
| Recommendation | Five-item navigation ([main report §3](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md#3-noetia-core-uxui)) |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | PO, Design |

### NC-06 — Reader top bar is dense; size controls unlabeled

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Reader top bar |
| Source | `main@6a5e5c0:services/web/components/ReaderTopBar.tsx` (7 buttons, 3 links; literal glyphs "A−"/"A+" at `:111`) |
| Existing behaviour | Back, discover, clubs, font size, dark mode, audio, chapters, fragments and layout all compete in one bar |
| Problem | Cognitive load on small screens (INFERRED); glyph-only controls may lack accessible names |
| Recommendation | A reading-settings sheet; labeled controls; at most 5 visible controls |
| Evidence | VERIFIED (count); INFERRED (load); PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Design |

### NC-07 — Share editor complexity

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Share editor |
| Source | `main@6a5e5c0:services/web/components/ShareModal.tsx` (949 lines, 21 buttons, 8 inputs or selects) |
| Existing behaviour | Format, platform, font, bold, italic, alignment, colour, background, quote size and upload are all exposed together |
| Problem | High decision load for a first share, especially on mobile (INFERRED) |
| Recommendation | Progressive disclosure: Format → Background → Text → Advanced |
| Evidence | VERIFIED (count); INFERRED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Design |

### NC-08 — Share editor loads Google Fonts from Google's CDN

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Share editor |
| Source | `main@6a5e5c0:services/web/components/ShareModal.tsx:324` (`@import url(GOOGLE_FONTS_URL)`) |
| Existing behaviour | Opening the editor makes the browser request fonts from Google |
| Problem | The visitor's IP address goes to a third party not listed in the Privacy Policy |
| Recommendation | Self-host the five fonts |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | **P0** / Low |
| Approval | Legal (disclosure question); Eng-auth |

### NC-09 — Spanish-only and mixed-language strings outside i18n

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Multiple screens |
| Source | `main@6a5e5c0`: `app/(library)/discover/page.tsx:330-331`; `app/(library)/discover/collection/[slug]/page.tsx` ("Volver", "Colección"); `components/EmailVerificationBanner.tsx`; `components/WaitlistForm.tsx`; `components/CauseSelector.tsx`; `components/ClubDiscussion.tsx:116` ("Delete" in English); `components/EscuchaJuntosRoom.tsx:104` (`aria-label="Playback position"`) |
| Existing behaviour | Hard-coded Spanish, or English inside Spanish UI |
| Problem | No English parity; mixed-language UI |
| Recommendation | i18n; inventory in [Appendix B §4](B-content-audit-es-en.md#4-hard-coded-string-inventory) |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | — |

### NC-10 — Author portal and admin are Spanish-only, with an unsupported claim

| Field | Detail |
|---|---|
| Product | Noetia (author/company experience) |
| Component | Author portal, admin |
| Source | `main@6a5e5c0:services/web/app/(admin)/author/page.tsx:202` ("llega a miles de lectores"); 36 hard-coded strings; `app/(admin)/admin/page.tsx` (33) |
| Existing behaviour | Spanish only; claims an audience of thousands |
| Problem | Unsupported audience claim; no English for authors |
| Recommendation | Factual phrasing; i18n |
| Evidence | VERIFIED (strings); the claim's accuracy is a PO question; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | PO |

### NC-11 — Book-plan naming and benefit wording

| Field | Detail |
|---|---|
| Product | Noetia (affects premium positioning) |
| Component | Pricing, mobile paywall |
| Source | `main@6a5e5c0:services/web/lib/i18n/es.ts:378` (`title: 'Noetia Premium'`); `es.ts:354` ("Acceso completo a la biblioteca"); `services/mobile/src/i18n/es.ts` (paywall "Noetia Premium", "Acceso completo a la biblioteca"); NOF-004 F-3, F-15 |
| Existing behaviour | The book subscription is called "Premium"; "full library" wording |
| Problem | Collides with the premium tiers Noetia+ and NoetiaX (PO-025). "Full library" is ambiguous given token redemption and access rules |
| Recommendation | "Suscripción Noetia" / "Noetia subscription"; precise benefit list |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 / Low |
| Approval | PO, Legal (benefit wording) |

### NC-12 — Account deletion relies on a warning

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Delete-account modal |
| Source | `main@6a5e5c0:services/web/lib/i18n/es.ts:280` ("cancélala primero desde Facturación…"); NOF-004 F-1 (deletion does not cancel Stripe) |
| Existing behaviour | Copy asks the user to cancel first |
| Problem | Billing can continue after deletion |
| Recommendation | Show billing status inside the deletion flow (copy); engineering fix tracked separately in NOF-004 |
| Evidence | VERIFIED (copy); behaviour per NOF-004; PROPOSED |
| Priority / effort | P0 / Low (copy), Medium (engineering) |
| Approval | PO, Legal, Eng-auth |

### NC-13 — Emails: gendered slash and low-contrast footer

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | Transactional emails |
| Source | `main@6a5e5c0:services/api/src/email/email.service.ts:126` ("¡Bienvenido/a…"); `:141` footer `color:#CBD5E1` on white (1.48:1) |
| Existing behaviour | Bilingual by `lang`; no subscription or receipt emails (NOF-004 F-8) |
| Problem | Inclusive-language and contrast issues |
| Recommendation | "¡Te damos la bienvenida!"; footer at ≥ 4.5:1; legal links in the footer |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P2 / Low |
| Approval | — |

### NC-14 — Dead component with an unsupported claim

| Field | Detail |
|---|---|
| Product | Noetia |
| Component | `PlanCard` / `plan-utils` |
| Source | `main@6a5e5c0:services/web/lib/plan-utils.ts:10` ("Unlimited books"); `components/PlanCard.tsx` is not imported by any route |
| Existing behaviour | Unused, but the claim ships in the bundle |
| Problem | Risk of reuse with an incorrect claim |
| Recommendation | Remove or correct |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P2 / Low |
| Approval | Eng-auth |

---

## 3. Noetia+ (NP)

The only research UI is in **Draft PR #56** (`feat/nem-024-checkpoint-b@860f531`). It is **not on main**, and its release is blocked (E-1 OPEN, Checkpoint E NOT QUALIFIED).

### NP-01 — Entitlement errors collapse into one message

| Field | Detail |
|---|---|
| Product | Noetia+ / NoetiaX |
| Component | Research session errors |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:934-938` (`feature_disabled`, `no_entitlement`, `prerequisite_missing`, `policy_missing` and `capability_not_in_tier` all map to "Investigar con Noetia+ no está disponible para tu cuenta en este momento.") |
| Existing behaviour | One message for every entitlement cause |
| Problem | The user can't tell whether they need a book subscription (PO-026), Noetia+, or NoetiaX |
| Recommendation | Distinct, actionable messages per cause |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 (pre-launch) / Medium |
| Approval | PO (pricing TT-16), Design |

### NP-02 — No session creation or book-selection UI

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Session creation |
| Source | Only route is `feat/nem-024-checkpoint-b@860f531:services/web/app/(research)/research/[sessionId]/page.tsx`; nothing on main |
| Existing behaviour | Sessions are reachable only by id |
| Problem | The approved 3-book selection and lock (PO-027) have no UI |
| Recommendation | Book picker with counter, eligibility badges and pre-lock confirmation |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 (pre-launch) / High |
| Approval | PO (PO-029 is DRAFT), Design |

### NP-03 — Single-column layout

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Conversation |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/components/research/ResearchSession.tsx:372` (`max-w-3xl`, semantic `<section>`s, `dark:` variants) |
| Existing behaviour | A good minimal base |
| Problem | Sources and answer compete on desktop (INFERRED) |
| Recommendation | Two-pane desktop; citation sheet on mobile |
| Evidence | VERIFIED (structure); INFERRED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Design |

### NP-04 — Provenance labels

| Field | Detail |
|---|---|
| Product | Noetia+ / NoetiaX |
| Component | Answer origin labels |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:877-881` ("Del libro", "Síntesis", "Tus notas") |
| Existing behaviour | Origin shown per segment |
| Problem | "Síntesis" doesn't express ADR-003's "broader context, not from your books" |
| Recommendation | "De tus libros" / "Contexto general (no proviene de tus libros)" / "Tus notas", with a consistent icon and colour token |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P0 / Low |
| Approval | PO (PO-003 left final names to UX) |

### NP-05 — Modes not represented

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Modes |
| Source | No This Book / My Knowledge / Expand UI on main or `860f531` |
| Existing behaviour | — |
| Problem | Approved distinction (PO-003) invisible |
| Recommendation | Session-level mode chip with a one-line explanation |
| Evidence | VERIFIED (absence); PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | PO (names), Design |

### NP-06 — Ask My Highlights absent

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Fragment sheet entry |
| Source | No implementation on main or `860f531` |
| Existing behaviour | — |
| Problem | Approved separate boundary (PO-028) has no UI |
| Recommendation | Entry from the fragment sheet; highlight-only citations |
| Evidence | VERIFIED (absence); PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | PO (TT-27 open) |

### NP-07 — Citation opens the book where the reader left off

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Citation dialog |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:887` ("Abre el libro donde lo dejaste."); `components/research/CitationDialog.tsx` |
| Existing behaviour | "Abrir libro" opens the last reading position |
| Problem | The approved intent is a deep link to the cited phrase (`docs/noetia-plus/17-web-mobile-ux.md`, `?phrase=N`) |
| Recommendation | "Ir al pasaje" when a phrase position exists |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Medium |
| Approval | Eng-auth (reader change) |

### NP-08 — Jargon in research copy

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Read-only session |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:847,929` ("Bifúrcala para continuar") |
| Existing behaviour | Developer term "fork" |
| Problem | Unfamiliar to readers |
| Recommendation | "Continúa en una sesión nueva" / "Continue in a new session" |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | — |

### NP-09 — Usage communicated as "capacidad"

| Field | Detail |
|---|---|
| Product | Noetia+ / NoetiaX |
| Component | Budget messages |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:924` |
| Existing behaviour | "Has usado tu capacidad mensual para esta función." No meter |
| Problem | Vague; no way to anticipate limits |
| Recommendation | A usage meter in user-facing units |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P2 / Medium |
| Approval | PO (D10, TT-13) |

### NP-10 — No Research Brief or history UI

| Field | Detail |
|---|---|
| Product | Noetia+ / NoetiaX |
| Component | Research Brief |
| Source | No implementation on main or `860f531` |
| Existing behaviour | — |
| Problem | Approved artifact (PO-025) has no design |
| Recommendation | Brief view: every claim cited or labeled as general context |
| Evidence | VERIFIED (absence); PROPOSED |
| Priority / effort | P1 / High |
| Approval | PO, Design |

### NP-11 — Empty results for natural questions

| Field | Detail |
|---|---|
| Product | Noetia+ |
| Component | Empty or no-result state |
| Source | `feat/nem-024-checkpoint-b@860f531:services/web/lib/i18n/es.ts:860` (hint "Funcionan mejor las preguntas concretas…"); D13 in `docs/noetia-plus/20-open-product-decisions.md@860f531` |
| Existing behaviour | Questions are ANDed term by term; PO-050 measured 7 of 15 question-form queries returning nothing |
| Problem | An empty answer gives the reader no grounded passage |
| Recommendation | An empty state with a concrete next action (keyword suggestion), without promising semantic search |
| Evidence | VERIFIED; PROPOSED |
| Priority / effort | P1 / Low |
| Approval | PO (D13) |

---

## 4. NoetiaX (NX)

NoetiaX is **APPROVED** (PO-025, PO-027) and **not implemented**. Every item is PROPOSED; evidence for the absence is VERIFIED (no NoetiaX strings or routes on main or `860f531`).

| ID | Journey | Recommendation | Prio / effort | Approval |
|---|---|---|---|---|
| NX-01 | Tier differentiation | Deep layout: source rail (10 books), evidence panel, Brief builder. The difference is capability, not the number 10 | P0 (design) / High | **PO: NoetiaX capability set** |
| NX-02 | Ten-book selection | Shared BookPicker with NP-02; grouping and search | P0 / Medium | PO-029 decision |
| NX-03 | Evidence comparison | Claim × book matrix (supports / contradicts / silent, each cited). **Proposal only** | P2 / High | PO |
| NX-04 | Disagreement and uncertainty | "Donde los libros discrepan"; verbal hedging, never numeric confidence | P1 / Medium | PO |
| NX-05 | Advanced citation inspection | Two passages side by side | P2 / Medium | Design |
| NX-06 | Saved research | Projects grouping sessions and Briefs (no knowledge graph at MVP) | P2 / High | PO, Eng-auth (data model) |
| NX-07 | Responsive complexity | Matrix collapses to per-claim cards at 360 px | P1 / Medium | Design |
| NX-08 | States | Reuse the PR #56 stage and exclusion vocabulary | P1 / Low | — |

---

## 5. Content (CT) — detail in [Appendix B](B-content-audit-es-en.md)

Every row is VERIFIED from source on `main@6a5e5c0`, except CT-07, which is VERIFIED on `860f531`.

| ID | Language | Finding | Source | Prio / effort | Approval |
|---|---|---|---|---|---|
| CT-01 | ES | "Modo escucha activa" breaks the proper noun "Escucha Activa" | `services/web/lib/i18n/es.ts:158` | P1 / Low | — |
| CT-02 | ES | "Noetia Clubs" instead of "Clubes de Lectura" | `es.ts:403`; `app/(library)/discover/page.tsx:330` | P1 / Low | — |
| CT-03 | ES | Error template inconsistency: "Ocurrió un error. Intenta de nuevo." vs "Algo salió mal. Inténtalo de nuevo." | `es.ts:660` | P2 / Low | — |
| CT-04 | ES | Title Case "Mis Estadísticas de Lectura" | `es.ts:461` | P2 / Low | — |
| CT-05 | ES | Calques: "Tu cuenta no ha sido cobrada"; "Discute frase a frase" | `es.ts:308`, `es.ts:448` | P2 / Low | — |
| CT-06 | ES | Over-exclamatory empty state "¡Nadie ha escrito aún…!" | `es.ts:562` | P2 / Low | — |
| CT-07 | ES | Jargon "Bifúrcala" | see NP-08 | P1 / Low | — |
| CT-08 | EN | "Fragment" (about 30 occurrences) reads as a mechanical translation; English readers expect "highlight" | `services/web/lib/i18n/en.ts:150` and others | P1 / Medium | **PO** |
| CT-09 | EN | "Active Listening" translates a brand term | `en.ts:174` | P1 / Low | **PO** |
| CT-10 | EN | Terse system messages ("Registration failed") | `en.ts:56` | P2 / Low | — |
| CT-11 | Both | 12 marketing and corporate files bypass i18n with inline ternaries (upload-guide 53, landing 27, causas 15, corporate 4–8 each) | `app/LandingContent.tsx`, `app/(corporate)/*`, `app/causas/page.tsx`, `app/(library)/upload-guide/content.tsx` | P1 / Medium | — |
| CT-12 | Both | Unsupported claims: "first Knowledge Expression Platform", "primer intento deliberado… nueva categoría", "miles de lectores" | `app/page.tsx:10,17`; `app/(corporate)/company/content.tsx:53`; `app/(admin)/author/page.tsx:202` | P1 / Low | **PO** |
| CT-13 | Both | "Causas" claims "donado automáticamente … desde el primer día"; the donation mechanism was not verified in this assessment | `app/(corporate)/milestones/content.tsx` | P1 / Low | **PO** (verify) |

---

## 6. Legal (LG) — detail in [Appendix C](C-legal-assessment.md)

The legal source files contain both languages: Terms ES lines 3–98, EN 100–195; Privacy ES 3–100, EN 102–199; Cookies ES 3–43, EN 45–85. All rows are VERIFIED on `main@6a5e5c0` unless marked.

| ID | Document | Finding | Source (ES / EN) | Prio | Approval |
|---|---|---|---|---|---|
| LG-01 | All | One date for all three documents: `LegalPage` and every document import `LAST_UPDATED` from the cookie policy | `app/(legal)/legal/LegalPage.tsx:1`; `lib/legal/cookie-policy.ts:1`; `terms-of-service.ts:1`; `privacy-policy.ts:1` | **P0** | Eng-auth (presentation); Legal (dates) |
| LG-02 | All | Raw Markdown rendered inside `<pre>`; `prose` classes inert (no `@tailwindcss/typography` in `package.json`) | `LegalPage.tsx:25,29` | **P0** | Design, Eng-auth |
| LG-03 | All | Always side by side; flag emoji as language labels; combined "ES / EN" H1 | `LegalPage.tsx:14,24,28` | P1 | Design |
| LG-04 | All | Low-contrast status text: MVP banner amber-600 (3.19:1); date `text-gray-400` (2.54:1) | `LegalPage.tsx:16-17` | P1 | Design |
| LG-05 | Terms | Annual prices $80.99 / $125.99 / $170.99; a correction to $83.99 / $129.99 / $179.99 is proposed in Draft PR #22 (`d254eea`), pending legal review | `terms-of-service.ts:25-27` / `:122-124` | **P0** | Legal, PO |
| LG-06 | Terms | Family "hasta 4 / up to 4 members" vs product `maxProfiles` 5 and UI "Hasta 5 usuarios" (NOF-004 F-12) | `terms-of-service.ts:27` / `:124`; `i18n/es.ts:362` | **P0** | PO, Legal |
| LG-07 | Terms | No permanent-ownership clause; §8 says content is "licensed to Noetia"; public domain described as "open licences" | `:79-81` / `:176-178` | **P0** | Legal, PO |
| LG-08 | Terms | Provider named as "Carloskfe / Noetia" rather than a legal entity | `:79` / `:176` | **P0** | Legal |
| LG-09 | Terms | Cancellation "from account settings" vs the Stripe portal only (NOF-004 F-7); "no partial refunds", with no statement of statutory withdrawal rights | `:38` / `:135` | **P0** | Legal |
| LG-10 | Terms | Promotional tokens expire after 30 days, undisclosed; 90 days disclosed (NOF-004 F-10). TT-01 remains open | `:31` / `:128` | P1 | Legal, PO |
| LG-11 | Terms | Spanish law and courts vs a New York operator (NOF-004 row 2) | `:93` / `:190` | P1 | Legal |
| LG-12 | Terms | No Noetia+/NoetiaX, AI or generated-content terms | whole document | **P0 before premium launch** | Legal, PO |
| LG-13 | Privacy | Controller "operada por Carloskfe"; no address or entity | `privacy-policy.ts:11` / `:110` | **P0** | Legal |
| LG-14 | Privacy | Processor list incomplete: Resend (email, per CLAUDE.md vendor table), hosting provider, Google Fonts (NC-08) missing; Apple Sign In listed although it appears not yet configured (INFERRED; verify) | `:58-66` / `:157-165` | **P0** | Legal |
| LG-15 | Privacy | Claims with no matching code found by NOF-004 (F-14): 2-year rolling purge, portability export | `:53,77` / `:152,176` | P1 | Legal, Eng-auth |
| LG-16 | Privacy | No research questions, conversations, AI processors, AI retention or training statement | whole document | **P0 before premium launch** | Legal, PO |
| LG-17 | Privacy | No international-transfers section | whole document | P1 | Legal |
| LG-18 | Cookies | `access_token`, `user_type` and `noetia_consent` described as cookies with "Session" or "1 year" durations; implemented as `localStorage` (persistent until cleared) | `cookie-policy.ts:20-22` / `:62-64`; `lib/consent-utils.ts:2`; `localStorage.setItem('access_token'…)` in `app/` | P1 | Legal |
| LG-19 | Cookies | `noetia_lang`, reader preferences and `email_confirmed` storage undisclosed | `lib/i18n/index.tsx:9`; reader `localStorage` keys | P1 | Legal |
| LG-20 | Cookies | Analytics category described ("30 days") but no analytics script found | `:24-29` / `:66-71`; no gtag/plausible/posthog/segment/fbq in `services/web` | P2 | Legal |
| LG-21 | Subscription | Pricing CTA shows "14 días de prueba gratuita. Cancela cuando quieras." with no auto-renewal statement or legal link nearby; trial not once per customer (NOF-004 F-5); no renewal notice | `i18n/es.ts:337`; `app/(billing)/pricing/page.tsx` | **P0** | Legal, PO |
| LG-22 | Subscription | "2 meses gratis" claim: annual equivalence depends on final annual prices (LG-05) | `i18n/es.ts:342` | P2 | PO |
| LG-23 | Trust page | States "we do not use AI to generate book content"; must be reconciled once AI answers and Briefs exist | `app/(corporate)/trust/content.tsx` | P1 before premium launch | PO, Legal |
| LG-24 | Mobile consent | Consent screen links to the side-by-side web legal pages; acceptance-evidence storage not inspected | `services/mobile/src/screens/ConsentScreen.tsx:62-94` | P1 | Legal, Eng-auth |

---

## 7. Visual assets (VA) — detail in [Appendix D](D-visual-assets.md)

All files were viewed as contact sheets and measured. Every row is VERIFIED on `main@6a5e5c0`.

| ID | Finding | Source | Prio / effort | Approval |
|---|---|---|---|---|
| VA-01 | 18 backgrounds in four aspect ratios (1200×1200 ×14, 1200×800 ×2, 1200×960, 1200×1174) | `services/web/public/backgrounds/imagen-1…18.jpg` | P1 / Medium | Design |
| VA-02 | Too small for 1080×1920 story formats without upscaling (1200×800 gives about a 450 px-wide strip) | same | P1 / Medium | Design |
| VA-03 | Text legibility, measured strictly as worst case (contrast against the 5th/95th-percentile pixel luminance in the central 60% region, below 4.5:1 = fail). White text fails on 1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18. Black fails on 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 15, 16, 17. Both fail on 1, 2, 4, 8, 10, 11, 12, 15, 16. Median-pixel contrast is adequate for one colour on most images (Appendix D). *Correction:* the in-session summary listed only 2, 4, 11, 12, 15, 16 as failing both | measured; method in Appendix D | P1 / Low (scrim token) | Design |
| VA-04 | imagen-12 (elephant) is the busiest (luminance stddev 56) | same | P2 / Low | Design |
| VA-05 | Local covers are inconsistent in style; *El líder que no tenía cargo* is off-system | `services/web/public/covers/*.png` | P1 / Medium | Design, PO |
| VA-06 | *Cuentos de la Selva*: title visibly collides with the author line | `covers/cuentos-selva.png` (viewed) | P1 / Low | Design |
| VA-07 | Covers are 400×600 (below 2× for about 300 px display); tiny labels unreadable at grid size | `covers/*.png` | P2 / Medium | Design |
| VA-08 | Images delivered without modern formats: 4 `next/image` uses vs 5 `<img>`; JPEG and PNG only | `services/web/{app,components}` | P2 / Low | Eng-auth |
| VA-09 | CLAUDE.md describes "imagen-1..5 + upload-slot"; 18 images now exist | `CLAUDE.md` (project structure) | P2 / Low | — |
