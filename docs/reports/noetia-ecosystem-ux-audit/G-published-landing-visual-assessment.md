# Appendix G — Published Landing-Page Visual Assessment and Design Reconciliation

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md) (Draft PR #57).

**Authorization:** Product Owner, 2026-11-12, documentation-only design reconciliation, plus the PO clarification on LP-07 (Causas Noetia).
**Status:** PROPOSED specification. **No implementation authorized.** Independent PA review AWAITING; PO approval NOT GRANTED.

**Evidence labels:**

| Label | Meaning |
|---|---|
| **VERIFIED** | Inspected source code, or a capture viewed by the author of this appendix |
| **OBSERVED** | Product Architect observation of the Product Owner's screenshots (not viewed directly here) |
| **INFERRED** | Reasoned, not directly seen |
| **PROPOSED** | Recommendation requiring approval |

Appendices A–F are **retained unchanged**. Relationships to earlier findings are recorded in §5.9.

---

## 1. Scope and evidence provenance

| Source | What it is | Status |
|---|---|---|
| PO screenshots 1–5 (English landing page) | Held in the PO's ChatGPT conversation; **not available in this session**. Their content is used only as the PA's written observations | OBSERVED |
| **Passive public capture** of `https://noetia.app/`, 2026-11-12 | Headless Chromium (Playwright Core 1.61.1). **No sign-in, no account, no clicks, no development stack.** Variants: desktop 1440×900 and mobile 390×844, each in English and Spanish (language set via the site's own `noetia_lang` storage key). Full-page PNGs plus DOM facts | VERIFIED |
| Repository source | `main@6a5e5c0`: `services/web/app/LandingContent.tsx`, `app/layout.tsx`, `components/Footer.tsx`, `components/CookieBanner.tsx`, `app/causas/page.tsx`, `components/CauseSelector.tsx`, `lib/i18n/{es,en}.ts`, `services/api/src/{causes,personas,fragments/theme-taxonomy.ts}`, `docs/business/{en,es}/01-*.md` | VERIFIED |

**Limits of the capture:**
- It shows the deployed site; the deployed commit isn't exposed publicly, so its correspondence to `main@6a5e5c0` is **INFERRED**. The page structure matches the source exactly.
- **Captures are not committed** (this deliverable is Markdown only). They were stored in the session scratch directory and can be reproduced with §24.1.
- Not captured: tablet widths, dark/light system-preference effects, other browsers and real devices, and interaction states (hover, focus, menu).

**DOM facts recorded by the capture (VERIFIED):**

| Variant | Page height | `<html lang>` | `<title>` | `<footer>` elements | Images | Body font |
|---|---|---|---|---|---|---|
| desktop-en | 3,576 px | en | "Noetia — Where knowledge becomes visible" | **2** | 0 | `ui-sans-serif, system-ui, …` |
| desktop-es | 3,645 px | es | **same English title** | **2** | 0 | system stack |
| mobile-en | 5,688 px | en | English | **2** | 0 | system stack |
| mobile-es | 5,735 px | es | **English** | **2** | 0 | system stack |

## 2. GitHub baseline

| Item | Value |
|---|---|
| PR #57 | Draft, open, head **`1b730c6`** at start (matched the expected head) |
| `main` | `6a5e5c0850a73a9de432be87d5be647bd138dbe7` (unchanged) |
| Branch | `docs/noetia-ecosystem-ux-audit-20261112` |
| Concurrent edits | None detected on the landing, footer or layout files (no newer commits on `main`; branch head as expected) |
| Product boundaries re-read | PO-025 (three tiers; NoetiaX qualitatively deeper), PO-026 (premium requires an Individual/Duo/Family subscription), PO-027 (3/10 books, lock at the first analysis), PO-028 (highlight boundary), PO-001 (advanced-reasoning workload class includes cross-book synthesis and comparison; architecture policy, not a released feature), PO-052 (E-1 OPEN and BLOCKED; release BLOCKED) |

## 3. Screenshot observation matrix

| # | Section (PA observation) | Own capture | Source location (`main@6a5e5c0`) |
|---|---|---|---|
| 1 | Three steps "Absorb / Capture / Express"; navy; blue outline icons; centred text; large blue/indigo identity card | **VERIFIED.** The cookie banner overlays this section at desktop first view | `LandingContent.tsx:15-47` (FEATURES), section `:147-165`; identity card `:168-186` |
| 2 | Hero: corporate navigation; ES/EN switch; headline with blue/indigo gradient; two CTAs; no product visual | **VERIFIED.** Language switch sits inside the hero, not the header; 0 images on the page | nav `:6-13`, `:87-104`; hero `:107-145`; gradient `:132` |
| 3 | Clubs card; three sub-cards with emoji; blue "Explore clubs" button | **VERIFIED.** Emoji 💬 🎧 🗳️ | `:49-62` (CLUBS_FEATURES), section `:189-225` |
| 4 | Causas card; three emoji cause cards; emerald CTA; 2.22% "from day one" text | **VERIFIED.** Emoji 🐾 📚 🌿; white on `emerald-500` | `:64-77` (CAUSAS_FEATURES), section `:228-264` |
| 5 | Authors card; dark landing footer, then a separate white global footer | **VERIFIED.** Two `<footer>` elements on every variant | authors `:267-291`; landing footer `:294-310`; global `app/layout.tsx` → `components/Footer.tsx` |
| — | *Not in the PO's set:* mobile header | **VERIFIED.** Logo + "Create account" only; **no Sign in and no navigation menu** below 640 px; corporate links hidden below 1024 px with no menu fallback | `:89` `hidden lg:flex`; `:97` Sign in `hidden sm:block` |
| — | *Not in the PO's set:* cookie banner | **VERIFIED.** Fixed bottom banner; covers the primary hero CTA on mobile first view; "Accept all" is a filled blue button while "Essentials only" is outlined; text promises analytics cookies | `components/CookieBanner.tsx:54-63`; copy in `lib/i18n/*` `cookie` keys |

## 4. Verified source-code findings (summary)

1. **Two footers.** `app/layout.tsx` renders `<Footer />` for every route, and `LandingContent.tsx` renders its own `<footer>` (`:294-310`). `app/causas/page.tsx:239-240` repeats the pattern.
2. **Copy outside i18n.** All landing copy is in-component `l === 'es' ? … : …` ternaries (27). The eyebrow "Knowledge Expression Platform" (`:127-129`), the "Noetia Clubs" label (`:192-194`) and the landing footer tagline "Where knowledge becomes visible." (`:298`) are **English in both languages**.
3. **Colours.** Blue/indigo (`from-blue-400 to-indigo-400`, `bg-blue-600`, `from-indigo-900/60`), emerald only for Causas (`bg-emerald-500`, `text-emerald-400`); navy as an arbitrary value `bg-[#0D1B2A]`.
4. **Line breaks.** Headings contain `\n` inside strings (`:177-179`), which HTML collapses; the intended line breaks never render.
5. **Root layout.** `<html lang="es">` is server-rendered (`app/layout.tsx:21`), and the title metadata is English only (`app/page.tsx:5`).
6. **No web font** (computed body font is the system stack).

## 5. Findings LP-01 to LP-08

### LP-01 — Duplicate footer · **VERIFIED**

| Field | Detail |
|---|---|
| Evidence | Capture: two `<footer>` elements (dark landing strip, then the white global footer); PA screenshot 5 |
| Source | `services/web/app/layout.tsx` (global `<Footer />`); `services/web/app/LandingContent.tsx:294-310`; also `services/web/app/causas/page.tsx:239+` |
| Problem | Repeated brand ("NOETIA" twice), repeated links (Clubs, Causas, For authors, Contact), an abrupt navy-to-white change, and two "© 2026 Noetia" lines |
| Also VERIFIED | Global footer contrast failures: tagline and column headings `text-gray-400` (2.54:1), "Knowledge Expression Platform" `text-gray-300` (1.47:1), headings at `text-[10px]`. Landing footer text `slate-500` on navy (3.66:1) and tagline `slate-600` (2.30:1) |
| Recommendation | See §14: one global footer with a `tone` variant |
| Priority / effort | P0 / Low |

### LP-02 — The hero does not demonstrate the product · **VERIFIED**

| Field | Detail |
|---|---|
| Evidence | Capture: 0 images on the page; the hero is text and two CTAs; PA screenshot 2 |
| Source | `LandingContent.tsx:107-145` |
| Problem | The visitor never sees phrase-synchronized reading, capture or a quote card, the three things Noetia actually does today (implemented on `main`) |
| Recommendation | Static, code-rendered product demonstration (§10) |
| Priority / effort | P1 / Medium |

### LP-03 — Corporate-heavy primary navigation · **VERIFIED**

| Field | Detail |
|---|---|
| Evidence | Capture (desktop): About, Company, How we build, Team, Careers, Contact. Capture (mobile): no navigation at all, and **no Sign in link** |
| Source | `LandingContent.tsx:6-13` (NAV_LINKS), `:89` (`hidden lg:flex`), `:97` (`hidden sm:block`) |
| Problem | The reader journey (library, how it works, plans) is absent from the header. Returning users on phones have no visible way to sign in (the only Sign in link sits in the landing footer, about 5,500 px down) |
| Recommendation | §9 |
| Priority / effort | P0 (mobile Sign in) / Medium |

### LP-04 — Inconsistent visual vocabulary · **VERIFIED**

| Field | Detail |
|---|---|
| Evidence | Capture and classes: navy; blue/indigo headline gradient; indigo gradient card; blue eyebrows; blue CTA (Clubs); emerald CTA (Causas); outline SVG icons (three steps) next to emoji (Clubs, Causas); four card treatments |
| Source | `LandingContent.tsx:127,132,160,172,192,221,231,260` |
| Contrast (VERIFIED by calculation) | Body `slate-300` on navy 11.72:1 ✔; `slate-400` 6.78:1 ✔; blue-400 eyebrow 6.84:1 ✔; white on `blue-600` 5.17:1 ✔; **white on `emerald-500` 2.54:1 ✘**; navy on emerald-400 9.05:1 ✔; emerald-400 on navy 9.05:1 ✔ |
| Recommendation | §7 tokens and §17 components |
| Priority / effort | P1 / Medium (depends on the Package A token subset) |

### LP-05 — Excessive explanatory text · **OBSERVED + VERIFIED** (word counts)

| Field | Detail |
|---|---|
| Evidence | English word counts: hero sub-copy 28; three-step descriptions 22–26 each; identity card 46; clubs paragraph 39 plus three descriptions; Causas 48; authors 30. Mobile page height 5,688 px |
| Source | `LandingContent.tsx` FEATURES, `:136-139`, `:181-184`, `:198-201`, `:237-240`, `:283-286` |
| Problem | Long paragraphs carry ideas that a demonstration and short headings could carry. Repeated "not X, but Y" constructions ("not book chat groups", "not as a donation button", "not just digital distribution") |
| Recommendation | §15 copy (about 40–55% shorter) |
| Priority / effort | P1 / Low (copy), needs PO approval |

### LP-06 — Missing ecosystem positioning · **VERIFIED**

| Field | Detail |
|---|---|
| Evidence | Capture and source: no mention of Noetia+ or NoetiaX anywhere on the landing page |
| Source | `LandingContent.tsx` (whole file) |
| Constraint | Noetia+/NoetiaX are **APPROVED, not released** (release BLOCKED; E-1 OPEN). Any presentation must label them as in development, state the subscription prerequisite (PO-026) and the 3/10-book limits (PO-027), and promise no dates or unapproved capabilities |
| Recommendation | §12 |
| Priority / effort | P1 / Low–Medium (PO copy approval required) |

### LP-07 — Marketing accuracy and privacy · **VERIFIED** (sources) / PO-confirmed policy

**PO clarification (2026-11-12):** the 2.22% social contribution is established financial policy and a social commitment. There have been no sales yet, so no sales-funded contributions exist. The section **stays on the homepage**, with three priorities: animal welfare, children and youth, environment. The percentage and policy are not to be changed. The review is limited to (a) execution-related wording and (b) consistency of the documented mechanism.

**Claims review:**

| Statement (EN / ES; location) | Basis found | Classification | Concern | Proposed alternative (for PO review) |
|---|---|---|---|---|
| "**2.22% of every purchase** supports real social projects" / "el **2,22% de cada compra** apoya proyectos sociales reales" (`LandingContent.tsx:237-240`) | Business plan revenue split: **2.22% → Causas Noetia** (`docs/business/en/01-business-plan.md:186`; `es/01-plan-de-negocio.md:186`); Terms §3 "2,22 % de cada pago" (`terms-of-service.ts:44` / `:141`); PO confirmation | **Supported** as a commitment (PO-confirmed) | Present tense "supports" reads as contributions already flowing. Base differs: "purchase/compra" (landing) vs "payment/pago" (Terms, business plan, billing, cause selector) | EN: "We commit 2.22% of every payment to social causes." ES: "Destinamos el 2,22% de cada pago a causas sociales." |
| "…as part of how the platform **has operated from day one**" / "…desde el primer día" (`:239-240`); milestones "donado automáticamente … desde el primer día" (`app/(corporate)/milestones/content.tsx`) | Policy since launch (PO); **no sales yet** (PO); no allocation or payout ledger found in code (`services/api/src/causes/*` stores only user preferences; no reference from subscriptions or webhooks) | **Requires PO decision** (wording); execution claim **unverified** | "Has operated" and "donado automáticamente" describe executed transfers that, per the PO, haven't occurred yet | EN: "Built into Noetia's financial model from day one." ES: "Forma parte del modelo financiero de Noetia desde el primer día." |
| "**You choose the cause**" / "Tú eliges la causa" (`:239-240`) | **Three different mechanism descriptions:**<br>(1) landing: choose *the* cause (singular);<br>(2) `/causas` (`app/causas/page.tsx:74-75`): "choose up to two strategic lines… or distribute your contribution randomly across all three";<br>(3) `CauseSelector.tsx:121`: "Tu 2,22% se reparte equitativamente entre las tres causas" (split equally) | **Unverified / inconsistent** (which mechanism is policy?) | Users receive contradictory descriptions of where their contribution goes | PO to confirm one mechanism; then one sentence used everywhere, for example "You can choose up to two causes, or split it across all three." |
| Cause names | Product and DB seed: Bienestar Animal, Niñez y Juventud, Medio Ambiente (`migrations/1714000000036…`, `…037…`); PO confirmation. **Business plan lists "Medio Ambiente, Educación, Salud"** (`docs/business/en/01-business-plan.md:47`; `es:47`) | **Documentation inconsistency** | The financial and business documentation doesn't match the confirmed priorities | Update the business plan when authorized (not changed here) |
| Allocation consistency | Revenue split 45% + 36% + 9% + 2.22% + 7.78% = **100%** (`business-plan.md:182-187`) | Supported (internally consistent) | — | — |
| "Over time, **Noetia knows what you read, what moved you, and what you shared**" / "Noetia sabe qué leíste, qué te movió y qué compartiste" (`:181-184`) | Persona pipeline exists (`services/api/src/personas`, `events`, `fragments/theme-taxonomy.ts`); disclosed in the Privacy Policy §4 with an opt-out (Profile → Privacy → "Contribute to Noetia Insights", `en.ts:501-502`) | **Supported** functionally; **requires legal review** (framing) | Surveillance-like framing with no mention of control near the claim | EN: "Your highlights become a map of the ideas that move you — private by default, and yours to control." ES: "Tus fragmentos se convierten en un mapa de las ideas que te mueven — privado y bajo tu control." *(the "private by default" wording must match the actual visibility defaults; PO and legal confirm)* |
| "…a visible map of **what you think and what you believe**" / "…lo que piensas y en qué crees" (`:181-184`) | The theme taxonomy includes **`fe` (faith)** and **`espiritualidad`** (`fragments/theme-taxonomy.ts:8,21,59,124`), used for persona computation | **Requires legal review** | Inferring and displaying beliefs may involve special-category data (e.g., religious or philosophical beliefs under GDPR Art. 9). The claim amplifies this | Avoid "what you believe"; counsel to review the persona taxonomy's sensitive themes |
| Authors: "real-time reading analytics" (`:283-286`) | Author analytics exist per CLAUDE.md; "real-time" not verified | **Unverified** | Possible overstatement | "Reading and sharing analytics for your titles" |
| Eyebrow "Knowledge Expression Platform"; metadata "The first Knowledge Expression Platform" (`app/page.tsx:10,17`) | No substantiation | **Requires PO decision** (already CT-12) | "First" superlative | Drop "first"; translate the eyebrow |
| Cookie banner: "with your consent, analytics cookies to improve your experience" | No analytics script found (LG-20) | **Requires legal review** | Consent requested for non-existent processing; button prominence differs | Legal decision; see §16 |

**Priority / effort:** P0 for the wording decision (Low effort once decided); legal items per counsel.

### LP-08 — Public-site layout consistency · **VERIFIED (desktop and mobile capture)** / OBSERVED

| Aspect | Desktop 1440 (VERIFIED) | Mobile 390 (VERIFIED) |
|---|---|---|
| Section rhythm | Alternating full-width bands and contained cards with `py-14`/`py-16`; each section inside a bordered card, giving "card in band" repetition | The same, stacked; very long page (5,688 px) |
| Alignment | Hero and three steps centred; clubs, Causas and authors left-aligned inside cards: alignment flips mid-page | Same |
| Text width | Hero `max-w-xl` (good); card bodies `max-w-xl` inside `max-w-4xl` cards | Cards with padding inside padding reduce the measure; acceptable |
| Card density | Clubs and Causas sub-cards use `text-xs` descriptions (12 px) | 12 px descriptions on mobile (small) |
| CTA consistency | White filled (hero), white outline (library), **blue filled** (clubs), **emerald filled with white text** (Causas, fails contrast), white filled (authors): five styles | Same |
| Footer | Two footers; low-contrast text (LP-01) | Landing footer links wrap awkwardly ("Sign / in", "Causas / Noetia") |
| Header/hero balance | Light header, generous hero; language switch inside the hero pushes the headline down | Header shows only the logo and "Create account"; the cookie banner overlaps the hero CTA |
| Hierarchy | Uppercase blue eyebrows on every section compete; gradient headline line draws more attention than CTAs | Same |
| Not inspected | Tablet (768–1023: corporate navigation hidden, Sign in visible), hover/focus states, real devices | — |

### 5.9 Relationship to earlier findings (not edited; recorded here)

| Earlier finding | Effect of this evidence |
|---|---|
| NC-01 (landing metadata) | **Confirmed visually.** English `<title>` served in the Spanish view |
| NC-02 (landing outside i18n; gradient; emoji) | **Confirmed visually**; extended by LP-04 and LP-05 |
| SH-02 (no web font) | **Confirmed.** Computed body font is the system stack |
| SH-03 / N-04 (white on emerald-500) | **Confirmed** on the published Causas CTA |
| SH-06 (contrast) | **Confirmed** in both footers (LP-01) |
| NC-05 (navigation) | **Extended** by LP-03: mobile has no Sign in link |
| CT-11 (inline ternaries) | **Confirmed.** Untranslated English eyebrow, label and tagline in the Spanish view |
| CT-12 (claims) | **Confirmed**; detailed in LP-07 |
| CT-13 (Causas mechanism unverified) | **Updated by the PO clarification:** the commitment is confirmed policy. The open issues are execution-tense wording and three inconsistent mechanism descriptions. The CT-13 framing that the claim might be "unsupported" is **superseded** |
| LG-20 / LG-21 (cookies; disclosures) | **Confirmed.** The banner requests analytics consent; button prominence differs (§16) |

## 6. Exact source files per finding

| Finding | Files (`main@6a5e5c0`) |
|---|---|
| LP-01 | `services/web/app/layout.tsx`; `services/web/components/Footer.tsx`; `services/web/app/LandingContent.tsx:294-310`; `services/web/app/causas/page.tsx:239-…`; `services/web/lib/i18n/{es,en}.ts` (`footer`) |
| LP-02 | `services/web/app/LandingContent.tsx:107-145`; candidate assets `services/web/public/backgrounds/*` (existing), `public/presets/*` |
| LP-03 | `services/web/app/LandingContent.tsx:6-13,87-104`; `services/web/app/(corporate)/_components.tsx` (corporate header pattern) |
| LP-04 | `services/web/app/LandingContent.tsx:127,132,160,172,192,221,231,260`; `services/web/tailwind.config.ts:9` |
| LP-05 | `services/web/app/LandingContent.tsx` (FEATURES, CLUBS_FEATURES, CAUSAS_FEATURES, paragraphs) |
| LP-06 | `services/web/app/LandingContent.tsx`; governance PO-025/026/027 (`feat/nem-024-checkpoint-b@860f531`) |
| LP-07 | `services/web/app/LandingContent.tsx:181-184,237-240,283-286`; `services/web/app/causas/page.tsx:74-75`; `services/web/components/CauseSelector.tsx:66,121`; `services/web/app/(corporate)/milestones/content.tsx`; `services/api/src/causes/*`; `services/api/src/migrations/1714000000036-CreateCausesAndPreferences.ts`, `…037-RenameCausaToMedioAmbiente.ts`; `services/api/src/fragments/theme-taxonomy.ts`; `docs/business/{en,es}/01-*.md:47,186`; `services/web/lib/legal/terms-of-service.ts:44,141`; `services/web/components/CookieBanner.tsx:54-63` |
| LP-08 | `services/web/app/LandingContent.tsx` (section wrappers, CTA classes); `services/web/components/Footer.tsx` |

## 7. Minimalist landing-page design recommendation (PROPOSED)

This applies the "Quiet Editorial" direction ([Appendix F §3.1](F-visual-validation-supplement.md#31-direction-quiet-editorial)), which remains a proposal, to the public landing page. **The brand is unchanged:** navy surface, NOETIA wordmark, emerald accent.

**Landing token subset (a minimal slice of Package A):**

| Token | Value | Use | Contrast (VERIFIED) |
|---|---|---|---|
| `surface.brand` | `#0D1B2A` | page background | — |
| `surface.raised` | `#13263A` | the one card treatment | — |
| `text.primary` | `#FFFFFF` | headings | 17.39:1 on navy |
| `text.body` | `#CBD5E1` (slate-300) | body | 11.72:1 |
| `text.muted` | `#94A3B8` (slate-400) | captions, footer | 6.78:1 (5.9:1 on `#1A2736`) |
| `accent` | `#34D399` | primary CTA fill, active phrase, eyebrow | navy on emerald 9.05:1; emerald on navy 9.05:1 |
| `accent.onLight` | `#047857` | links on white surfaces (legal, footer light tone) | 5.48:1 on white |
| `border.subtle` | `rgba(255,255,255,0.10)` | separators | — |

**Rules:**

| Area | Rule |
|---|---|
| CTAs | **One primary** (emerald fill, navy text); **one secondary** (outline white/10); text links |
| Colours retired from the landing | blue and indigo gradients, `bg-blue-600`, `bg-emerald-500` with white text |
| Cards | **one** treatment (`surface.raised`, `border.subtle`, radius 16). No card-in-band nesting; sections are separated by whitespace and a hairline |
| Icons | **one** outline SVG family (the existing three-step style at 1.5 px stroke) for steps, clubs and causes. Emoji removed from the UI |
| Typography | self-hosted serif for the hero headline and section headings (from the quote-card set: Playfair or Merriweather); sans (Lato or Inter) for body and UI. Headline 40/48 desktop, 32/38 mobile |
| Eyebrows | at most two on the page (hero, ecosystem), emerald, translated |
| Imagery | the product demonstration (§10) is the only "picture"; quote-card backgrounds supply colour inside the demo |

## 8. Proposed section order

| # | Section | Purpose | Replaces / keeps |
|---|---|---|---|
| 1 | Header | orientation, sign-in | replaces the corporate navigation |
| 2 | Hero + product demonstration | what Noetia is and does | keeps the headline idea; adds the demo |
| 3 | How it works: Absorbe · Captura · Expresa | the core loop | **keeps** the model, shorter |
| 4 | Ecosystem: Noetia · Noetia+ · NoetiaX | the full journey; premium tiers labeled as in development | new |
| 5 | Clubes de Lectura | social reading | keeps, shorter |
| 6 | Causas Noetia | social commitment (**preserved**; PO) | keeps; commitment wording |
| 7 | Para autores | supply side | keeps, shorter |
| 8 | Closing CTA band | conversion | new (one line + primary CTA) |
| 9 | Footer (single) | legal, company, contact | replaces both footers |

The identity statement ("No acumulas libros leídos…") moves into the hero sub-copy or the How-it-works intro, with the privacy-safe wording from §15. No separate gradient card.

## 9. Header and navigation specification (PROPOSED)

**Desktop (≥ 1024):**
```
NOETIA   Cómo funciona   Biblioteca   Noetia+ y NoetiaX   Planes        ES | EN   Iniciar sesión   [Crear cuenta]
```

| Element | Target |
|---|---|
| "Cómo funciona" | anchor `#como-funciona` |
| "Biblioteca" | `/discover` (public catalogue) |
| "Noetia+ y NoetiaX" | anchor `#ecosistema` |
| "Planes" | `/pricing` |
| Language switch | moves **into the header** as a compact segmented control (text "ES / EN", `aria-pressed`) |
| Corporate links | About, Company, How we build, Team, Careers, Milestones and Contact move to the footer "Empresa" column, which already lists them |

**Mobile (< 1024):**
```
NOETIA                      ES|EN   [Crear cuenta]   ☰
```
- ☰ opens a full-height sheet: the four primary links, **Iniciar sesión**, Crear cuenta, then a muted "Empresa" group.
- The sheet is focus-trapped and closes with Esc.
- **Iniciar sesión is always reachable** within two taps, fixing LP-03.

**Implementation note:** extract a `PublicHeader` component, shared by the landing page, `/causas` and the corporate layout `(corporate)/_components.tsx`. Strings go into the i18n catalogues.

## 10. Hero product-demonstration specification (PROPOSED)

**Options assessed:**

| Option | Visual impact | Load | Mobile | Accessibility | Maintenance | Accuracy | Verdict |
|---|---|---|---|---|---|---|---|
| A. Reuse live `PagedReader`/`PhraseRenderer` and `ShareModal` | high | heavy (client JS, needs API data, audio) | complex | hard to make inert | high (coupled to app state) | exact | ✘ |
| B. Screenshot images of the real app | medium | 150–300 KB per image | needs separate crops | alt text only | goes stale on every UI change; must not be fabricated, so needs §1 of Appendix F captures | exact at capture time | later, once captures exist |
| **C. Static, code-rendered representation (HTML/CSS)** using real public-domain text and an existing background | high enough; on-brand | **≈ 0 KB extra JS**; one optimized background ≈ 25–40 KB WebP via `next/image` | reflows natively | real text, semantic, screen-readable | low (tokens and copy) | accurate **if** it mirrors implemented features and is labeled illustrative | **✔ recommended** |

**Specification (option C):**

```
Desktop: hero text left (5/12) · demo right (7/12)        Mobile: hero text, then demo (stacked)

┌────────────── Demo (aria-label="Ejemplo ilustrativo de Noetia") ──────────────┐
│ 1  Reader sheet (paper #FCFCFD, serif)                                        │
│    "En un lugar de la Mancha, ▌de cuyo nombre no quiero acordarme,▐ no ha    │
│     mucho tiempo que vivía…"     ← one phrase in emerald tint = active phrase  │
│    ▶ ━━━━━━━○──── 0:42   1.0×    ← static audio bar (decorative, aria-hidden)  │
│                                                                                │
│ 2  Capture chip under the phrase:  [＋ Fragmento guardado]                      │
│                                                                                │
│ 3  Quote card (1:1) on an existing background (dark, white-text-safe:          │
│    e.g. imagen-13 or imagen-17), serif quote + "— Miguel de Cervantes" +       │
│    small "NOETIA" mark                                                         │
│    Steps labelled 1 Escucha y lee · 2 Captura · 3 Comparte                      │
└────────────────────────────────────────────────────────────────────────────────┘
Caption (muted, 13 px): "Ilustración del producto con un texto de dominio público."
```

**Accuracy rules:**
- Text: *Don Quijote* (public domain, already in the catalogue).
- Only implemented capabilities are depicted: phrase-synchronized highlight, fragment save, quote card.
- Formats named only if implemented (LinkedIn, Instagram, Facebook, Pinterest).
- No invented metrics, users or AI features.
- Labeled as an illustration, **not presented as a screenshot**.

**Motion:** none by default. An optional CSS-only phrase-advance (three phrases, 3 s each) is a **PO decision**. It must run only with `prefers-reduced-motion: no-preference`, needs no JS animation engine and no video, and must pause on hover or focus.

**Background choice:** use one of the backgrounds that pass for white text in the worst case (3, 9, 13, 17; [Appendix D §3](D-visual-assets.md#3-backgrounds--measured-legibility)), plus a scrim token.

**Budget:** LCP element is the H1 text, not an image. The demo image loads with `loading="lazy"` on mobile and is prioritized on desktop only if it is above the fold. Total added transfer ≤ 50 KB.

**Bilingual:** EN variant uses a public-domain English quote (for example *Pride and Prejudice*, opening line), with the caption translated.

## 11. Core Noetia experience presentation (PROPOSED)

**"Cómo funciona" / "How it works":** three columns (desktop) or three rows (mobile), same outline icons. Each step: verb heading + one sentence (≤ 14 words) and a number badge matching the demo steps.

| Step | ES | EN |
|---|---|---|
| 1 | **Absorbe** — Lee y escucha a la vez, frase por frase. | **Absorb** — Read and listen together, phrase by phrase. |
| 2 | **Captura** — Guarda con un toque el pasaje que te movió. | **Capture** — Save the passage that moved you in one tap. |
| 3 | **Expresa** — Conviértelo en una tarjeta visual para compartir. | **Express** — Turn it into a visual card to share. |

## 12. Noetia+ and NoetiaX presentation (PROPOSED; requires PO copy approval)

**Desktop:** three equal cards in one row. **Mobile:** stacked cards (no carousel). One card treatment; status badge top-right.

```
┌──────────── Noetia ─────────────┐ ┌──────────── Noetia+ ────────────┐ ┌──────────── NoetiaX ────────────┐
│ [Disponible]                    │ │ [En desarrollo]                 │ │ [En desarrollo]                 │
│ Lee, escucha, captura           │ │ Comprende, pregunta y conecta   │ │ Investiga en profundidad        │
│ y comparte.                     │ │ ideas.                          │ │ y compara fuentes.              │
│ • Lectura y audio sincronizados │ │ • Preguntas sobre hasta 3 libros│ │ • Investigación con hasta 10    │
│ • Fragmentos y tarjetas         │ │   por sesión, con citas         │ │   libros por sesión             │
│ • Clubes de Lectura             │ │ • Respuestas que indican su     │ │ • Análisis más profundo entre   │
│                                 │ │   fuente                        │ │   libros, con citas             │
│ [Crear cuenta]                  │ │ Requiere una suscripción Noetia │ │ Requiere una suscripción Noetia │
└─────────────────────────────────┘ └─────────────────────────────────┘ └─────────────────────────────────┘
Small print: "Noetia+ y NoetiaX están en desarrollo. Las funciones y la disponibilidad pueden cambiar.
Tus libros adquiridos son tuyos para siempre, con o sin servicios premium."
```

**Content rules:**

| Card / line | Approved basis | Notes |
|---|---|---|
| Noetia bullets | implemented on `main` | — |
| Noetia+ bullets | APPROVED (PO-027 3 books; PO-003 provenance) | — |
| NoetiaX "hasta 10 libros" | APPROVED (PO-027) | — |
| NoetiaX "análisis más profundo entre libros" | PO-025 (qualitatively deeper) and PO-001 (cross-book synthesis and comparison as an architecture workload class) | **Do not list** proposed X-P3 (evidence matrix) or other Appendix F proposals unless approved |
| "Requiere una suscripción Noetia" | PO-026 | — |
| Ownership line | PO-025/026 | — |
| CTAs | — | **No** "subscribe" CTA for premium tiers. An optional "Avísame" (notify me) link only if the PO approves reusing the existing waitlist (`components/WaitlistForm.tsx`) |
| Dates and prices | — | no launch dates, no premium prices (TT-16 open) |

**EN equivalents:** "Available" / "In development"; "Read, listen, capture and share." / "Understand, ask and connect ideas." / "Investigate in depth and compare sources."; "Requires a Noetia subscription"; "Books you acquire are yours forever, with or without premium services."

## 13. Clubs, Causas and authors section treatment (PROPOSED)

**Clubes de Lectura:**
- Heading + one sentence + three icon rows (outline icons: chat bubble, headphones, ballot box).
- One secondary CTA "Explorar clubes" (outline style, not blue).

**Causas Noetia (preserved on the homepage; PO requirement):**
- Layout: heading, commitment sentence, three causes with outline icons (paw, child or book, leaf) in the confirmed order **Bienestar animal · Niñez y juventud · Medio ambiente**, then the mechanism sentence (one version, once the PO confirms it), then a text CTA "Conoce Causas Noetia".
- Visual weight equal to Clubs. Emerald appears only as the icon and accent colour, so the CTA meets contrast (no white on emerald-500).
- Wording separates **commitment** (policy) from **execution** (no contributions yet), per §15.

**Para autores:** one sentence + text CTA "Ver guía de publicación"; no unverified "real-time" claim.

## 14. Footer consolidation recommendation (PROPOSED; exact changes)

**Component ownership:** the **global `components/Footer.tsx` is the single footer** for all routes. Page components never render their own `<footer>`.

**Exact source-level changes (for a future authorized implementation):**

1. `services/web/app/LandingContent.tsx`: delete the landing footer block (`:294-310`, the `{/* Footer */} <footer …>…</footer>` element).
2. `services/web/app/causas/page.tsx`: delete its footer strip (`:239` onward, `{/* Footer strip */} <footer …>`).
3. `services/web/components/Footer.tsx`:
   - add a tone switch: `const pathname = usePathname(); const tone = ['/', '/causas'].includes(pathname) ? 'dark' : 'light';` (from `next/navigation`);
   - map classes from tokens: dark uses `surface.brand`, `text.muted` for links and `text.primary` for the brand; light uses white, with links at `#4B5563` or darker;
   - replace failing contrast: `text-gray-400` → `text-gray-600` (light) or slate-400 (dark); `text-gray-300` → muted token; column headings `text-[10px]` → `text-xs` (12 px) minimum;
   - translate "Knowledge Expression Platform" (`:…` bottom bar) through `t.footer` or remove it (PO decision with CT-12).
4. `services/web/lib/i18n/{es,en}.ts` (`footer`):
   - unify the cause naming: EN "Noetia Causes" vs brand "Causas Noetia" (PO: keep the proper name "Causas Noetia" in both languages);
   - add a "Sign in / Iniciar sesión" link only if the header doesn't already cover it (it will after §9).
5. **Unchanged:** authenticated routes keep the light footer. Whether the reader and research workspaces should show any footer is a separate decision; it is INFERRED from the root layout that they do today and was not captured.

**Acceptance:**
- exactly one `<footer>` element on every route;
- all footer text ≥ 4.5:1;
- legal links (Privacy, Terms, Cookies, Trust) present in both tones and languages.

## 15. Bilingual copy recommendations (PROPOSED; for PO review; translation files unchanged)

| Section | Español | English |
|---|---|---|
| Hero eyebrow | Lectura que se convierte en ideas | Reading that becomes ideas |
| Hero H1 | Lo que lees te define. **Noetia lo hace visible.** | What you read defines you. **Noetia makes it visible.** |
| Hero sub-copy (≈ 22 words) | Lee y escucha a la vez, guarda los pasajes que te mueven y compártelos como tarjetas visuales. | Read and listen at the same time, save the passages that move you and share them as visual cards. |
| CTAs | Crear cuenta gratis · Explorar la biblioteca | Create free account · Explore the library |
| How it works | see §11 | see §11 |
| Identity line (replaces the card) | Con el tiempo, tus fragmentos forman un mapa de las ideas que te mueven — privado y bajo tu control.* | Over time, your highlights form a map of the ideas that move you — private and under your control.* |
| Ecosystem heading | Un ecosistema para leer, comprender e investigar | One ecosystem to read, understand and investigate |
| Clubs | **Clubes de Lectura** — Las ideas crecen cuando se comparten. Conversa sobre la frase exacta que te inspiró, escucha en vivo con tu grupo y elijan juntos el próximo libro. | **Reading Clubs** — Ideas grow when they're shared. Discuss the exact phrase that inspired you, listen live with your group and choose the next book together. |
| Causas (commitment, not execution) | **Causas Noetia** — Compartir también es ayudar. Destinamos el 2,22% de cada pago a causas sociales: bienestar animal, niñez y juventud, y medio ambiente. Forma parte del modelo financiero de Noetia desde el primer día. [mechanism sentence once confirmed] | **Causas Noetia** — Sharing is also helping. We commit 2.22% of every payment to social causes: animal welfare, children and youth, and the environment. It has been part of Noetia's financial model from day one. [mechanism sentence once confirmed] |
| Authors | **Para autores y editoriales** — Tus lectores no solo leen tu libro: lo resaltan y lo comparten. Publica en Noetia con analíticas de lectura y de fragmentos compartidos. | **For authors and publishers** — Your readers don't just read your book: they highlight it and share it. Publish on Noetia with reading and sharing analytics. |
| Closing band | Empieza a leer de otra manera. [Crear cuenta gratis] | Start reading differently. [Create free account] |

\* The privacy wording must match the actual visibility defaults and the opt-out (Profile → Privacy). It is subject to PO and legal confirmation.

**Spanish style:** "tú" register; sentence case; "Clubes de Lectura" and "Escucha Activa" as canonical proper nouns (CLAUDE.md voice guide).

**English style:** the English term for *fragmento* ("highlight") depends on decision DV-04.

## 16. Marketing-claim and privacy concerns (summary)

| # | Concern | Classification | Owner |
|---|---|---|---|
| 1 | Causas execution tense ("supports", "has operated", "donado automáticamente") vs no sales yet | Requires PO decision (wording) | PO |
| 2 | Three different Causas mechanism descriptions (singular choice / up to two or random / equal split) | Unverified / inconsistent | PO, then legal (the Terms mention the 2.22%) |
| 3 | Business plan cause names (Environment, Education, Health) vs confirmed priorities | Documentation inconsistency | PO (documentation update, not authorized here) |
| 4 | "Noetia knows what you read…" framing | Supported functionally; requires legal review (framing) | PO, legal |
| 5 | "what you believe" + persona themes `fe`/`espiritualidad` | Requires legal review (possible special-category inference) | Legal |
| 6 | "real-time reading analytics" (authors) | Unverified | PO |
| 7 | "first Knowledge Expression Platform"; untranslated eyebrow | Requires PO decision | PO |
| 8 | Cookie banner requests analytics consent with no analytics; "Accept all" filled vs "Essentials only" outlined | Requires legal review | Legal |
| 9 | English `<title>` on the Spanish view; `lang="es"` server-rendered | VERIFIED defect | Engineering (authorized later) |

## 17. Desktop and mobile component layout proposals (PROPOSED)

| Component | Desktop (≥ 1024) | Mobile (< 768) | Props / data |
|---|---|---|---|
| `PublicHeader` | wordmark · 4 links · ES/EN · Sign in · primary CTA | wordmark · ES/EN · CTA · menu sheet | `links[]`, `active` |
| `HeroDemo` | 12-column grid: copy 5 / demo 7 | stacked; demo below the CTAs | `quote`, `author`, `bg` (existing asset), `lang` |
| `StepList` | 3 columns | 3 rows | `steps[] {icon, title, desc}` |
| `TierCards` | 3 equal cards | stacked | `tiers[] {name, status, verb, bullets[], requirement}` |
| `FeatureRows` (Clubs, Causas) | heading left, rows right (2 columns) | stacked | `items[] {icon, label, desc}`, `cta` |
| `CtaBand` | centred line + primary CTA | same | `text`, `href` |
| `Footer` (global) | 4 columns | 2 columns | `tone` |
| `Button` | primary (emerald, navy text) / secondary (outline) / text | same | `variant` |

**Spacing:** sections `py-20` desktop / `py-14` mobile; content max widths 72 rem (header), 64 rem (sections), 36 rem (text); hairline separators.

## 18. Component reuse and dependencies

| Need | Reuse | Dependency |
|---|---|---|
| Icons | existing outline SVG paths in `LandingContent.tsx` FEATURES; add clubs and causes icons from the same family | Package A icon-set decision |
| Demo background | existing `public/backgrounds/imagen-13.jpg` or `imagen-17.jpg` via `next/image` | Appendix F §4 verification (optional) |
| Quote-card look | `lib/share-utils.ts` font set (Playfair) | self-hosted fonts (NC-08 / Package A) |
| Language switch | `useTranslation().setLanguage` (existing) | — |
| Copy | move all landing strings into `lib/i18n/{es,en}.ts` (a `landing` namespace) | Package F; parity test |
| Footer | `components/Footer.tsx` | §14 |
| Waitlist ("Avísame") | `components/WaitlistForm.tsx` | PO decision |
| Header for `/causas` and corporate pages | `PublicHeader` | `(corporate)/_components.tsx` refactor |

## 19. Relative implementation cost

| Item | Effort | Notes |
|---|---|---|
| Footer consolidation and contrast | Low | 3 files |
| Header, navigation and mobile menu | Medium | new component + focus management |
| Hero demonstration (static) | Medium | HTML/CSS + one optimized image |
| Copy into i18n + new copy | Medium | about 60 strings × 2 languages; parity test |
| Token subset + font self-hosting | Medium | subset of Package A |
| Tier cards | Low | after PO copy approval |
| Causas wording and mechanism sentence | Low | after PO (and legal) |
| **Total landing package** | **Medium** | can ship independently of research gates |

## 20. Accessibility and performance requirements

- **WCAG 2.2 AA:**
  - all text ≥ 4.5:1 (≥ 3:1 at 24 px or larger);
  - focus visible on every link and button;
  - the menu sheet is focus-trapped with Esc to close;
  - the language switch uses `aria-pressed` and per-language `lang` attributes;
  - the demo is labeled illustrative, real text is readable by screen readers, decorative parts are `aria-hidden`;
  - no emoji as information.
- **Language:** server-rendered `lang` and `<title>` per language (SH-07, NC-01).
- **Performance:**
  - Lighthouse mobile performance ≥ 90 and accessibility ≥ 95;
  - LCP ≤ 2.5 s on simulated 4G (LCP element: H1 text);
  - CLS ≤ 0.05 (fonts with `display: swap` + size-adjust);
  - added JS ≤ 5 KB gzipped (menu only);
  - added image transfer ≤ 50 KB;
  - no third-party font requests.
- **Cookie banner:** must not cover the primary hero CTA at 390 × 844 (compact layout); final behaviour per legal review.

## 21. Acceptance criteria (for a future authorized implementation)

1. Exactly one `<footer>` on `/`, `/causas` and every other route.
2. Header shows Sign in within two taps at every width from 360 px up.
3. The hero contains the illustrative demo with real public-domain text, labeled "illustration", showing only implemented features.
4. Landing uses one primary CTA style, one secondary, one card treatment and one icon family; no blue/indigo gradients; no white text on `emerald-500`.
5. Every landing string comes from the i18n catalogues; the Spanish view contains no English UI text; the `<title>` is localized.
6. The ecosystem section labels Noetia+/NoetiaX "En desarrollo / In development", states the subscription requirement and the 3/10-book limits, and shows no dates, prices or unapproved capabilities.
7. Causas Noetia remains on the homepage with the three confirmed causes. Wording distinguishes commitment from execution; one mechanism sentence is used consistently on the landing, `/causas` and the cause selector.
8. Accessibility and performance budgets in §20 pass (axe 0 serious or critical; Lighthouse thresholds).
9. Playwright visual baselines exist for `/` and `/causas` at 390 and 1440 px in ES and EN.

## 22. Product Owner decisions needed

| # | Decision |
|---|---|
| LPD-1 | Approve the section order (§8) and the "Quiet Editorial" landing treatment (§7) |
| LPD-2 | Approve the header and navigation hierarchy, and the move of corporate links to the footer (§9) |
| LPD-3 | Approve the static illustrative hero demo (§10); choose static vs the optional CSS phrase-advance; choose the demo background |
| LPD-4 | Approve the bilingual copy (§11, §15), including the identity line (with legal on privacy framing) |
| LPD-5 | Approve the ecosystem section content and the "En desarrollo" labelling (§12); whether to include an "Avísame" waitlist link |
| LPD-6 | Causas: confirm **one** allocation mechanism (singular choice / up to two causes or random / equal split) and approve the commitment-vs-execution wording; authorize a later business-plan correction of the cause names |
| LPD-7 | Claims: "first Knowledge Expression Platform"; eyebrow text; authors "real-time analytics" |
| LPD-8 | Footer: dark tone on public pages vs one light footer everywhere; "Knowledge Expression Platform" strip |
| LPD-9 | Brand-name language policy: "Causas Noetia" vs "Noetia Causes" in English |
| LPD-10 | Authorize the bounded landing implementation package (§23) |
| Legal | identity-copy framing and the persona taxonomy (`fe`, `espiritualidad`); cookie-banner consent design and analytics claim; Causas wording vs Terms §3 |

## 23. Recommended bounded implementation package (PROPOSED; not authorized)

**"Landing Reconciliation" (LR):** web only; no backend, schema, research, legal-text or financial-policy changes.

| Step | Content | Gate |
|---|---|---|
| LR-1 | Footer consolidation and contrast (§14) | LPD-8 |
| LR-2 | Landing token subset + self-hosted fonts (slice of Package A) | Design approval |
| LR-3 | `PublicHeader` with mobile menu and Sign in (§9) | LPD-2 |
| LR-4 | Landing copy moved into i18n with approved text (§15); localized metadata | LPD-4, LPD-7 |
| LR-5 | Static `HeroDemo` (§10) | LPD-3 |
| LR-6 | `TierCards` ecosystem section (§12) | LPD-5 |
| LR-7 | Causas section with approved wording and mechanism sentence; align `/causas` and `CauseSelector` copy | LPD-6, legal |
| LR-8 | Tests: Playwright visual baselines, axe, Lighthouse budgets, i18n parity | — |

**Order:** LR-1 and LR-2 first (no copy decisions needed), then LR-3, LR-4, LR-5; then LR-6 and LR-7 after the PO and legal decisions.

**Excluded:** pricing page, legal pages (Package G), app screens, research UI.

## 24. Remaining visual-evidence gaps

1. Tablet widths (768–1023), where corporate navigation is hidden but Sign in is visible: not captured.
2. Interaction states (hover, focus, menu), real devices, Safari/Firefox rendering: not captured.
3. `/causas`, `/pricing` and corporate pages on the public site: not captured in this pass (source-level duplicate footer on `/causas` is VERIFIED; visual INFERRED).
4. The PO's five original screenshots were not available in this session; their content is used as PA observations.
5. Rendered quote cards for the demo background (Appendix F §4) are not yet produced.
6. The deployed commit corresponding to the captured site was not verified.

### 24.1 Reproducing the public capture

Headless Chromium, no sign-in:

```js
// node capture.js <outDir>  — requires playwright-core with a downloaded Chromium
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch();
  for (const [name, lang, vp, mobile] of [['desktop-en','en',{width:1440,height:900},false],['desktop-es','es',{width:1440,height:900},false],
                                          ['mobile-en','en',{width:390,height:844},true],['mobile-es','es',{width:390,height:844},true]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await ctx.addInitScript((l) => localStorage.setItem('noetia_lang', l), lang);
    const p = await ctx.newPage(); await p.goto('https://noetia.app/', { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${process.argv[2]}/${name}-full.png`, fullPage: true }); await ctx.close();
  }
  await b.close();
})();
```

## 25. Mandatory STOP

Documentation only. No production code, assets, legal content, translations, financial policy, configuration, merge or deployment.

| Item | Status |
|---|---|
| Appendices A–F | retained unchanged |
| New mission or PR | none created |
| PO-052 | remains accepted |
| E-1 | remains OPEN and BLOCKED |
| Checkpoint E | remains NOT QUALIFIED |
| NEM-024 | remains unmerged |
| Production release | remains BLOCKED |

**STOP** for independent Product Architecture review and Product Owner authorization before any implementation.
