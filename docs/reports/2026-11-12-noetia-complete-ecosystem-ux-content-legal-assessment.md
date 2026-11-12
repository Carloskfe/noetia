# NOETIA — Complete Ecosystem UI/UX, Content and Legal Experience Assessment

**Type:** Unnumbered, pre-implementation Product Owner design assessment. **REVIEW ONLY: no mission identifier, no implementation authorization.**
**Scope:** Noetia · Noetia+ · NoetiaX · Spanish and English · legal documents in both languages.
**Date:** 2026-11-12 · **Author:** Claude Code · **Reviewer:** independent Product Architecture (AWAITING) · **Product Owner implementation approval:** NOT GRANTED.
**Publication authority:** Product Owner authorization of 2026-11-12, documentation only.

**Evidence baselines:**

| Branch | Commit | Status |
|---|---|---|
| `main` | `6a5e5c0` | product code |
| `feat/nem-024-checkpoint-b` | `860f531` | Draft PR #56, unmerged; governance and minimal research UI |
| `docs/nof-004-legal-benchmark-audit` | `8b0e4f9` | Draft PR #23 |
| `fix/nof-004-terms-annual-prices` | `d254eea` | Draft PR #22 |

Details are in [Appendix E](noetia-ecosystem-ux-audit/E-evidence-method-and-limitations.md).

> **Evidence classes:**
> - **VERIFIED:** supported by inspected source, or by an image file actually viewed.
> - **INFERRED:** UX inference not yet visually verified.
> - **PROPOSED:** a recommendation requiring approval.
>
> **No rendered screens were captured.** This report claims no legal compliance. No application code, legal text, translation, asset or configuration was changed.

## Table of contents

1. [Executive assessment](#1-executive-assessment)
2. [Existing frontend architecture](#2-existing-frontend-architecture)
3. [Noetia core UX/UI](#3-noetia-core-uxui)
4. [Noetia+ research experience](#4-noetia-research-experience)
5. [NoetiaX advanced research experience](#5-noetiax-advanced-research-experience)
6. [Shared visual design system](#6-shared-visual-design-system)
7. [Existing imagery, covers and quote-card backgrounds](#7-existing-imagery-covers-and-quote-card-backgrounds)
8. [Mobile and desktop responsiveness](#8-mobile-and-desktop-responsiveness)
9. [Competitor comparison](#9-competitor-comparison)
10. [Spanish interface-content review](#10-spanish-interface-content-review)
11. [English interface-content review](#11-english-interface-content-review)
12. [Bilingual terminology and writing consistency](#12-bilingual-terminology-and-writing-consistency)
13. [Terms of Service — Spanish and English](#13-terms-of-service--spanish-and-english)
14. [Privacy Policy — Spanish and English](#14-privacy-policy--spanish-and-english)
15. [Cookie Policy — Spanish and English](#15-cookie-policy--spanish-and-english)
16. [Subscription, billing and cancellation disclosures](#16-subscription-billing-and-cancellation-disclosures)
17. [Premium AI research and data-processing disclosures](#17-premium-ai-research-and-data-processing-disclosures)
18. [Legal-page usability and accessibility](#18-legal-page-usability-and-accessibility)
19. [Approved versus implemented versus proposed capabilities](#19-approved-versus-implemented-versus-proposed-capabilities)
20. [Identified design and content problems](#20-identified-design-and-content-problems)
21. [Prioritized recommendations](#21-prioritized-recommendations)
22. [Component reuse and engineering dependencies](#22-component-reuse-and-engineering-dependencies)
23. [Proposed implementation packages](#23-proposed-implementation-packages)
24. [Product Owner decisions required](#24-product-owner-decisions-required)
25. [Legal-counsel review requirements](#25-legal-counsel-review-requirements)
26. [Visual evidence limitations](#26-visual-evidence-limitations)
27. [Design-to-Code Handoff for Future Claude Code Missions](#27-design-to-code-handoff-for-future-claude-code-missions)
28. [Final recommendations and review status](#28-final-recommendations-and-review-status)

**Appendices:**

| Appendix | Content |
|---|---|
| [A — Findings register](noetia-ecosystem-ux-audit/A-findings-register.md) | Every finding, with all evidence fields |
| [B — Spanish and English content audit, terminology, style guide](noetia-ecosystem-ux-audit/B-content-audit-es-en.md) | |
| [C — Legal documents, disclosures and legal UX](noetia-ecosystem-ux-audit/C-legal-assessment.md) | |
| [D — Images, covers and backgrounds](noetia-ecosystem-ux-audit/D-visual-assets.md) | |
| [E — Evidence baselines, method and limitations](noetia-ecosystem-ux-audit/E-evidence-method-and-limitations.md) | |

> **Corrections relative to the in-session summary** (applied throughout):
> 1. Background images where *both* white and black text fail the strict worst-case test are 1, 2, 4, 8, 10, 11, 12, 15 and 16. The summary listed six of them. Images 1 and 10 therefore move into the "retain with scrim" group ([Appendix D §3](noetia-ecosystem-ux-audit/D-visual-assets.md#3-backgrounds--measured-legibility)).
> 2. English legal text was confirmed to mirror the Spanish on every key fact, so legal findings carry ES/EN line references.

---

## 1. Executive assessment

**Strengths (VERIFIED):**
- the phrase-synchronized reader (paged default, Escucha Activa);
- a capable WYSIWYG share editor;
- a cohesive, high-quality quote-card background set;
- bilingual transactional emails;
- careful, honest copy in the minimal research Q&A (Draft PR #56).

**Root cause of most visual problems (VERIFIED): there is no design system.**
- The Tailwind theme is empty.
- No web font is loaded.
- The brand emerald `#34D399` never appears as a value; emerald classes are used 17 times while blue and indigo dominate interactive elements.
- Mobile uses indigo `#4F46E5`.
- Navy is hard-coded 71 times.
- Dark mode exists only in the reader.
- 120 uses of `text-gray-400` (2.54:1 on white) and 268 uses of `text-xs` or smaller.

If Noetia+ and NoetiaX are built now, they inherit this drift.

**Highest-risk area: content and legal (VERIFIED):**
- **Legal pages:** all three documents show the cookie policy's date; raw Markdown renders inside `<pre>`; the side-by-side layout uses flag emoji.
- **Registration:** no Terms or Privacy link, acceptance or age attestation.
- **Terms:** no statement of permanent book ownership, an outdated annual price (a correction is pending in PR #22), a family-size mismatch (4 vs 5), and the provider named as a personal handle.
- **Privacy:** the processor list is incomplete (Resend, hosting, Google Fonts).
- **Cookies:** `localStorage` values are described as session cookies.
- **Premium:** no AI, Noetia+ or NoetiaX disclosures at all.

**Feature reality (VERIFIED):** the premium ecosystem is **APPROVED** (PO-025 to PO-028, PO-003) and essentially **not IMPLEMENTED** on `main`. A minimal research session exists only in unmerged Draft PR #56, whose release is blocked: E-1 OPEN, Checkpoint E NOT QUALIFIED.

**Recommendation (PROPOSED):**
1. Phase 0 is **Package A** (design system) with the policy-neutral foundations of **F** (i18n extraction, style guide) and **G** (legal rendering without text changes).
2. Route the legal items to counsel.
3. Decide the terminology and naming.
4. Design Noetia+/NoetiaX on the new system; implement only after the PO decisions and release gates.

## 2. Existing frontend architecture

All of this is VERIFIED.

| Layer | Web (`services/web`) | Mobile (`services/mobile`) |
|---|---|---|
| Framework | Next.js 14 (App Router), React 18, Tailwind 3.4 with **empty theme**, react-hook-form + zod, socket.io | React Native 0.74 / Expo |
| Routes | 46 `page.tsx`: auth, library and discover, reader, fragments, clubs (incl. live Escucha Juntos), social, billing and pricing, account, onboarding, legal, corporate, admin and author, causas, invite page `/s/[id]` | screens: auth, library, reader, fragments, clubs, account, consent, language, paywall |
| Styling | utility classes; 6 files with inline styles; no component library or tokens | `StyleSheet` with raw hex; no theme; no dark mode |
| i18n | `LanguageProvider` + `useTranslation()` (63 of 107 TSX files); `es.ts`/`en.ts` about 830 lines each, structural parity test; **12 files bypass i18n** with inline ternaries; several screens are hard-coded Spanish | separate `es.ts`/`en.ts` (216 lines each) |
| Navigation | `AppTopBar` (Discover, Profile, Billing) + `BottomNav` (Library, Discover, Clubs, Profile) | stacks and tabs |
| Legal | three TypeScript template strings rendered inside `<pre>` by `LegalPage.tsx` | `ConsentScreen` links to the web legal pages |
| Images | 4 `next/image`, 5 `<img>`; JPEG/PNG only | `share-backgrounds.ts` |
| Tests | Jest, Playwright; no visual regression; no automated accessibility checks | Jest |
| Research UI | **Draft PR #56 only:** `app/(research)/research/[sessionId]`, `components/research/{ResearchSession,CitationDialog}.tsx` | none |

## 3. Noetia core UX/UI

The full evidence is in [Appendix A §2](noetia-ecosystem-ux-audit/A-findings-register.md#2-noetia-core-nc), findings NC-01 to NC-14.

**Key problems (VERIFIED unless noted):**

| Finding | Problem | Priority |
|---|---|---|
| NC-03 | Registration has no Terms/Privacy link, acceptance or age attestation | **P0** |
| NC-04 | Billing page is Spanish-only | **P0** |
| NC-08 | Share editor loads Google Fonts from Google's CDN (privacy disclosure gap) | **P0** |
| NC-11 | The book plan is named "Noetia Premium", which collides with the premium tiers; "Acceso completo a la biblioteca" is ambiguous | **P0** |
| NC-12 | Account deletion relies on a warning; billing can continue after deletion (NOF-004 F-1) | **P0** |
| NC-01/02 | Landing: mixed-language metadata, an unverifiable "first" claim, copy outside i18n, off-brand gradient, emoji icons | P1 |
| NC-05 | Navigation has no home for fragments, legal or future premium | P1 |
| NC-06/07 | Dense reader top bar (7 buttons, 3 links) and share editor (21 buttons, 8 inputs); cognitive load INFERRED | P1 |
| NC-09/10 | Spanish-only and mixed-language strings; author portal claims "miles de lectores" | P1 |

**Proposed information architecture:**
- **Shell:** one shell.
- **Bottom navigation (mobile) / side rail (desktop):** Biblioteca · Descubrir · **Investigar** (premium hub; an explanatory page when the user has no entitlement) · Clubes · Perfil.
- **Profile contains:** Mis fragmentos, Cuenta y facturación, Privacidad, Legal.
- **Reader:** fully usable regardless of entitlement (PO-026, `docs/noetia-plus/17-web-mobile-ux.md`).

## 4. Noetia+ research experience

**Status:**
- **APPROVED:**
  - 3-book sessions with a lock at the first analysis (PO-027);
  - This Book / My Knowledge / Expand with provenance separation (PO-003);
  - Ask My Highlights (PO-028);
  - Research Briefs (PO-025);
  - book-subscription prerequisite (PO-026).
- **Implemented on `main`:** none of it.
- **Draft PR #56 (`860f531`):** session page, book list with lock notice, question/answer with stages, citation dialog, exclusions, error copy.

**Findings NP-01 to NP-11** ([Appendix A §3](noetia-ecosystem-ux-audit/A-findings-register.md#3-noetia-np)):

| Finding | Problem | Priority |
|---|---|---|
| NP-01 | All entitlement causes collapse into one message | P0 pre-launch |
| NP-02 | No session-creation or book-selection UI | P0 pre-launch |
| NP-04 | Provenance label "Síntesis" doesn't express ADR-003's "broader context, not from your books" | P0 |
| NP-05 | Modes not represented | P1 |
| NP-06 | Ask My Highlights absent | P1 |
| NP-07 | Citation opens the last reading position instead of the cited phrase | P1 |
| NP-08 | Jargon "Bifúrcala" | P1 |
| NP-09 | Vague "capacidad" with no meter | P2 |
| NP-10 | No Research Brief view | P1 |
| NP-11 | Empty results for natural questions (D13) | P1 |

**Proposed layout:**
- **Desktop:** two panes (conversation + source panel).
- **Mobile:** single column with a citation sheet.
- **Provenance:** labels on every answer segment.
- **Modes:** shown in a session-level mode chip.

## 5. NoetiaX advanced research experience

**Status:** APPROVED (PO-025, PO-027: 10 books; qualitatively deeper research) and **not implemented**. No NoetiaX strings or routes exist on any inspected branch.

**Proposals NX-01 to NX-08** ([Appendix A §4](noetia-ecosystem-ux-audit/A-findings-register.md#4-noetiax-nx)):
- **NX-01 Tier differentiation:** the same workspace in a "deep" layout with a source rail, evidence panel and Brief builder. The difference must be **capability**, not the number of books, and this depends on a PO-defined NoetiaX capability set.
- **NX-02 Shared BookPicker** with Noetia+.
- **NX-03 Evidence matrix:** **proposal only**.
- **NX-04 Disagreement and uncertainty sections:** verbal hedging, no numeric confidence.
- **NX-05 to NX-08:** side-by-side citations, saved research, responsive collapse to per-claim cards, and reuse of the PR #56 state vocabulary.

Minimalism is preserved through progressive disclosure: depth on demand, never all panels at once.

## 6. Shared visual design system

Findings SH-01 to SH-08 are in [Appendix A §1](noetia-ecosystem-ux-audit/A-findings-register.md#1-shared-design-system-sh).

**Proposed tokens (PROPOSED; contrast values VERIFIED by calculation):**

| Token | Light | Dark | Rule |
|---|---|---|---|
| `brand.navy` | `#0D1B2A` | — | primary dark surface, wordmark |
| `brand.emerald` | `#34D399` | `#34D399` | accent **on navy only** (9.05:1); never text or button fill on white (1.92:1) |
| `accent.onLight` | `#047857` (5.48:1) · `#065F46` (7.68:1) | — | links and primary buttons on light surfaces |
| `surface.page` / `surface.raised` | `#FCFCFD` / `#FFFFFF` | `#0D1B2A` / `#13263A` | reader paper reuses `#FCFCFD` |
| `text.primary` / `text.secondary` | `#111827` / ≥ `#4B5563` | `#F3F4F6` / `#CBD5E1` | secondary ≥ 4.5:1; retire `gray-400` for text |
| `state.warning` (text) | `#B45309` (5.02:1) | — | not `#D97706` (3.19:1) |
| `provenance.library` / `general` / `notes` | distinct, AA-checked | — | research labels only |

**Typography:** self-hosted via `next/font`.
- **Serif** (Merriweather or Playfair, already used in quote cards) for reading and editorial headings.
- **Sans** (Lato, already used, or Inter) for UI.
- **Scale:** 13 / 15 / 16 / 18 / 22 / 28 / 36.
- **Reader body:** 18–20 px, line height 1.6.

**Components:** Button, IconButton (required accessible name), Field, Card, Sheet/Dialog (focus-trapped), Tabs, Toast, EmptyState, StatusStage, CitationChip, ProvenanceLabel, BookCover, BookPicker, LegalDocument.

**Icons and motion:** one open-source SVG set replaces emoji used as icons; transitions of 150–200 ms honour `prefers-reduced-motion`.

**Framework and mobile:** keep Next.js + Tailwind, with CSS-variable tokens for light/dark. On mobile, mirror the tokens in `theme.ts`. No new framework or paid service.

## 7. Existing imagery, covers and quote-card backgrounds

The full inventory and measurements are in [Appendix D](noetia-ecosystem-ux-audit/D-visual-assets.md). Findings VA-01 to VA-09 are in [Appendix A §7](noetia-ecosystem-ux-audit/A-findings-register.md#7-visual-assets-va).

**Backgrounds (viewed and measured):**
- **Set:** 18 images in a cohesive "calm nature" style, in four aspect ratios.
- **Resolution:** 1,200 px is too small for 1080×1920 stories without upscaling.
- **Legibility:** strict worst-case text contrast fails for both colours on 1, 2, 4, 8, 10, 11, 12, 15 and 16, and 12 is the busiest.

**Background recommendations:**

| Action | Images |
|---|---|
| Retain | 3, 5, 6, 9, 13, 14, 17, 18 |
| Retain with a scrim token | 1, 2, 4, 7, 8, 10, 11, 15, 16 |
| Revise or remove | 12 |

Supplement the set with portrait masters, two text-first textures, and per-image `{tone, textColor, safeArea, focalPoint}` metadata. Serve WebP/AVIF. Image provenance and licences are **not verified**.

**Covers (viewed):**
- **Set:** 11 local covers at 400×600, in mixed styles.
- **Collision:** the *Cuentos de la Selva* title collides with its author line.
- **Readability:** tiny labels are unreadable.
- **Recommendation:** one template, 800×1200 masters, and a consistent frame for Open Library covers (not inspected).

**Brand:** no web logo, favicon or Open Graph image (SH-08). Mobile icons were **not viewed**.

## 8. Mobile and desktop responsiveness

All PROPOSED. The current responsive behaviour is INFERRED from the classes used; nothing was rendered.

- **Breakpoints:** 360 (minimum), 768, 1024 (two-pane), 1440 (optional third research pane).
- **Mobile:**
  - five-item bottom navigation;
  - tap targets ≥ 44 px;
  - research as a single column with a citation bottom sheet;
  - NoetiaX matrices as per-claim cards;
  - no horizontal scrolling for core content.
- **Desktop:**
  - side rail;
  - research conversation and sources side by side;
  - sticky legal table of contents.
- **Native mobile:** shares the tokens. Premium ships web first, then mobile Ask (`docs/noetia-plus/17-web-mobile-ux.md`).

## 9. Competitor comparison

> **Limitation:** no competitor interface was inspected for this assessment. Every observation is an **assumption** from general product knowledge and must be verified with current captures before design decisions. No proprietary design is to be copied.

| Competitor | Assumed strengths (unverified) | Lesson for Noetia |
|---|---|---|
| Storytel | audio-first, simple library, strong covers | Covers and audio controls carry the brand (Package E) |
| Readwise Reader | highlight-centric workflow, search, export | Fragments deserve a first-class home (NC-05) |
| Fable | social reading and clubs, warm tone | Calmer club visuals, clear roles |
| Blinkist / Headway | short summaries, goal-based onboarding, streaks | Keep onboarding short; differentiate on full books + provenance |
| NotebookLM | source-grounded Q&A, inline citations, source panel | Source panel and inline citations are table stakes; differentiate with the owned library, audio sync and reader deep links |
| Elicit | evidence tables across sources | Inspiration for NX-03 (proposal only) |

**Defensible differentiation:**
- a permanently owned library;
- phrase-synced audio and text;
- citations that return to the exact reading position;
- explicit provenance separation (ADR-003).

## 10. Spanish interface-content review

Details are in [Appendix B §2](noetia-ecosystem-ux-audit/B-content-audit-es-en.md#2-spanish-assessed-independently).

**Overall (VERIFIED):** natural, warm, consistent "tú" register. Issues:

| Finding | Issue |
|---|---|
| CT-01 | "Modo escucha activa" lowercases the proper noun |
| CT-02 | "Noetia Clubs" instead of "Clubes de Lectura" |
| CT-03 | Divergent error templates |
| CT-04 | Title Case ("Mis Estadísticas de Lectura") |
| CT-05 | Calques: "Tu cuenta no ha sido cobrada", "Discute frase a frase" |
| CT-06 | Over-exclamatory empty state |
| CT-07 | Jargon "Bifúrcala" (PR #56) |
| — | Gendered slash "Bienvenido/a" (emails) |
| CT-12 | Unsupported claims ("miles de lectores", "primer intento deliberado…") |

The research copy on PR #56 is recommended as the **tone reference** for premium copy.

## 11. English interface-content review

Details are in [Appendix B §3](noetia-ecosystem-ux-audit/B-content-audit-es-en.md#3-english-assessed-independently).

| Finding | Issue |
|---|---|
| CT-08 | "Fragment" (about 30 occurrences) reads as a mechanical translation; English readers expect "highlight" (**PO decision**) |
| CT-09 | "Active Listening" translates the brand term (**PO decision**) |
| CT-10 | Terse system-style errors |
| — | Mixed "Clubs" / "Reading Club" |
| NC-14 | Hard-coded English "Unlimited books" in unused `plan-utils` |
| — | **Missing English:** billing, author portal, admin, waitlist, cause selector, email verification, collection page, discover clubs promo ([inventory](noetia-ecosystem-ux-audit/B-content-audit-es-en.md#4-hard-coded-string-inventory)) |

## 12. Bilingual terminology and writing consistency

The terminology table and an 11-rule style guide are in [Appendix B §5–6](noetia-ecosystem-ux-audit/B-content-audit-es-en.md#5-bilingual-terminology).

**Items requiring PO decisions:**
- English term for *Fragmento*;
- Escucha Activa as a brand name in English;
- "Suscripción Noetia" replacing "Noetia Premium";
- Spanish name for Research Brief;
- usage units (D10).

**Core rules:**
- sentence case;
- "…" for loading;
- statement + action for errors;
- no unverifiable superlatives;
- no capability claims before release;
- upgrade copy as "what you can do + what you need";
- citations name the book and location;
- general knowledge always labeled;
- all strings through i18n.

## 13. Terms of Service — Spanish and English

Details are in [Appendix C §2](noetia-ecosystem-ux-audit/C-legal-assessment.md#2-terms-of-service--findings-es-and-en). English mirrors Spanish on every key fact checked.

| Finding | Issue |
|---|---|
| LG-05 | Annual prices outdated ($80.99 / $125.99 / $170.99); Draft PR #22 proposes $83.99 / $129.99 / $179.99, pending legal review |
| LG-06 | Family "up to 4" vs product and UI "5" |
| LG-07 | **No permanent-ownership clause** (approved policy, PO-025/026); public domain described as "open licences" |
| LG-08 | Provider named "Carloskfe / Noetia" |
| LG-09 | Cancellation path differs from implementation (Stripe portal only); no statutory withdrawal statement |
| LG-10 | 30-day promotional tokens undisclosed |
| LG-11 | Spanish law vs a New York operator |
| LG-12 | No AI or premium terms |

## 14. Privacy Policy — Spanish and English

Details are in [Appendix C §3](noetia-ecosystem-ux-audit/C-legal-assessment.md#3-privacy-policy--findings-es-and-en).

| Finding | Issue |
|---|---|
| LG-13 | Controller "operada por Carloskfe" |
| LG-14 | Missing processors (Resend, hosting, Google Fonts); Apple Sign In possibly listed ahead of configuration (INFERRED) |
| LG-15 | Retention and portability claims not matched by code (NOF-004 F-14) |
| LG-16 | No research or AI data categories |
| LG-17 | No international transfers section |

## 15. Cookie Policy — Spanish and English

Details are in [Appendix C §4](noetia-ecosystem-ux-audit/C-legal-assessment.md#4-cookie-policy--findings-es-and-en).

| Finding | Issue |
|---|---|
| LG-18 | `access_token`, `user_type` and `noetia_consent` described as cookies with session or 1-year durations; implemented as persistent `localStorage` |
| LG-19 | Undisclosed storage (`noetia_lang`, reader preferences, `email_confirmed`) |
| LG-20 | Analytics described, but no analytics script exists |
| — | Stripe Checkout and Google Fonts third-party requests not addressed |

## 16. Subscription, billing and cancellation disclosures

VERIFIED; behaviour items cite NOF-004.

| Item | Published | Behaviour | Gap |
|---|---|---|---|
| Monthly prices | $8.99 / $13.99 / $18.99 (Terms, pricing, mobile) | Stripe plans (not queried) | consistent |
| Annual prices | Terms $80.99 / $125.99 / $170.99 | Draft PR #22 correction pending | **outdated Terms** |
| Trial | Pricing "14 días de prueba gratuita. Cancela cuando quieras."; Terms "cuando esté disponible" | every checkout gets 14 days, no once-per-customer limit (F-5) | inconsistent; no auto-renewal statement next to the CTA (LG-21) |
| Cancellation | "desde tu configuración de cuenta" | Stripe portal only (F-7) | mismatch |
| Renewal notice | none | none | counsel (NOF-004 row 10) |
| Subscription emails | — | none sent by Noetia (F-8) | — |
| Token expiry | 90 days | paid 90 days, promotional 30 days (F-10) | partial disclosure |
| Account deletion | warning to cancel first | deletion doesn't cancel Stripe (F-1) | **risk** |
| "2 meses gratis" | `i18n/es.ts:342` | depends on final annual prices | verify (LG-22) |

## 17. Premium AI research and data-processing disclosures

**Approved policy exists; customer-facing disclosure does not.** Details are in [Appendix C §5](noetia-ecosystem-ux-audit/C-legal-assessment.md#5-premium-noetia--noetiax-coverage).

Required before any Noetia+/NoetiaX launch, in recommended order:
1. **Accuracy:** AI-assisted answers may be inaccurate (PO-003).
2. **Provenance:** explanation of provenance labels; never attributing general knowledge to a book.
3. **Permitted analysis:** permitted AI analysis of copyrighted works and anti-reconstruction (PO-002; PO-029 is **DRAFT**).
4. **Privacy:** research-session and highlight privacy (PO-028).
5. **Providers and training:** AI provider processing (TT-22 open) and the no-training commitment (PO-002).
6. **Data lifecycle:** retention, deletion and export of conversations and Briefs (not decided).
7. **Prerequisite:** an active book subscription is required (PO-026).
8. **Separation:** book ownership ≠ book tokens ≠ AI usage (PO-001, PO-025, PO-026).
9. **Limits:** 3/10-book limits and the lock (PO-027).
10. **Usage units** (D10, TT-13).
11. **Trust page:** reconcile its AI statements (LG-23).

## 18. Legal-page usability and accessibility

Details are in [Appendix C §6](noetia-ecosystem-ux-audit/C-legal-assessment.md#6-legal-ux-and-acknowledgment-proposal).

**Current (VERIFIED):**
- `<pre>` rendering of raw Markdown (LG-02);
- inert `prose` classes (no typography plugin);
- always side by side with flag emoji (LG-03);
- one shared date (LG-01);
- failing contrast on the status banner (3.19:1) and the date (2.54:1) (LG-04);
- no table of contents, anchors, versions or print styles.

**Proposed:**
- **Document:** a language-aware single document with a language switch and `hreflang`.
- **Source and rendering:** structured per-language, per-version source; semantic headings, lists and tables.
- **Navigation and status:** a header with version, effective date and change summary; sticky or collapsible table of contents.
- **Acknowledgment:** at registration and checkout, re-acceptance on material change, and premium activation.
- **Evidence of acceptance:** stored, which needs a separately authorized schema.
- **Behaviour mapping:** a statement-to-behaviour map that gates publication.
- **Accessibility:** AA typography.

## 19. Approved versus implemented versus proposed capabilities

| Capability | APPROVED | IMPLEMENTED (`main@6a5e5c0`) | Draft only | PROPOSED here |
|---|---|---|---|---|
| Reader, Escucha Activa, fragments, share cards, clubs | ✔ | ✔ | — | redesign on tokens |
| Bilingual web UI | ✔ | partial (gaps in §10–11) | — | full parity |
| Legal documents ES/EN | ✔ (MVP, "subject to legal review") | ✔ (rendered in `<pre>`) | PR #22 price fix (`d254eea`) | legal UX (§18) |
| Signup acceptance and age attestation | — | ✘ | — | ✔ |
| Noetia+ session (3 books, lock) | ✔ PO-027 | ✘ | server + minimal UI, PR #56 (`860f531`) | full UI |
| NoetiaX (10 books, deeper research) | ✔ PO-025/027 | ✘ | server limit only (`860f531`) | deep layout, evidence panel |
| Premium prerequisite | ✔ PO-026 | ✘ | NEM-019 (Draft PR #46) | entitlement states |
| This Book / My Knowledge / Expand | ✔ PO-003 (names open) | ✘ | ✘ | mode chips |
| Ask My Highlights | ✔ PO-028 | ✘ | ✘ | fragment-sheet entry |
| Research Briefs | ✔ PO-025 | ✘ | ✘ | Brief view |
| Citations with reader deep link | ✔ intent (`17-web-mobile-ux.md`) | ✘ | dialog that opens the last position (`860f531`) | phrase deep link |
| Evidence matrix, argument map | ✘ | ✘ | ✘ | **proposal only** |
| Eligible research corpus | PO-029 **DRAFT** | partial (rights records) | — | eligibility badges |

## 20. Identified design and content problems

The complete register is [Appendix A](noetia-ecosystem-ux-audit/A-findings-register.md): 87 findings.

| Category | Finding IDs |
|---|---|
| Shared design system | SH-01 to SH-08 |
| Noetia core | NC-01 to NC-14 |
| Noetia+ | NP-01 to NP-11 |
| NoetiaX | NX-01 to NX-08 |
| Content | CT-01 to CT-13 |
| Legal | LG-01 to LG-24 |
| Visual assets | VA-01 to VA-09 |

Every finding records product, component, source file and line, branch and commit, existing behaviour, problem, recommendation, evidence class, priority, effort and required approval.

## 21. Prioritized recommendations

**P0 — before customer acquisition or launch:**
- SH-01, SH-02, SH-06 (tokens, fonts, accessibility minimums);
- NC-03 (registration acknowledgment);
- NC-04 (billing i18n);
- NC-08 (self-host fonts);
- NC-11 (plan naming);
- NC-12 (deletion flow);
- LG-01, LG-02 (legal rendering and dates);
- LG-05 to LG-09, LG-13, LG-14, LG-21 (counsel);
- **before premium launch:** NP-01, NP-02, NP-04, NX-01, NX-02, LG-12, LG-16.

**P1:**
- SH-03, SH-04, SH-07, SH-08;
- NC-01, NC-02, NC-05, NC-06, NC-07, NC-09, NC-10;
- NP-03, NP-05, NP-06, NP-07, NP-08, NP-10, NP-11;
- NX-04, NX-07, NX-08;
- CT-01, CT-02, CT-07 to CT-09, CT-11 to CT-13;
- LG-03, LG-04, LG-10, LG-11, LG-15, LG-17 to LG-19, LG-23, LG-24;
- VA-01 to VA-03, VA-05, VA-06.

**P2:** all remaining items.

## 22. Component reuse and engineering dependencies

**Reuse:**

| Component | Used by |
|---|---|
| **BookPicker** | club book picker, Noetia+ (3), NoetiaX (10), Ask My Highlights scope |
| **BookCover** | library, discover, research rails, club cards |
| **CitationChip / CitationSheet** | Noetia+, NoetiaX, Research Brief, Ask My Highlights |
| **ProvenanceLabel** | every research answer and Brief |
| **StatusStage** (from PR #56) | research turns, share rendering, uploads, checkout redirect |
| **EmptyState / ErrorState** | whole app |
| **Sheet/Dialog** | share editor, chapter sheet, fragment sheet, citations, consent |
| **LegalDocument + AcknowledgmentCheckbox** | all legal surfaces, including a mobile WebView |
| **ThemeProvider** | reader, shell, research |

**Dependencies:**

| Package | Depends on |
|---|---|
| A | none |
| B | A |
| C | A, B (navigation), PO-029 decision, NEM-019 entitlement merge, NEM-024 release gates (E-1 OPEN, Checkpoint E NOT QUALIFIED), naming decisions |
| D | A, C components, NoetiaX capability decision |
| E | A (scrim and theme tokens), `image-gen` templates |
| F | A, PO terminology |
| G | A (renderer), counsel, PO; acceptance evidence needs a separately authorized schema |
| H | all |

## 23. Proposed implementation packages

These are **planning proposals only**, not authorizations. Full detail is in §27.

| Package | Scope | Can start without new decisions? | Relative effort |
|---|---|---|---|
| A — Unified Design System | tokens, fonts, components, icons, themes | **Yes** | High |
| B — Noetia Core Experience | navigation, reader settings, share editor, landing, billing | mostly (terminology waits) | Medium–High |
| C — Noetia+ Research Experience | selection, workspace, provenance, modes, highlights, Brief | **No** | High |
| D — NoetiaX Advanced Research | deep layout, evidence components | **No** | High |
| E — Images and Visual Assets | scrims, masters, metadata, covers, logo | mostly | Medium |
| F — Spanish and English Content | i18n extraction, style guide, terminology | foundation yes; terms no | Medium |
| G — Legal Presentation and Disclosures | renderer and dates (yes); text and acknowledgment (no) | split | Medium |
| H — Accessibility and Final Validation | axe, visual regression, bilingual QA | yes, continuous | Medium |

**Bundling:**
- A + F-foundation + G-presentation share component work (Phase 0).
- C and D share BookPicker, Citation and Provenance components, so design them together even if built in sequence.

## 24. Product Owner decisions required

1. **Terminology:**
   - English "Highlight" vs "Fragment";
   - Escucha Activa as a brand name in English;
   - "Suscripción Noetia" replacing "Noetia Premium";
   - Spanish name for Research Brief.
2. **Final names** of This Book / My Knowledge / Expand and the provenance labels (PO-003 left these to UX).
3. **Navigation:** the "Investigar" hub and the five-item model.
4. **NoetiaX capability set** beyond 10 books, including whether the evidence matrix is in scope.
5. **Usage units and meter** (D10, TT-13).
6. **Plan benefits:** what the book plan includes ("biblioteca completa"), which depends on the access-rule decisions in NOF-004 F-2/F-3.
7. **Family size:** 4 or 5 members.
8. **Claims policy:**
   - remove or substantiate "first platform" and "miles de lectores";
   - verify the Causas donation mechanism.
9. **D13** empty-state handling (copy only; no retrieval change).
10. **Package order** and authorization (§27).

## 25. Legal-counsel review requirements

The full list is in [Appendix C §7](noetia-ecosystem-ux-audit/C-legal-assessment.md#7-items-requiring-qualified-legal-counsel).

1. **Provider identity** (entity, address).
2. **Governing law and jurisdiction.**
3. **Commercial terms:** annual prices (PR #22), family size, token classes and expiries, trial terms.
4. **Consumer rights:** withdrawal and refunds; auto-renewal and renewal notice.
5. **Ownership:** permanent-ownership clause; the public-domain description.
6. **Privacy:** processors, transfers, retention and portability vs implementation.
7. **Cookies:** storage-type accuracy, undisclosed storage, the analytics description.
8. **Premium:** AI and privacy terms (§17).
9. **Acceptance:** evidence and age attestation.
10. **Trust page:** AI statements.

Any wording in this report is a recommendation for counsel, not proposed final legal text.

## 26. Visual evidence limitations

See [Appendix E §3](noetia-ecosystem-ux-audit/E-evidence-method-and-limitations.md#3-limitations-explicit).

**Viewed:** the 18 backgrounds and 11 local covers, as contact sheets.

**Not captured or viewed:**
- rendered web screens (any breakpoint, language or theme);
- native mobile screens and app icons;
- rendered `image-gen` quote cards;
- Open Library covers in the grid;
- the PR #56 research screen rendered;
- competitor interfaces.

**Must be captured before high-fidelity design approval:**
1. Web screens at 360 and 1024 px, in ES and EN, light and dark: landing, register, onboarding, library, discover, collection, reader (paged and scroll, Escucha Activa), fragment sheet, share editor, pricing, billing, profile, clubs and live session, legal pages.
2. Native mobile equivalents.
3. Quote cards in all six formats.
4. Brand and app icons.
5. The cover grid with remote covers.
6. The research session (PR #56).
7. Current competitor captures.

## 27. Design-to-Code Handoff for Future Claude Code Missions

> **Planning proposals only.** None of the packages below authorizes implementation, a mission, a branch or a merge. Each future mission requires an explicit Product Owner authorization naming it.

### Package A — Unified Design System

- **Sequence:** 1 (Phase 0).
- **Reusable today:**
  - reader paper and frame colours (`components/PagedReader.tsx:208-212`);
  - quote-card font set (`public/presets`, `lib/share-utils.ts` `FONTS`);
  - `components/research/*` semantic structure (`860f531`).
- **Proposed changes:**
  - tokens as CSS variables + `tailwind.config.ts` theme (§6);
  - self-hosted fonts via `next/font`;
  - the component kit (§22);
  - SVG icon set;
  - light/dark themes;
  - a codemod replacing raw palette and hex classes;
  - lint rules (no raw palette classes, no arbitrary hex, required `aria-label` on IconButton);
  - mobile `theme.ts`.
- **Dependencies:** none.
- **Design approval:** token values, type pairing, component specifications.
- **Product decisions:** none blocking (brand colours already defined).
- **Complexity:** High (touches every screen; mitigated by the codemod).
- **Tests and acceptance:**
  - token contrast unit test (all text pairs ≥ 4.5:1);
  - lint finds 0 raw palette classes;
  - Playwright visual baselines for the route × locale × theme × breakpoint matrix;
  - no third-party font requests.

### Package B — Noetia Core Experience

- **Sequence:** 2.
- **Reusable:** `PagedReader`, `PhraseRenderer`, `ShareModal` logic, `FragmentSheet`, `ChapterSheet`, `BottomNav`/`AppTopBar` shells, existing i18n keys.
- **Proposed changes:**
  - five-item navigation and the Profile hub (NC-05);
  - reader settings sheet (NC-06);
  - share-editor progressive disclosure (NC-07);
  - landing redesign and copy (NC-01/02);
  - billing and other Spanish-only screens (NC-04, NC-09, NC-10);
  - deletion flow showing billing state (NC-12, copy);
  - removal of dead `PlanCard` (NC-14).
- **Dependencies:** A; F for copy.
- **Design approval:** information architecture, reader and share flows.
- **Product decisions:** navigation model (§24.3); plan naming (§24.1).
- **Complexity:** Medium–High.
- **Tests and acceptance:**
  - existing reader and sync unit tests unchanged and green;
  - first share in ≤ 3 decisions;
  - every primary destination reachable in ≤ 2 taps;
  - axe 0 serious or critical issues.

### Package C — Noetia+ Research Experience

- **Sequence:** 3 (after release gates and decisions).
- **Reusable:** `ResearchSession`, `CitationDialog`, `lib/research.ts`, research i18n (all on `860f531`, unmerged); `StatusStage` vocabulary; exclusion messages.
- **Proposed changes:**
  - entitlement states (NP-01);
  - BookPicker with lock confirmation (NP-02);
  - two-pane layout (NP-03);
  - ProvenanceLabel (NP-04);
  - mode chip (NP-05);
  - Ask My Highlights entry (NP-06);
  - "Ir al pasaje" (NP-07, needs reader authorization);
  - jargon fix (NP-08);
  - usage meter (NP-09);
  - Brief view (NP-10);
  - empty-state guidance (NP-11).
- **Dependencies:** A, B; NEM-019 merge; NEM-024 release (E-1 OPEN, Checkpoint E NOT QUALIFIED); PO-029 decision.
- **Design approval:** workspace layouts, Brief design.
- **Product decisions:** §24.2, §24.5, §24.9; TT-27 for highlights; pricing (TT-16) for upgrade paths.
- **Complexity:** High.
- **Tests and acceptance:**
  - every entitlement code maps to a distinct actionable message;
  - the lock is explained before the first question;
  - no answer segment lacks a provenance label;
  - no full-book passage appears in a highlights answer;
  - citation lands on the cited phrase;
  - bilingual QA.

### Package D — NoetiaX Advanced Research Experience

- **Sequence:** 4.
- **Reusable:** all Package C components; PR #56 state vocabulary.
- **Proposed changes:**
  - deep layout (NX-01);
  - 10-book BookPicker with grouping (NX-02);
  - disagreement and uncertainty sections (NX-04);
  - side-by-side citations (NX-05);
  - responsive collapse (NX-07);
  - evidence matrix (NX-03) and saved research (NX-06) **only if approved**.
- **Dependencies:** C; the NoetiaX capability decision; data-model authorization for NX-06.
- **Design approval:** deep-layout and evidence-component specifications.
- **Product decisions:** §24.4.
- **Complexity:** High.
- **Tests and acceptance:**
  - users can name at least two capabilities that differ from Noetia+ (usability test);
  - usable at 360 px;
  - every evidence cell is cited or marked "sin evidencia".

### Package E — Images and Visual Assets

- **Sequence:** 2, in parallel with B.
- **Reusable:** the 18 backgrounds (8 as-is, 9 with scrim), `getTextColor`, `image-gen` templates.
- **Proposed changes:**
  - scrim token;
  - per-image metadata;
  - portrait masters at 1920 px or taller;
  - two text-first textures;
  - revise or remove imagen-12;
  - cover template system at 800×1200 and the *Cuentos de la Selva* fix;
  - consistent frame for remote covers;
  - SVG logo, favicon and Open Graph images;
  - WebP/AVIF via `next/image`;
  - provenance and licence record per background.
- **Dependencies:** A.
- **Design approval:** art direction, cover template, logo.
- **Product decisions:** cover policy for author-supplied covers; asset licensing.
- **Complexity:** Medium.
- **Tests and acceptance:**
  - asset script validates dimensions, metadata presence and size budgets;
  - rendered quote cards meet ≥ 4.5:1 for text over the scrim in all formats.

### Package F — Spanish and English Content

- **Sequence:** 1 (foundation) and 2 (terminology-dependent copy).
- **Reusable:** `LanguageProvider`, `es.ts`/`en.ts`, parity test, mobile catalogues, research copy as the tone reference.
- **Proposed changes:**
  - extract all hard-coded and ternary strings ([Appendix B §4](noetia-ecosystem-ux-audit/B-content-audit-es-en.md#4-hard-coded-string-inventory)) into catalogues;
  - apply the style guide;
  - fix CT-01 to CT-13;
  - server-side `lang` (SH-07);
  - locale-specific metadata;
  - lint rule banning JSX literals and `=== 'es' ?` outside i18n;
  - pseudo-locale test.
- **Dependencies:** A (components), PO terminology.
- **Design approval:** none (content).
- **Product decisions:** §24.1, §24.8.
- **Complexity:** Medium.
- **Tests and acceptance:**
  - parity test extended to all screens and mobile;
  - 0 hard-coded user-facing literals;
  - native-speaker review sign-off in both languages.

### Package G — Legal Presentation and Disclosures

- **Sequence:**
  - **presentation** in 1 (no text change);
  - **content and acknowledgment** in 3, after counsel.
- **Reusable:** existing legal text as content; `ConsentScreen` (mobile); `CookieBanner`/`CookiePreferencesModal`; the PR #22 placeholder-gate pattern.
- **Proposed changes:**
  - **Presentation:**
    - `LegalDocument` renderer (semantic headings, tables, table of contents, anchors);
    - per-document version and date;
    - language-aware view with a switch;
    - AA status styling.
  - **After counsel:**
    - corrected Terms, Privacy and Cookie content;
    - premium terms;
    - registration, checkout and premium acknowledgments;
    - acceptance-evidence storage (separately authorized schema);
    - statement-to-behaviour map gating publication.
- **Dependencies:** A; counsel; PO; NOF-004 engineering fixes for the behaviours referenced (F-1, F-2, F-3, F-7).
- **Design approval:** legal page layout and acknowledgment components.
- **Product decisions:** §24.6, §24.7; legal entity details.
- **Complexity:** Medium (UI); Medium (acceptance evidence).
- **Tests and acceptance:**
  - no `<pre>` rendering;
  - each document shows its own version and date (test);
  - acceptance recorded with document version and language;
  - publication gate fails while any mapped behaviour is unresolved.

### Package H — Accessibility and Final Validation

- **Sequence:** continuous; final gate after each package.
- **Reusable:** Playwright and Jest infrastructure.
- **Proposed changes:**
  - `@axe-core/playwright` on every route;
  - visual-regression baselines (route × es/en × light/dark × 360/1024);
  - keyboard-path tests;
  - reduced-motion checks;
  - 200% text-resize checks;
  - Lighthouse budgets (mobile performance ≥ 90 and accessibility ≥ 95 on landing, library and reader);
  - bilingual QA checklist.
- **Dependencies:** each package's output.
- **Design approval:** baseline sign-off.
- **Product decisions:** none.
- **Complexity:** Medium.
- **Tests and acceptance:**
  - axe 0 serious or critical issues;
  - visual diffs reviewed and approved;
  - WCAG 2.2 AA checklist passed per release.

### Recommended documentation structure for the future design track (not created)

```
docs/design/ecosystem-ux/
  README.md                       status legend (APPROVED / IMPLEMENTED / PROPOSED)
  01-assessment.md                → links to this report
  02-design-system.md             tokens, typography, components, themes
  03-content-style-guide.md       from Appendix B §5–6
  04-information-architecture.md  §3, §5
  05-research-experience.md       §4–5
  06-legal-ux.md                  from Appendix C §6
  07-asset-inventory.md           from Appendix D
  08-roadmap.md                   §23, §27
  evidence/                       captures listed in §26
```

`docs/noetia-plus/17-web-mobile-ux.md` should cross-link this design track.

## 28. Final recommendations and review status

1. Authorize **Phase 0: Package A + Package F foundation + Package G presentation**. It is policy-neutral, removes the brand drift and fixes the legal rendering defects without changing legal text.
2. Send §25 to qualified legal counsel. Prioritize provider identity, ownership, consumer-rights disclosures, processor completeness and premium AI terms.
3. Decide §24 items 1–4 before high-fidelity design.
4. Keep Noetia+/NoetiaX implementation behind the existing gates. E-1 remains OPEN and BLOCKED; Checkpoint E remains NOT QUALIFIED; production release remains BLOCKED; PO-052 remains accepted. Design work can proceed; implementation cannot.

**Review status:**

| Item | Status |
|---|---|
| Independent PA review | **AWAITING** |
| Product Owner implementation approval | **NOT GRANTED** |
| Changes | Documentation only |
