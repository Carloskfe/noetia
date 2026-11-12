# Appendix F — Visual-Validation Supplement

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md) (Draft PR #57).

**Prepared in response to:** the independent Product Architecture review of `14dafb6`. The source-based audit is accepted as a planning baseline; the complete visual-design assessment is **not yet approved**.

**Status:**

| Item | Status |
|---|---|
| Type | Documentation only; planning and design-direction proposals |
| Product Owner implementation approval | **NOT GRANTED** |
| Independent PA review | **AWAITING** |
| Mockups and proposed capabilities | **Not implemented.** Screen structures below are PROPOSED wireframes, not descriptions of the current product |
| Restrictions unchanged | NEM-024, E-1 (OPEN and BLOCKED), Checkpoint E (NOT QUALIFIED), release restrictions (BLOCKED) |
| Files changed | none in production code, translations, legal documents or image assets. The six existing assessment files are retained unchanged |

**Evidence labels** follow the main report: **VERIFIED** / **INFERRED** / **PROPOSED**. One new label is used: **DOCUMENTED** — supported by a current, identified written source (official page, store listing or dated review), but not visually inspected.

## Contents

0. [Correction to a retained finding (VA-02)](#0-correction-to-a-retained-finding-va-02)
1. [Interface capture plan (web and mobile, Spanish and English)](#1-interface-capture-plan-web-and-mobile-spanish-and-english)
2. [Competitor comparison with current, identified references](#2-competitor-comparison-with-current-identified-references)
3. [One minimalist design direction and proposed screen structures](#3-one-minimalist-design-direction-and-proposed-screen-structures)
4. [Verification plan for the 18 quote backgrounds](#4-verification-plan-for-the-18-quote-backgrounds)
5. [NoetiaX design proposals requiring Product Owner approval](#5-noetiax-design-proposals-requiring-product-owner-approval)
6. [Consolidated decisions required before the high-fidelity specification](#6-consolidated-decisions-required-before-the-high-fidelity-specification)

---

## 0. Correction to a retained finding (VA-02)

While preparing §4, the background-render code was read in detail (`main@6a5e5c0`).

**What the code does (VERIFIED):**

| Location | Behaviour |
|---|---|
| `services/image-gen/templates/base.py:160-206` | `_render_image_bg` supports three fits: `cover` (scale and centre-crop), `contain` (whole image plus an edge-colour matte) and `blur`. **`blur` is the default**: the whole image is fitted over a blurred, 0.85-brightness cover of itself, with no cropping and no hard bars |
| `services/image-gen/app.py:108` | default `bgFit` is `"blur"` |
| `services/web/components/ShareModal.tsx:114,719` | the web editor defaults to `blur` and offers `cover`/`contain` as user choices |

**Correction:** retained finding **VA-02** ([Appendix A §7](A-findings-register.md#7-visual-assets-va); [Appendix D §3](D-visual-assets.md#3-backgrounds--measured-legibility)) stated that story formats "must be cropped and upscaled". That is accurate **only for the opt-in `cover` fit**.

**What applies in the default `blur` fit (INFERRED from code; to be confirmed by §4):**
- A 1200×1200 background is downscaled to 1080 px wide and centred in a 1080×1920 card, with blurred bands above and below.
- The open questions shift to:
  - whether quote text overlaps the sharp image or the blurred bands;
  - legibility on the blurred bands;
  - aesthetic quality of the bands.
- Upscaling softness applies mainly to `cover`.

The six retained files are not edited. This correction is authoritative for VA-02 and is carried into the decisions in §6.

---

## 1. Interface capture plan (web and mobile, Spanish and English)

**Purpose:** produce the visual evidence missing from the source-based audit (main report §26), before any high-fidelity design approval.

**Status:** PROPOSED plan. **Execution needs separate authorization.** It runs local, disposable services and adds evidence files to the repository.

### 1.1 Environment rules

| Rule | Detail |
|---|---|
| Environment | Local development stack only (`docker compose` on the developer VM), from `main@6a5e5c0` or the commit named at authorization. **No production or staging access** |
| Data | Disposable database seeded with **public-domain** catalogue titles only, plus synthetic accounts (for example `capture-reader-es@example.invalid`). No real user data, no customer text, no real research questions |
| Payments | Stripe **test mode** or none. Billing screens captured in "no plan", "trial" and "active" states using fixtures; checkout captured only up to the redirect |
| Research UI | Draft PR #56 (`feat/nem-024-checkpoint-b@860f531`) captured from a **separate disposable build**, labelled "Draft — not on main, release blocked". Never merged for capture |
| Resource limits | One heavy job at a time on the shared VM; never stop unrelated services; disposable containers cleaned up afterwards |
| Privacy | Screens must not show emails other than the synthetic ones. Screenshots are scanned before commit |

### 1.2 Tooling (proposed)

- **Web:** a Playwright capture script with a fixed viewport list and `colorScheme`, run once per locale.
  - Locale set through the existing `noetia_lang` storage and the account language.
  - Deterministic state: fonts loaded, animations disabled via `prefers-reduced-motion`, fixed clock.
- **Mobile:**
  - Expo build on one Android emulator (Pixel 6 profile) and one iOS simulator (iPhone 15 profile), where available on the VM;
  - otherwise Android only, with the gap recorded.
- **Formats:** PNG captures, optimized, under about 300 KB each.

### 1.3 Capture matrix

**Web:** each route in **ES and EN**, in **light and dark** where the app supports dark (currently only the reader), at **360, 768, 1024 and 1440 px**.

| Group | Routes and states |
|---|---|
| Public | `/` landing; `/pricing`; `/causas`; `/s/[id]` invite page; corporate pages (`/about`, `/company`, `/trust`) |
| Auth and onboarding | `/register` (empty, validation error); `/login`; `/confirm-email`; `/forgot-password`; `/onboarding` (3 steps) |
| Library | `/library` (empty, populated); `/discover`; `/discover/collection/[slug]` (local covers and Open Library covers) |
| **Reader** | `/reader/[id]`: paged layout and scroll layout; light and dark; Escucha Activa playing with the highlighted phrase; chapter sheet; fragment selection popover; fragment sheet; audio tutorial overlay; book without sync ("sin sincronización") |
| **Quote-card editor** | `ShareModal`: every format tab; each fit (`blur`, `contain`, `cover`); solid, gradient and image backgrounds; each of the five fonts; text sizes S/M/L; the gallery of 18 backgrounds; upload slot; the resulting PNG |
| Fragments | `/fragments` (empty, populated) |
| Clubs | `/clubs`; `/clubs/[id]`; `/clubs/new`; live session `/clubs/[id]/sessions/[sessionId]/live` |
| Account | `/profile` (all tabs, including Privacy and Stats); `/account/billing` (no plan, trial, active); delete-account modal |
| **Legal** | `/legal/terms`, `/legal/privacy`, `/legal/cookies` at all widths; cookie banner; cookie preferences modal; footer legal links |
| Research (Draft PR #56 only) | `/research/[sessionId]`: empty, asking (each stage), answer with citations, citation dialog, exclusion banners, each error state, read-only session |

**Mobile (ES and EN):** consent screen, language screen, paywall, library, reader (with audio bar), fragment sheet, share sheet, clubs, account, plus the app icon, adaptive icon and splash.

**Estimated volume:** about 30 web states × 2 languages × 4 widths ≈ 240 web captures, plus about 30 mobile captures, plus about 40 share-editor variants.

### 1.4 Storage and review

| Item | Proposal |
|---|---|
| Location | `docs/design/ecosystem-ux/evidence/<YYYY-MM-DD>/<platform>/<locale>/<route>--<state>--<width>--<theme>.png` |
| Index | `evidence/INDEX.md` listing commit, environment, tool versions and any gaps |
| Review | Each capture checked against the retained findings. Each INFERRED finding is confirmed, revised or withdrawn in a new short report section; the original text is never silently edited |
| Acceptance | Every route in the matrix captured or its absence explained; no real personal data; captures reproducible from the recorded commit |

---

## 2. Competitor comparison with current, identified references

**Evidence level: DOCUMENTED, not visually inspected.**

- Sources below were retrieved on 2026-11-12 and are dated where the source states a date.
- Third-party reviews are labelled as such; vendor claims are not independently verified.
- **Visual grounding requires captures** (§2.3). Until they exist, no layout or visual-quality judgement about a competitor is made here.
- No proprietary design is to be copied.

### 2.1 References and documented characteristics

| Product | Documented characteristics (source type) | Relevance to Noetia |
|---|---|---|
| **Readwise Reader** | Read-it-later reader for articles, PDFs, newsletters, YouTube transcripts and EPUBs; highlights sync to Readwise, which resurfaces highlights by spaced repetition (third-party review, 2026). Described as a three-pane, keyboard-first layout with a learning curve; mobile reported as slower than desktop on large libraries (third-party reviews, 2026). Document chat via "Ghostreader"; **August 2026 vendor update** announces chat on mobile (vendor) | Highlight-centred workflow and resurfacing map to Noetia fragments and the REMEMBER pillar. The reported learning curve is a caution for NoetiaX density |
| **Fable** | Social reading around book clubs: highlights, notes, comments and reactions inside the book; discussion prompts embedded in the text; public and private clubs with a public directory (App Store listing and vendor blog). June 2026: combined subscription with Everand announced (press release). AI features disabled in January 2025 after harmful outputs (library post; no 2026 confirmation found). Mixed user reviews on performance (Google Play) | Closest to Noetia Clubs (phrase-anchored discussion). The AI incident supports Noetia's provenance-first, conservative AI posture |
| **Storytel** | Audiobook player and ebook reader; offline listening and reading; Kids Mode; narrator voice switcher; listening goal; "Search in Book" (vendor support and feature pages). June 2026: "Storytel Genie" AI discovery announced (press release). Third-party listings mention speed control, sleep timer and synced listening | Benchmark for audio controls and listening goals next to Escucha Activa; differentiation is phrase-level sync with highlighting |
| **NotebookLM** | Reported rename to **Gemini Notebook** (July 2026, multiple third-party sources). Three-panel layout: Sources, chat, Studio. Chat grounded only in the notebook's sources; inline citations open the exact source passage; Studio generates briefings, study guides, timelines and slide decks; source attribution announced June 2026 (third-party guides; Google primary notes not retrieved) | Closest analogue to Noetia+ and NoetiaX: the source panel and passage-level citations are table stakes. Noetia's differentiation is an owned library, audio and phrase deep links, and explicit general-knowledge labelling (ADR-003) |
| **Elicit** | Table of papers with user-defined extraction columns filled per paper, with supporting quotes and reasoning; 2026 "Notebooks" combine searches, saved papers and extractions; figure extraction on a higher tier (third-party reviews, 2026). Reviews warn that study quality and risk of bias aren't assessed in the table | Inspiration for NoetiaX evidence comparison (X-P3). Each cell must cite its passage; Noetia must not imply a quality judgement it doesn't make |

**Sources (retrieved 2026-11-12):**

- **Readwise Reader:**
  - [Readwise Reader update, Aug 2026](https://readwise.io/reader/update-aug2026)
  - [Readwise changelog](https://docs.readwise.io/changelog)
  - [Asian Efficiency review (2026-07-06)](https://www.asianefficiency.com/productivity/readwise-reader-review/)
  - [DEV Community review (2026)](https://dev.to/pickuma/readwise-reader-review-is-it-worth-it-for-developers-in-2026-33kf)
  - [App Store listing](https://apps.apple.com/ch/app/id1567599761)
- **Fable:**
  - [App Store listing](https://apps.apple.com/app/id1488170618)
  - [Google Play listing](https://play.google.com/store/apps/details?id=co.fable.fable)
  - [Fable blog: social reading](https://fable.co/blog/the-benefits-of-social-reading)
  - [Fable blog: book club directory](https://fable.co/blog/reap-the-benefits-of-social-reading-with-fables-book-club-directory)
  - [Everand and Fable shared subscription](https://www.scribdinc.com/newsroom/everand-and-fable-launch-a-single-shared-subscription)
  - [SMCL library post](https://smcl.org/blogs/post/join-us-on-fable-a-book-club-app-for-social-reading/)
- **Storytel:**
  - [Support: Using the App](https://support.storytel.com/hc/en-sg/categories/4413902786332-Using-the-App)
  - [App features](https://www.storytel.com/in/c/app-features)
  - [Storytel Genie announcement](https://mfn.se/a/storytel/book-discovery-is-now-made-hyper-personal-with-storytel-genie.iframe)
  - [App Store listing](https://apps.apple.com/app/id348177651)
  - [Screensdesign showcase](https://screensdesign.com/showcase/storytel-audiobooks-library)
- **NotebookLM / Gemini Notebook:**
  - [Jeff Su, "NotebookLM changed completely" (2026)](https://www.jeffsu.org/notebooklm-changed-completely-heres-what-matters-in-2026/)
  - [NotebookLM source attribution](https://pasqualepillitteri.it/en/news/4248/notebooklm-source-attribution-prompts-sources)
  - [Complete guide 2026](https://blog-8ye.pages.dev/en/posts/google-notebooklm-complete-guide-2026/)
  - [Sources, citations and output tools](https://macmyths.com/google-notebooklm-guide-sources-citations-output-tools/)
- **Elicit:**
  - [fast.io review (2026)](https://fast.io/resources/elicit-ai-review-2026/)
  - [IntuitionLabs: data extraction for clinical papers](https://intuitionlabs.ai/articles/elicit-data-extraction-clinical-papers)
  - [AI Indigo review (2026)](https://aiindigo.com/blog/elicit-review-2026-still-the-gold-standard-for-ai-research)

### 2.2 Comparison grid (documented capabilities, not visual quality)

| Dimension | Readwise Reader | Fable | Storytel | NotebookLM | Elicit | Noetia today (VERIFIED) | Noetia target (PROPOSED) |
|---|---|---|---|---|---|---|---|
| Synchronized text and audio | — | — | synced listening (third-party) | — | — | **phrase-level sync + highlight** | keep as signature |
| Highlights and notes | core | in-book | — | — | — | fragments + share cards | first-class Fragments hub |
| Social / clubs | — | core | — | — | — | phrase-anchored clubs | calmer visual system |
| Grounded Q&A with citations | document chat | (AI disabled) | AI discovery | core, passage-level | per-cell quotes | Draft PR #56 only | Noetia+ workspace |
| Cross-source comparison | — | — | — | Studio outputs | **extraction tables** | — | NoetiaX evidence panel (X-P3, approval) |
| General vs source knowledge labelling | not documented | — | — | source-grounded chat | quotes per cell | origin labels (Draft) | explicit provenance (ADR-003) |
| Owned library + permanent ownership | — | via subscription | subscription | user uploads | papers | **permanent ownership (PO-025)** | positioning anchor |

### 2.3 Visual capture protocol for competitors (to complete visual grounding)

| Item | Proposal |
|---|---|
| What | Public marketing pages, store screenshots and, where a free tier exists, first-run screens. Captured by hand or with Playwright, by a person with legitimate accounts. **No scraping behind paywalls; no circumvention** |
| Products | Readwise Reader, Fable, Storytel, NotebookLM / Gemini Notebook, Elicit (optionally Blinkist and Headway) |
| Matrix | landing → library/home → reading or listening view → highlight or note → AI/citation view (where offered) → pricing; desktop 1440 and mobile 390 |
| Storage | **Not committed to the public repository** (third-party copyrighted UI). Store privately; commit only a dated observation log with descriptions and links |
| Output | A short visual comparison updating §2.1 from DOCUMENTED to observed, with dates |

---

## 3. One minimalist design direction and proposed screen structures

> **PROPOSED.** Nothing in this section exists in the product unless explicitly marked VERIFIED. Wireframes are structural only; they are not visual mockups.

### 3.1 Direction: "Quiet Editorial"

**Principle:** the book is the interface. Every screen is paper and ink first; colour is a signal, not decoration.

| Element | Rule |
|---|---|
| Surfaces | Paper `#FCFCFD` (light) / navy `#0D1B2A` (dark). Navy is also the brand frame (landing, wordmark) |
| Ink | Near-black `#111827` on paper; `#F3F4F6` on navy. Secondary text ≥ 4.5:1 |
| Signal colour | Emerald: `#34D399` on navy, `#047857` on paper. **Only** for the active phrase, primary action, selection and "from your books" provenance. Never decoration |
| Typography | Serif for reading and headings (Merriweather or Playfair, already in the quote-card set); sans for controls (Lato or Inter). Generous line height; reading measure ≤ 70 characters |
| Space | 8 px grid; large margins around reading text; one primary action per screen |
| Density by tier | **Noetia:** one column, one task. **Noetia+:** two panes (conversation + sources). **NoetiaX:** two panes plus an on-demand third panel (evidence). Depth is disclosed progressively; never all panels at once |
| Iconography | One outline SVG set at 1.5 px stroke; emoji only as decoration, `aria-hidden` |
| Motion | 150–200 ms fades and slides; the active-phrase highlight is the only continuous motion; respects reduced motion |
| Imagery | Quote-card backgrounds and covers carry visual richness; the UI chrome stays quiet |
| Tier identity | The same shell. Tier is shown by a small wordmark suffix ("Noetia+", "NoetiaX") and the workspace layout, **not** by different colour schemes |

### 3.2 Shared shell

```
Mobile (≤767)                          Desktop (≥1024)
┌───────────────────────────┐          ┌────┬──────────────────────────────────────┐
│ ← Title            ⋯      │          │ N  │ Page title                    [user] │
├───────────────────────────┤          │ ── ├──────────────────────────────────────┤
│                           │          │ 📚 │                                      │
│        page content       │          │ 🔍 │            page content              │
│                           │          │ 🔬 │                                      │
├───────────────────────────┤          │ 👥 │                                      │
│ Biblioteca Descubrir      │          │ 👤 │                                      │
│ Investigar Clubes  Perfil │          └────┴──────────────────────────────────────┘
└───────────────────────────┘          (icons are placeholders for the SVG set)
```

"Investigar" shows an explanatory page, not an error, when the account has no premium entitlement (PO-026 prerequisite stated plainly).

### 3.3 Noetia (core)

| Screen | Proposed structure | Builds on (VERIFIED existing) |
|---|---|---|
| Library | Continue-reading row (cover, progress, "Escucha Activa" resume) → shelves (owned, collections) → search | `/library`, `BookGrid` |
| Reader | Full-bleed paper sheet. Minimal top bar: back · title · **Aa** (settings sheet: size, theme, layout, speed) · contents. Bottom audio bar with play/pause, ±10 s and speed; the active phrase in emerald tint. Selecting text opens a 3-action popover: Guardar fragmento · Compartir · (Noetia+) Preguntar | `PagedReader`, `PhraseRenderer`, `ReaderTopBar`, `FragmentPopover` |
| Fragments hub | Per-book grouped list with search; actions: share, note, (Noetia+) "Preguntar a mis fragmentos" | `/fragments`, `FragmentSheet` |
| Quote-card editor | Step 1 Formato → Step 2 Fondo (gallery with tone filter, fit control) → Step 3 Texto (font, size, colour with automatic contrast warning) → Advanced (collapsed). Live preview fixed at the top | `ShareModal` |
| Clubs | Club card list → club page (current book, next session, discussion anchored to phrases) | `/clubs/*` |
| Profile hub | Cuenta y facturación · Privacidad · Mis estadísticas · Idioma · **Legal** (Terms, Privacy, Cookies with versions) | `/profile`, `/account/billing` |
| Legal document | Single-language document; language switch; header (version, effective date, change summary); table of contents; semantic sections | replaces `LegalPage.tsx` rendering (G) |

```
Reader (mobile, PROPOSED)
┌───────────────────────────┐
│ ←  Don Quijote   Aa  ☰    │
├───────────────────────────┤
│                           │
│  En un lugar de la Mancha,│
│  ▌de cuyo nombre no quiero│ ← active phrase (emerald tint)
│  acordarme, no ha mucho…  │
│                           │
├───────────────────────────┤
│  ⏮10  ▶  10⏭   1.0×  ⎘   │ ← audio bar
└───────────────────────────┘
```

### 3.4 Noetia+ (research; APPROVED scope, PROPOSED UI)

| Screen | Proposed structure | Approved basis |
|---|---|---|
| Investigar hub | "Nueva sesión" · recent sessions · Research Briefs · "Preguntar a mis fragmentos" | PO-025, PO-028 |
| New session: book picker | Search and shelves; counter "2 de 3"; eligibility badge per book; public-domain eligible editions selectable without owning them (PO-027); a **lock confirmation** before the first question: "Tras tu primera pregunta no podrás cambiar los libros" | PO-027 (PO-029 eligibility is DRAFT) |
| Workspace | Desktop: conversation (left, ≤ 70 ch) and source panel (right, passages for the selected citation). Mobile: conversation, with citations in a bottom sheet. Header: books (locked), mode chip | PO-003, PO-027 |
| Answer anatomy | Paragraphs, each with a **provenance label** (De tus libros / Contexto general / Tus notas); inline numbered citations; exclusion notices; turn status | PO-003; Draft PR #56 copy (`860f531`) |
| Citation sheet | Book, chapter or position, verified passage, "Ir al pasaje" (deep link, needs reader authorization), "Abrir libro" | `17-web-mobile-ux.md` |
| Research Brief | Title, question(s), synthesized answer, every claim cited or labeled general context, source list; export later | PO-025 |
| Entitlement states | "Necesitas una suscripción Noetia activa" / "Disponible con Noetia+" / "Has alcanzado tu límite de uso" (units pending D10) | PO-026 |

```
Noetia+ workspace (desktop, PROPOSED)
┌───────────────────────────────────────┬──────────────────────────────┐
│ 3 libros (bloqueados)  · Modo: Mis libros ▾                          │
├───────────────────────────────────────┼──────────────────────────────┤
│ Tú: ¿Qué papel tiene el honor…?       │ Cita 2 · La Regenta, cap. 3  │
│                                       │ ┌──────────────────────────┐ │
│ Noetia:                               │ │ «…pasaje verificado…»    │ │
│ [De tus libros] El honor aparece… ²   │ └──────────────────────────┘ │
│ [Contexto general] En la literatura…  │ Ir al pasaje · Abrir libro   │
│                                       │                              │
│ ┌───────────────────────────────────┐ │                              │
│ │ Escribe tu pregunta…        Pedir │ │                              │
│ └───────────────────────────────────┘ │                              │
└───────────────────────────────────────┴──────────────────────────────┘
```

### 3.5 NoetiaX (advanced research; APPROVED tier, PROPOSED UI; items needing approval in §5)

| Screen | Proposed structure |
|---|---|
| New deep session | Picker up to 10 books with grouping (author, period, collection) and a "10 de 10" counter; lock confirmation |
| Deep workspace | Source rail (left, collapsible: 10 books with per-book citation counts) · conversation (centre) · **evidence panel** on demand (right: comparison or disagreements, X-P3/X-P4) |
| Brief builder | Select answers and citations, order sections; every claim cited or labeled general context |
| Mobile | Rail and evidence panel become full-height sheets; the evidence matrix becomes a per-claim card list |

```
NoetiaX deep workspace (desktop ≥1440, PROPOSED)
┌──────────┬──────────────────────────────┬─────────────────────────────┐
│ Fuentes  │ Conversación                 │ Evidencia  (bajo demanda)   │
│ ▸ Libro1 4│ …                            │ Afirmación A                │
│ ▸ Libro2 2│                              │  Libro1 ✔²  Libro3 ✖⁵  …    │
│ ▸ …      │                              │ Donde los libros discrepan  │
│ (10)     │                              │  …                          │
└──────────┴──────────────────────────────┴─────────────────────────────┘
```

### 3.6 Design acceptance criteria (for the future high-fidelity specification)

- One token set and one shell across all tiers.
- Every text pair ≥ 4.5:1 (≥ 3:1 for text 24 px or larger).
- Each screen has exactly one primary action.
- Every research answer segment has a provenance label.
- Usable at 360 px.
- Each structure validated against the captures from §1 before high-fidelity work.

---

## 4. Verification plan for the 18 quote backgrounds

**Status:** PROPOSED plan; **execution needs separate authorization.**

**Purpose:** replace the source-image approximations in Appendix D (central-region pixel statistics) with measurements of **actual rendered text**.

### 4.1 Rendering

- **Renderer:** the existing `services/image-gen` templates, run in a disposable local container from the authorized commit. **No template or asset is modified.**
- **Outputs:** written to a temporary directory. Only content-free summaries, plus contact sheets for review, are committed later, if authorized.

**Factorial matrix:**

| Factor | Levels |
|---|---|
| Background | imagen-1 … imagen-18 (18) |
| Format | Instagram post 1080×1080, story 1080×1920; Facebook post 1200×630; LinkedIn 1200×627; Twitter card 1200×675; Pinterest 1000×1500 and 1000×1000 (7) |
| Fit | `blur` (default), `contain`, `cover` (3) |
| Text colour | white, black, automatic (`text_color_for_bg` / `getTextColor`), brand navy, brand emerald-on-navy check (5) |
| Quote | short (≈ 60 characters), medium (≈ 180), long (≈ 400); Spanish with accents and ¿¡ marks, and English; public-domain sources only (6) |
| Font and size | Playfair M (default), Lato M; S and L sizes for the short and long quotes only (subset) |

**Full combination:** 18 × 7 × 3 × 5 × 6 ≈ 11,340 renders. Run a **two-stage design** instead:

1. **Screening**, about 1,500 renders: all backgrounds × 7 formats × `blur` × {white, black, automatic} × {ES medium, ES long} × Playfair M, plus `cover` and `contain` for the story format only.
2. **Confirmation:** the full factor set only for background × format cells that fail or are borderline in stage 1.

### 4.2 Measurements per render

1. **Text-region contrast.** Rasterize the text layer separately (or use the template's text bounding boxes). For each glyph-covered pixel, compute the WCAG contrast against the background pixel underneath. Report the 5th percentile, median and share below threshold.
2. **Thresholds.** Quote text ≥ 24 px rendered (most formats): ≥ 3:1 (WCAG large text), with a stricter target ≥ 4.5:1. Watermark and author line: ≥ 4.5:1.
3. **Subject overlap.** Share of text pixels over the image's focal subject (focal-point annotation per background, made once by a reviewer).
4. **Band placement (blur and contain).** Whether text crosses the sharp-to-blur boundary; legibility on the bands.
5. **Effective resolution.** Background pixels per output pixel (flags upscaling in `cover`).
6. **Automatic-colour correctness.** Whether `automatic` picks the higher-contrast colour; known limitation: `getTextColor` averages luminance.

### 4.3 Human review

- A reviewer panel (at least 2, one native per language) scores a contact sheet of the stage-2 cells on legibility, composition and brand fit (1–5), blind to the measurements.
- Disagreements are resolved against the measurements.

### 4.4 Outputs and decision rules

| Output | Rule |
|---|---|
| Per-background verdict | **Retain as-is** (all formats pass with automatic colour) / **retain with scrim** (passes only with a scrim token of a stated opacity) / **retain with restricted formats or fits** / **revise or remove** |
| Scrim specification | The minimum overlay (navy or white, 0–60%) per background that achieves the threshold, as a proposal for the design system |
| Automatic-colour defects | Cases where automatic colour picks the wrong colour, with an engineering note (no change authorized) |
| Evidence | Content-free JSON (background, format, fit, colour, percentiles, verdict) plus reviewer scores; contact sheets stored with the evidence set |

Appendix D's measured table and VA-03 remain as source-image screening results. The rendered verification supersedes them for decisions once it is accepted.

---

## 5. NoetiaX design proposals requiring Product Owner approval

**Context:** NoetiaX is APPROVED as a tier (PO-025: qualitatively deeper research, not just more books; PO-027: 10 books, lock at the first analysis). **None of the proposals below is approved or implemented.** Each needs an explicit PO decision before high-fidelity design.

| ID | Proposal | What it means for users | Why it matters | Alternatives | Dependencies and risks |
|---|---|---|---|---|---|
| **X-P1** | **Deep workspace layout**: source rail + conversation + on-demand evidence panel (desktop); sheets on mobile | A distinct research environment while keeping the Noetia+ shell | Makes "qualitatively deeper" visible (PO-025) | Same layout as Noetia+ with only a 10-book limit, which fails PO-025's intent | Shares components with Noetia+ (Package C) |
| **X-P2** | **10-book picker with grouping** (author, period, collection) and per-book eligibility badges | Faster selection of larger sets | 10 books is unwieldy as a flat list | Flat list | PO-029 eligibility is **DRAFT** |
| **X-P3** | **Evidence comparison panel**: a claim × book grid with each cell "supports / contradicts / does not address", each linked to a cited passage | See at a glance how books relate on a claim | Core differentiator; analogous to documented Elicit extraction tables, adapted to books | (a) prose-only comparison; (b) per-claim card list only | Requires an AI capability not specified in E5/E6; risk of implying judgements the system doesn't make; every cell must cite. **Highest-risk proposal** |
| **X-P4** | **"Donde los libros discrepan" section**: disagreements and uncertainty stated in words, **never numeric confidence scores** | Honest presentation of conflicting sources | Avoids false precision | Omit; or numeric scores (not recommended) | Model-behaviour specification; copy rules |
| **X-P5** | **Side-by-side citation inspection** (two passages from different books) | Compare wording directly | Supports close reading | Sequential citation sheets | Reuses the citation component |
| **X-P6** | **Research Brief builder** (choose answers and citations, order sections) beyond the auto-generated Brief | Users shape the output | Brief is approved for both tiers (PO-025); a builder is a NoetiaX extension | Auto-generated Brief only | Data model for saved Briefs (not authorized) |
| **X-P7** | **Saved research projects** grouping sessions and Briefs (no knowledge graph at launch) | Organize long investigations | Retention and organization | Session history only | Data model and retention policy (not decided) |
| **X-P8** | **Tier identity**: same visual system; NoetiaX distinguished by the wordmark suffix and layout, not a separate colour scheme | Coherent ecosystem | Brief from the PO: one identity, varying complexity | A distinct NoetiaX accent colour | Design-system decision |
| **X-P9** | **Mobile scope for NoetiaX**: full deep workspace on web; on mobile, a read and continue experience (view sessions, Briefs and evidence cards), with creation of 10-book sessions optional | Realistic mobile ergonomics | `17-web-mobile-ux.md`: web first for heavy work | Full parity on mobile | Mobile roadmap |
| **X-P10** | **Upgrade path Noetia+ → NoetiaX inside a session** ("Continuar en NoetiaX" creates a new or forked session; it doesn't unlock the current one) | Clear and consistent with the lock | PO-027: set locks at the first analysis; changes need a new or forked session | No in-session upsell | Pricing (TT-16); fork semantics (Draft PR #56) |

---

## 6. Consolidated decisions required before the high-fidelity specification

This consolidates main report §24 and §25, Appendix C §7 and this supplement. Nothing below is decided.

### 6.1 Product Owner — design and product

| # | Decision | Source |
|---|---|---|
| DV-01 | Adopt the "Quiet Editorial" direction (§3.1) as the single ecosystem direction, or request alternatives | this supplement |
| DV-02 | Token values and type pairing (serif and sans choice) | main §6 |
| DV-03 | Navigation: five-item model with the "Investigar" hub | main §3, §24.3 |
| DV-04 | English term for *Fragmento* (Highlight vs Fragment) | main §24.1 |
| DV-05 | Escucha Activa as a brand name in English vs "Active Listening" | main §24.1 |
| DV-06 | Book-plan name ("Suscripción Noetia" vs "Noetia Premium") | main §24.1 |
| DV-07 | Spanish name for Research Brief | main §24.1 |
| DV-08 | Final names of the This Book / My Knowledge / Expand modes and the provenance labels | main §24.2 |
| DV-09 | Usage units and whether a usage meter is shown (D10, TT-13) | main §24.5 |
| DV-10 | Plan benefit wording ("biblioteca completa"), which depends on the access-rule decisions in NOF-004 F-2/F-3 | main §24.6 |
| DV-11 | Family plan size (4 or 5) | main §24.7 |
| DV-12 | Claims policy ("first platform", "miles de lectores"); verify the Causas donation mechanism | main §24.8 |
| DV-13 | D13: empty-state copy for natural questions (no retrieval change) | main §24.9 |
| DV-14 to DV-23 | NoetiaX proposals **X-P1 to X-P10** (§5), each approve / reject / defer | this supplement |
| DV-24 | Authorize the **interface capture plan** (§1): local disposable environment, synthetic data, evidence storage path | this supplement |
| DV-25 | Authorize the **background rendering verification** (§4) and its thresholds (≥ 3:1 large-text floor, ≥ 4.5:1 target) | this supplement |
| DV-26 | Authorize the **competitor visual capture** protocol (§2.3), including the private storage location | this supplement |
| DV-27 | Package order and authorization (Phase 0: A + F foundation + G presentation) | main §27 |
| DV-28 | Cover policy (template for generated covers; treatment of author-supplied and Open Library covers) | Appendix D |
| DV-29 | Background provenance and licence verification for the 18 images | Appendix D, E |
| DV-30 | Long-work chunk limit (`maxChunksPerBook` = 2,000) as a known product limitation; retained risk, no change | PO-051/052 context |

### 6.2 Qualified legal counsel (before publishing any legal or disclosure change)

| # | Item | Source |
|---|---|---|
| DL-01 | Provider identity: legal entity, address, controller | Appendix C §7 |
| DL-02 | Governing law and jurisdiction | Appendix C §7 |
| DL-03 | Annual prices (Draft PR #22), family size, token classes and expiries, trial terms | Appendix C §2 |
| DL-04 | Withdrawal and refund rights; auto-renewal and renewal notice | Appendix C §2 |
| DL-05 | Permanent-ownership clause; public-domain description | Appendix C §2 |
| DL-06 | Processors (Resend, hosting, Google Fonts or self-hosting, OAuth providers in use); international transfers; retention and portability claims | Appendix C §3 |
| DL-07 | Cookie policy: storage-type accuracy, undisclosed storage, analytics description | Appendix C §4 |
| DL-08 | Premium terms and privacy for Noetia+/NoetiaX (accuracy limits, provenance, permitted analysis, providers, no-training, retention, prerequisite, separation of ownership, tokens and AI usage) | Appendix C §5 |
| DL-09 | Acceptance evidence and age attestation | Appendix C §6 |
| DL-10 | Trust-page AI statements | Appendix C §5 |

### 6.3 Preconditions outside the design track (unchanged by this supplement)

- **NEM-024:** E-1 remains OPEN and BLOCKED; Checkpoint E remains NOT QUALIFIED; Draft PR #56 stays unmerged. Noetia+/NoetiaX **implementation** stays blocked, though design can proceed.
- **PO-029** (eligible research corpus) remains **DRAFT**; book-picker eligibility rules depend on it.
- **NOF-004** engineering items (F-1, F-2, F-3, F-7) gate several legal statements.

### 6.4 Readiness gate for the high-fidelity specification (PROPOSED)

The high-fidelity specification should start only when all four hold:

1. DV-01 to DV-08 and DV-14 to DV-23 are decided.
2. The interface captures (DV-24) exist and the INFERRED findings have been confirmed or revised.
3. The background verification (DV-25) has produced per-image verdicts.
4. The competitor visual captures (DV-26) have updated §2 from DOCUMENTED to observed.

The legal items (DL-*) gate legal-content publication, not the visual specification.
