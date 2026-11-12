# Noetia — Quiet Editorial Visual Specification (Prototype Phase)

**Status:** design direction **APPROVED** by the Product Owner (2026-11-12). These prototypes and this specification are **design artifacts, not an implementation**, and are awaiting PA review and PO approval. Noetia+ and NoetiaX screens are **conceptual**: those tiers are approved but not implemented, and their release is blocked.

**Sources:** [Assessment](../../../reports/2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md) and Appendices [A–G](../../../reports/noetia-ecosystem-ux-audit/); prototypes in [`src/`](src/); screenshots in [`screenshots/`](screenshots/).

## 1. Principles

1. **The book is the interface.** Paper and ink first; colour is a signal, never decoration.
2. **One system, three depths.** Same tokens, shell and components. Noetia+ adds a source panel; NoetiaX adds an on-demand evidence panel (progressive disclosure).
3. **Reading and research are visibly different.** Reading takes place on a paper sheet with no app chrome around the text. Research uses a light workspace in which **every answer segment carries a provenance label**.
4. **Honest states.** Available, in development and conceptual are always labelled. Legal text is a placeholder until counsel approves it.

## 2. Design tokens

All values come from `src/assets/proto.css` and were checked against WCAG 2.x. Implementation target: Tailwind theme and CSS variables (Package A).

### 2.1 Colour

| Token | Value | Role |
|---|---|---|
| `--navy` | `#0D1B2A` | brand surface (public site, app rail, primary buttons in the reader) |
| `--navy-raised` | `#13263A` | the single raised card on navy |
| `--emerald` | `#34D399` | accent **on navy only** |
| `--emerald-ink` | `#047857` | accent on light surfaces (primary button, links, active phrase underline, "from your books") |
| `--emerald-deep` | `#065F46` | badge and citation text on tint |
| `--emerald-tint` | `#E7F8F1` | active-phrase and citation background |
| `--paper` / `--white` | `#FCFCFD` / `#FFFFFF` | reading and app surfaces |
| `--ink` / `--ink-2` / `--ink-3` | `#111827` / `#4B5563` / `#6B7280` | text levels |
| `--on-navy` / `-2` / `-3` | `#FFFFFF` / `#CBD5E1` / `#94A3B8` | text on navy |
| `--warn-ink` / `--warn-bg` | `#B45309` / `#FEF3E2` | "conceptual" flags and warnings |
| `--prov-books` / `--prov-general` / `--prov-notes` | `#047857` / `#4B5563` (hatched) / `#92400E` | provenance labels (research only) |

**Measured contrast (all pass AA):**

| Pair | Ratio | Pair | Ratio |
|---|---|---|---|
| ink on paper | 17.30 | white on emerald-ink (primary button, light) | 5.48 |
| ink-2 on paper | 7.37 | navy on emerald (primary button, dark) | 9.05 |
| ink-3 on paper | 4.72 | emerald on navy / on navy-raised | 9.05 / 8.00 |
| on-navy-2 on navy / raised | 11.72 / 10.35 | on-navy-3 on navy / raised | 6.78 / 6.00 |
| emerald-deep on emerald-tint | 6.99 | ink on emerald-tint (active phrase) | 16.13 |
| ink-2 on info background | 6.72 | warn-ink on warn background | 4.58 |
| prov-books / general / notes on white | 5.48 / 7.56 / 7.09 | "contradicts" `#9F1239` on white | 8.02 |

**Retired:** blue/indigo gradients, `bg-blue-600`, white text on `emerald-500` (2.54:1), `text-gray-400` for text (2.54:1), `text-gray-300` (1.47:1).

### 2.2 Typography

All three families are **repository fonts** in `services/image-gen/fonts`, self-hosted, with no external request.

| Role | Family | Use |
|---|---|---|
| Display | Playfair Display | hero and section headings, Brief titles, quote cards |
| Reading | Merriweather | reader body, research answers, Briefs, highlights |
| UI | Lato | navigation, controls, labels, body UI |

**Scale:** 13 / 15 / 16 / 18 / 22 / 28 / 36 / 48 px. **Line height:** UI 1.55, reading 1.75–1.85.

**Measures:** reading ≤ 70 characters (reader sheet 720 px); answers ≤ 66 characters; legal ≤ 70 characters.

### 2.3 Space, shape, elevation

- 8 px grid. Page gutters: 32 px desktop, 18 px mobile.
- Section rhythm: 88 px on public pages, 56 px on mobile.
- Radius: 16 px cards, 12 px buttons and inputs, 999 px pills.
- **One card treatment per surface:** white card with a hairline border on light; `navy-raised` card on navy.
- Shadow only on floating elements: reader sheet, popovers, quote cards.

### 2.4 Icons

**One outline family:** 24 px grid, 1.5 px stroke, round caps. Defined once as an SVG sprite in `tools/build_prototypes.py` (`ICONS`). There are no emoji in the UI. Causes use paw, child and leaf icons; clubs use chat, headphones and vote icons.

### 2.5 Motion

None in the prototypes. Implementation: 150–200 ms opacity and transform only, honouring `prefers-reduced-motion`. The active-phrase highlight is the only continuous motion in the product.

## 3. Components

The examples live in the prototypes; names are proposals for `services/web/components/ui/*`.

| Component | Variants and rules | Seen in |
|---|---|---|
| `Button` | primary (emerald-ink, or emerald on navy), secondary (outline), text; `sm`/`block` | every page |
| `Badge` | `ok` (Available or Active), `dev` (In development), `concept` (Conceptual or X-P) | tiers, research |
| `Card` | light / dark (one treatment each) | every page |
| `PublicHeader` + `MobileMenu` | 4 product links, ES/EN, Sign in, Create account; menu sheet below 760 px | `public`, `public-menu` |
| `HeroDemo` | reader sheet + capture chip + quote card; labelled illustration; public-domain text | `public` |
| `StepList`, `TierCards`, `FeatureRows`, `CtaBand` | — | `public` |
| `Footer` (single) | 4 columns → 2 on mobile; legal column always present | `public` |
| `AppShell` | navy rail (desktop) / bottom tab bar (mobile); the five-item model Biblioteca · Descubrir · Investigar · Clubes · Perfil | app pages |
| `BookCover`, `ContinueCard` | consistent frame and shadow; progress bar | `core-library` |
| `ReaderSheet`, `ReaderTopBar`, `ReadingSettingsSheet`, `AudioBar`, `SelectionPopover` | top bar with ≤ 3 visible tools; settings grouped; popover actions Guardar · Compartir · (Noetia+) Preguntar | `core-reader` |
| `HighlightItem` | serif quote, emerald rule, source and actions | `core-fragments` |
| `CardEditor` | stepper Formato → Fondo → Texto; live preview; fit control; legibility check | `core-editor` |
| `BookPicker` | counter "n de N", eligibility line, lock notice; **shared by Noetia+ (3) and NoetiaX (10)** | `plus-select`, `x-select` |
| `ProvenanceLabel`, `CitationChip`, `PassageCard` | label on every answer segment; numbered citations; "Ir al pasaje" / "Abrir libro". **In prototypes every research answer, Brief and "Verificado (ejemplo)" badge is preceded by an "Illustrative example — not real system output" marker** | research pages |
| `StatusStage` | reuses the Draft PR #56 stage vocabulary | `plus-workspace` |
| `EvidencePanel` (**conceptual X-P3/X-P4**) | claim × book matrix on desktop; per-claim cards on mobile | `x-workspace` |
| `Brief` | legend, cited claims, general-context labels, sources | `plus-brief`, `x-brief` |
| `LegalDocument` | language switch, version and effective-date strip, sticky contents, semantic table, placeholders | `legal-document` |
| `AcknowledgmentCheckbox`, `DisclosureSlot` | registration acceptance, age attestation, checkout disclosure slot | `legal-disclosures` |

## 4. Responsive layouts

| Experience | Desktop (1440) | Mobile (390) |
|---|---|---|
| Public site | 12-column; hero copy 5 / demo 7; content max 1152 px | stacked; demo under the CTAs; header shows wordmark, Create account and the menu button; **the ES/EN switch moves into the menu sheet** (deviation from Appendix G §9: at 360–390 px the header can't fit wordmark + switch + CTA + menu without overflow) |
| App shell | 232 px navy rail + content | bottom tab bar (five items); in-page search |
| Reader | paper sheet 720 px on a grey surround; audio bar at the bottom; selection popover floats next to the phrase | full-width sheet; compact audio bar; **selection popover sits in the text flow under the selected phrase, with wrapping labels** |
| Noetia+ workspace | conversation + 380 px source panel | conversation, then sources (sheet in the product) |
| NoetiaX workspace | 260 px source rail + conversation + 400 px evidence panel | rail hidden (sheet in the product); evidence as per-claim cards |
| Legal | 260 px contents + document (≤ 70 characters) | contents above the document |

## 5. Spanish and English content

- Every screen exists in both languages (`*.es.html`, `*.en.html`), generated from one source, so structure is identical.
- Copy follows [Appendix B](../../../reports/noetia-ecosystem-ux-audit/B-content-audit-es-en.md) and [Appendix G §15](../../../reports/noetia-ecosystem-ux-audit/G-published-landing-visual-assessment.md#15-bilingual-copy-recommendations-proposed-for-po-review-translation-files-unchanged).
- **Pending terminology** (shown as proposed):
  - English "highlight" for *fragmento* (DV-04);
  - "Suscripción Noetia" (DV-06);
  - mode and provenance names (DV-08; marked "nombre pendiente" in the workspace);
  - usage units (DV-09; placeholder).
- **Demonstration texts:** public-domain only (*Don Quijote*, *Pride and Prejudice*, *Don Juan Tenorio*, *La Divina Comedia*).

## 6. Prototype images

68 JPEG screenshots in [`screenshots/`](screenshots/), named `<screen>--<es|en>--<desktop|mobile>.jpg`. They were rendered locally from `src/` with headless Chromium at 1440×900 and 390×844, full page. The [README](README.md) indexes them.

## 7. Component reuse (from the production code; nothing modified)

| Prototype component | Reuses (`main@6a5e5c0`) |
|---|---|
| ReaderSheet, SelectionPopover | `components/PagedReader.tsx` (paper and frame colours), `PhraseRenderer.tsx`, `FragmentPopover.tsx` |
| ReaderTopBar, ReadingSettingsSheet | `components/ReaderTopBar.tsx` controls, `lib/reader-preferences.ts` |
| CardEditor | `components/ShareModal.tsx` logic, `lib/share-utils.ts` (`FONTS`, `BG_PRESETS`, `getTextColor`), `image-gen` fit modes (`blur` default) |
| Research components | Draft PR #56 `components/research/{ResearchSession,CitationDialog}.tsx` and its i18n (`feat/nem-024-checkpoint-b@860f531`; unmerged) |
| Footer | `components/Footer.tsx` (becomes the single footer; Appendix G §14) |
| Language switch | `lib/i18n` `setLanguage` |
| Images | existing `public/backgrounds/imagen-13.jpg` (+3, 5, 9, 14, 17 in the editor) and `public/covers/*.png` |
| Fonts | `services/image-gen/fonts/{playfair,merriweather,lato}.ttf` |

## 8. Implementation dependencies

1. **Package A (tokens, fonts, icons, base components)** comes first; everything depends on it.
2. **Landing Reconciliation (Appendix G §23)** can follow independently. The Causas mechanism sentence waits for the PO decision in [`causas-mechanism-decision.md`](causas-mechanism-decision.md).
3. **Core screens (Package B)** need A. The reader redesign must not change sync or audio behaviour.
4. **Noetia+/NoetiaX (Packages C/D)** need A and B, plus the NEM-019 merge, plus the NEM-024 release gates (E-1 OPEN and BLOCKED; Checkpoint E NOT QUALIFIED), plus a decision on PO-029 (DRAFT), plus naming decisions. **X-P proposals require explicit approval.**
5. **Legal (Package G):** the presentation can follow A; text and acknowledgment flows need counsel and the PO.

## 9. Product decisions still pending

| ID | Decision |
|---|---|
| ~~LPD-6 / Causas mechanism~~ | **Resolved by [PO-053](../../../operating-framework/decisions/product-owner/PO-053-causas-noetia-distribution-policy.md)** (one cause → 100%; no selection → equal, deterministic split across three; no other options). Still open: qualifying-payment definition, legacy preferences, business-plan cause names, Terms §3 counsel review ([alignment plan](causas-policy-alignment-plan.md)) |
| DV-04 / 05 / 06 / 07 | English term for *fragmento*; Escucha Activa in English; "Suscripción Noetia"; Spanish name for Research Brief |
| DV-08 | mode and provenance label names |
| DV-09 | usage units and meter |
| DV-14…23 | NoetiaX proposals X-P1…X-P10 (evidence panel X-P3 and disagreement section X-P4 appear as **conceptual**) |
| LPD-3 / 5 / 7 / 8 | hero demo background; "Avísame" link; claims; footer tone |
| Legal (DL-01…10) | all legal text, disclosures, age attestation, premium terms |
| Other | cover policy and background licences (DV-28/29) |

## 10. Visual acceptance criteria (for the future implementation)

1. Production screens match the approved prototypes in layout, tokens, type and icons, with differences recorded and approved.
2. Every text pair ≥ 4.5:1 (≥ 3:1 at 24 px or larger); verified by an automated contrast test on tokens and axe on pages.
3. One primary, one secondary and one text button style; one card treatment per surface; one icon family; no emoji in the UI.
4. Reading surfaces show no research chrome; research answers always show provenance labels and numbered citations.
5. Every screen works at 360 px without horizontal scrolling of core content; the mobile tab bar is pinned to the viewport in production.
6. ES and EN screens are structurally identical; no untranslated strings.
7. Conceptual or unreleased features are labelled until released; legal placeholders are never shipped as text.
8. Playwright visual baselines exist for each prototype screen counterpart (ES/EN × 390/1440).

## 11. Correction log (independent PA review of `7bdc013`)

| # | Correction | Where |
|---|---|---|
| 1 | Mobile overflow fixed at its source, without `overflow-x: hidden`. Reader: the absolutely positioned selection popover (390 px: right edge at 480 px EN / 557 px ES) now flows under the phrase on mobile. Public header: the action group (390 px EN: right edge at 401 px; 360 px ES: 386 px) now omits the ES/EN switch on mobile, which lives in the menu sheet | `src/assets/proto.css` (`.popover.at-phrase`, `.site-header .lang`), `tools/build_prototypes.py` (reader markup) |
| 2 | Reproducibility: the generator and capture tool were excluded by the repository-wide `.gitignore` rule `build/`. They moved to `tools/` (not ignored); the root `.gitignore` is unchanged | `tools/` |
| 3 | Illustrative research output: an explicit "Illustrative example — answer, citations and verification states are simulated. Not real system output." marker on the Noetia+/NoetiaX conversations and Briefs; badges renamed "Verificado (ejemplo)" / "Verified (example)". X-P2/X-P3/X-P4 remain labelled conceptual | research pages |
| 4 | Public-claim flags (†) on permanent-ownership and personal-data privacy statements, with a footnote on each page | `public`, `core-library`, `core-account` |
| 5 | Causas effort assessment corrected: allocation, payout and auditability require accounting logic and controls under any option; no mechanism selected | `causas-mechanism-decision.md` |

### Claims register (require approval before any publication)

| Claim (prototype copy) | Screens | Approval needed |
|---|---|---|
| "Tus libros adquiridos son tuyos para siempre…" / "Books you acquire are yours forever…" | `public` (ecosystem note), `core-account` | PO + legal counsel (permanent-ownership clause, DL-05; Appendix C) |
| "Tus libros son tuyos para siempre." / "Your books are yours forever." | `core-library` | same |
| "…privado y bajo tu control." / "…private and under your control." | `public` (how it works) | PO + legal counsel (must match actual visibility defaults and opt-out; Appendix G LP-07) |
| "Destinamos el 2,22% de cada pago a Causas Noetia. Tú eliges una causa… se distribuye por igual entre las tres." | `public` (Causas) | **Wording approved by the PO (PO-053).** Legal review of Terms §3 consistency is still required before publication (OP-3); "every payment" vs "qualifying payment" is open (OP-1) |
| Legal documents and disclosures | `legal-*` | placeholders only; qualified counsel |
