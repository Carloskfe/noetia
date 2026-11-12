# Noetia — Quiet Editorial Prototypes (Visual Design Phase)

> **DESIGN PROTOTYPES ONLY.** These are static HTML/CSS pages, isolated from `services/web`. They are not the production application and not an implementation.
> - **Design direction:** Quiet Editorial, APPROVED by the PO on 2026-11-12.
> - **The prototypes themselves:** awaiting independent PA review and PO approval before any implementation.
> - **Noetia+ and NoetiaX:** conceptual. They are approved tiers but not implemented, and release is blocked (E-1 OPEN and BLOCKED, Checkpoint E NOT QUALIFIED).
> - **Legal content:** placeholders only.

## Contents

| Document | Purpose |
|---|---|
| [visual-specification.md](visual-specification.md) | tokens, typography, components, responsive layouts, content rules, reuse, dependencies, pending decisions, acceptance criteria |
| [causas-mechanism-decision.md](causas-mechanism-decision.md) | Causas Noetia distribution-mechanism comparison and recommendation (**no mechanism selected**) |
| [src/](src/) | 17 screens × ES/EN static HTML (`index.es.html` / `index.en.html` link them all); shared `assets/proto.css` |
| [screenshots/](screenshots/) | 68 locally rendered JPEGs: `<screen>--<es\|en>--<desktop\|mobile>.jpg` |
| [tools/](tools/) | `build_prototypes.py` (stdlib-only generator) and `capture.js` (screenshot tool; uses a locally available `playwright-core` through `PLAYWRIGHT_CORE`; **not added as a dependency**). *Previously under `build/`, which the repository-wide `.gitignore` rule `build/` silently excluded from commit `7bdc013`; moved to `tools/`* |

## Prototype index

### A. Public website

| Screen | HTML | Desktop 1440 | Mobile 390 |
|---|---|---|---|
| Public website / Sitio público | [ES](src/public.es.html) · [EN](src/public.en.html) | [ES](screenshots/public--es--desktop.jpg) · [EN](screenshots/public--en--desktop.jpg) | [ES](screenshots/public--es--mobile.jpg) · [EN](screenshots/public--en--mobile.jpg) |
| Mobile menu / Menú móvil | [ES](src/public-menu.es.html) · [EN](src/public-menu.en.html) | [ES](screenshots/public-menu--es--desktop.jpg) · [EN](screenshots/public-menu--en--desktop.jpg) | [ES](screenshots/public-menu--es--mobile.jpg) · [EN](screenshots/public-menu--en--mobile.jpg) |

### B. Noetia core

| Screen | HTML | Desktop 1440 | Mobile 390 |
|---|---|---|---|
| Library and discovery / Biblioteca y descubrir | [ES](src/core-library.es.html) · [EN](src/core-library.en.html) | [ES](screenshots/core-library--es--desktop.jpg) · [EN](screenshots/core-library--en--desktop.jpg) | [ES](screenshots/core-library--es--mobile.jpg) · [EN](screenshots/core-library--en--mobile.jpg) |
| Synchronized reader and audio / Lector sincronizado y audio | [ES](src/core-reader.es.html) · [EN](src/core-reader.en.html) | [ES](screenshots/core-reader--es--desktop.jpg) · [EN](screenshots/core-reader--en--desktop.jpg) | [ES](screenshots/core-reader--es--mobile.jpg) · [EN](screenshots/core-reader--en--mobile.jpg) |
| Highlights / Fragmentos | [ES](src/core-fragments.es.html) · [EN](src/core-fragments.en.html) | [ES](screenshots/core-fragments--es--desktop.jpg) · [EN](screenshots/core-fragments--en--desktop.jpg) | [ES](screenshots/core-fragments--es--mobile.jpg) · [EN](screenshots/core-fragments--en--mobile.jpg) |
| Quote-card editor / Editor de tarjetas | [ES](src/core-editor.es.html) · [EN](src/core-editor.en.html) | [ES](screenshots/core-editor--es--desktop.jpg) · [EN](screenshots/core-editor--en--desktop.jpg) | [ES](screenshots/core-editor--es--mobile.jpg) · [EN](screenshots/core-editor--en--mobile.jpg) |
| Reading Clubs / Clubes de Lectura | [ES](src/core-clubs.es.html) · [EN](src/core-clubs.en.html) | [ES](screenshots/core-clubs--es--desktop.jpg) · [EN](screenshots/core-clubs--en--desktop.jpg) | [ES](screenshots/core-clubs--es--mobile.jpg) · [EN](screenshots/core-clubs--en--mobile.jpg) |
| Account and subscription / Cuenta y suscripción | [ES](src/core-account.es.html) · [EN](src/core-account.en.html) | [ES](screenshots/core-account--es--desktop.jpg) · [EN](screenshots/core-account--en--desktop.jpg) | [ES](screenshots/core-account--es--mobile.jpg) · [EN](screenshots/core-account--en--mobile.jpg) |

### C. Noetia+ — conceptual (approved, not implemented)

| Screen | HTML | Desktop 1440 | Mobile 390 |
|---|---|---|---|
| Entry, usage and access / Entrada, uso y acceso | [ES](src/plus-entry.es.html) · [EN](src/plus-entry.en.html) | [ES](screenshots/plus-entry--es--desktop.jpg) · [EN](screenshots/plus-entry--en--desktop.jpg) | [ES](screenshots/plus-entry--es--mobile.jpg) · [EN](screenshots/plus-entry--en--mobile.jpg) |
| Three-book selection / Selección de 3 libros | [ES](src/plus-select.es.html) · [EN](src/plus-select.en.html) | [ES](screenshots/plus-select--es--desktop.jpg) · [EN](screenshots/plus-select--en--desktop.jpg) | [ES](screenshots/plus-select--es--mobile.jpg) · [EN](screenshots/plus-select--en--mobile.jpg) |
| Conversation, sources and citations / Conversación, fuentes y citas | [ES](src/plus-workspace.es.html) · [EN](src/plus-workspace.en.html) | [ES](screenshots/plus-workspace--es--desktop.jpg) · [EN](screenshots/plus-workspace--en--desktop.jpg) | [ES](screenshots/plus-workspace--es--mobile.jpg) · [EN](screenshots/plus-workspace--en--mobile.jpg) |
| Research Brief / Informe de investigación | [ES](src/plus-brief.es.html) · [EN](src/plus-brief.en.html) | [ES](screenshots/plus-brief--es--desktop.jpg) · [EN](screenshots/plus-brief--en--desktop.jpg) | [ES](screenshots/plus-brief--es--mobile.jpg) · [EN](screenshots/plus-brief--en--mobile.jpg) |

### D. NoetiaX — conceptual (approved tier, not implemented; X-P elements need approval)

| Screen | HTML | Desktop 1440 | Mobile 390 |
|---|---|---|---|
| Ten-book selection / Selección de 10 libros | [ES](src/x-select.es.html) · [EN](src/x-select.en.html) | [ES](screenshots/x-select--es--desktop.jpg) · [EN](screenshots/x-select--en--desktop.jpg) | [ES](screenshots/x-select--es--mobile.jpg) · [EN](screenshots/x-select--en--mobile.jpg) |
| Research workspace and evidence / Espacio de investigación y evidencia | [ES](src/x-workspace.es.html) · [EN](src/x-workspace.en.html) | [ES](screenshots/x-workspace--es--desktop.jpg) · [EN](screenshots/x-workspace--en--desktop.jpg) | [ES](screenshots/x-workspace--es--mobile.jpg) · [EN](screenshots/x-workspace--en--mobile.jpg) |
| NoetiaX Research Brief / Informe NoetiaX | [ES](src/x-brief.es.html) · [EN](src/x-brief.en.html) | [ES](screenshots/x-brief--es--desktop.jpg) · [EN](screenshots/x-brief--en--desktop.jpg) | [ES](screenshots/x-brief--es--mobile.jpg) · [EN](screenshots/x-brief--en--mobile.jpg) |

### E. Bilingual legal experience (placeholders, no legal text)

| Screen | HTML | Desktop 1440 | Mobile 390 |
|---|---|---|---|
| Legal document / Documento legal | [ES](src/legal-document.es.html) · [EN](src/legal-document.en.html) | [ES](screenshots/legal-document--es--desktop.jpg) · [EN](screenshots/legal-document--en--desktop.jpg) | [ES](screenshots/legal-document--es--mobile.jpg) · [EN](screenshots/legal-document--en--mobile.jpg) |
| Registration and checkout / Registro y pago | [ES](src/legal-disclosures.es.html) · [EN](src/legal-disclosures.en.html) | [ES](screenshots/legal-disclosures--es--desktop.jpg) · [EN](screenshots/legal-disclosures--en--desktop.jpg) | [ES](screenshots/legal-disclosures--es--mobile.jpg) · [EN](screenshots/legal-disclosures--en--mobile.jpg) |

## Evidence baseline

| Item | Reference |
|---|---|
| Assessment | [`docs/reports/2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md`](../../../reports/2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md) and Appendices A–G (Draft PR #57) |
| Landing evidence | Appendix G: passive public capture of `noetia.app` (2026-11-12) and PA observations of the PO's screenshots |
| Product code reference | `main@6a5e5c0` |
| Research UI reference | Draft PR #56 `feat/nem-024-checkpoint-b@860f531` (unmerged) |
| Product boundaries | PO-025 to PO-028, PO-003, PO-001; PO-029 is DRAFT |
| Assets reused (not copied) | `services/web/public/backgrounds/*`, `services/web/public/covers/*`, `services/image-gen/fonts/{playfair,merriweather,lato}.ttf`, referenced through relative paths |

## Status

| Area | Status |
|---|---|
| Quiet Editorial direction | **APPROVED** (PO, 2026-11-12) |
| Prototypes and specification | **PROPOSED**; awaiting PA review and PO approval |
| Noetia core screens | proposals for existing, implemented capabilities |
| Noetia+ screens | **conceptual**; capabilities approved (PO-025/027/028/003), UI not implemented |
| NoetiaX screens | **conceptual**; X-P2/X-P3/X-P4 elements labelled and **require PO approval** |
| Legal screens | layout only; **no legal text**; wording requires qualified counsel |
| Causas Noetia | commitment preserved (2.22%; three priorities); **mechanism pending PO decision** |

## How to regenerate

Requirements: Python 3 (standard library only) to generate the pages. To capture screenshots you also need Node.js and a locally available **`playwright-core`** with a downloaded Chromium (for example from a previous `npx playwright install chromium`). It is supplied through `PLAYWRIGHT_CORE` and is not a project dependency.

```bash
cd docs/design/ecosystem-ux/prototypes
python3 tools/build_prototypes.py                                     # writes src/*.{es,en}.html
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node tools/capture.js        # all 68 screenshots
PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node tools/capture.js reader # only matching pages
```

Without Node.js, open `src/index.es.html` or `src/index.en.html` in any browser from a repository checkout. Fonts and images resolve through relative paths into `services/`.

## Validation (corrections after the independent PA review of `7bdc013`)

### Mobile horizontal overflow

**Method:** headless Chromium with mobile emulation at **360 px and 390 px**, both languages, all 36 pages (index included), 72 page-width combinations. Checks: `document.documentElement.scrollWidth` versus `clientWidth`, plus every element whose bounding box extends past the viewport. Overflow was fixed at its source; **no `overflow-x: hidden` was added**.

| Prototype | Overflowing element (measured) | Before (390 px) | Fix | After |
|---|---|---|---|---|
| `core-reader` EN | `.popover` selection menu: absolute `left: 34%`, labels not wrapping; right edge 479 px (469 px at 360) | 480 px capture | mobile: popover flows in the text under the selected phrase (`.popover.at-phrase`), labels wrap | 390 px; no overflow at 360/390 |
| `core-reader` ES | same; longer labels; right edge 557 px (547 px at 360) | 557 px capture | same | 390 px; no overflow at 360/390 |
| `public` EN | header action group (ES/EN switch + Create account + menu); right edge 401 px | 401 px capture | mobile: the ES/EN switch moves into the menu sheet (`public-menu`) | 390 px; no overflow at 360/390 |
| `public` ES | same group; overflowed **at 360 px only** (right edge 386 px). Not visible in the 390 px captures | 390 px capture | same | no overflow at 360/390 |

**Result after correction: 0 overflowing combinations out of 72.**

**Before/after evidence:** the "before" images are the JPEGs committed at `7bdc013` and remain in git history, for example `git show 7bdc013:docs/design/ecosystem-ux/prototypes/screenshots/core-reader--es--mobile.jpg > before.jpg` (557 px wide). The "after" images are the current files with the same names. After widths are below. The corrected reader shows the action menu under the highlighted phrase inside the 390 px column; the corrected header shows wordmark, Create account and menu.

### Dimensions of all 34 mobile captures

| Capture | Width before (`7bdc013`) | After (width × height) |
|---|---|---|
| `core-account--en--mobile.jpg` | 390 | 390 × 1219 |
| `core-account--es--mobile.jpg` | 390 | 390 × 1239 |
| `core-clubs--en--mobile.jpg` | 390 | 390 × 1145 |
| `core-clubs--es--mobile.jpg` | 390 | 390 × 1166 |
| `core-editor--en--mobile.jpg` | 390 | 390 × 1209 |
| `core-editor--es--mobile.jpg` | 390 | 390 × 1229 |
| `core-fragments--en--mobile.jpg` | 390 | 390 × 944 |
| `core-fragments--es--mobile.jpg` | 390 | 390 × 964 |
| `core-library--en--mobile.jpg` | 390 | 390 × 1857 |
| `core-library--es--mobile.jpg` | 390 | 390 × 1878 |
| `core-reader--en--mobile.jpg` | 480 | 390 × 1277 |
| `core-reader--es--mobile.jpg` | 557 | 390 × 1397 |
| `legal-disclosures--en--mobile.jpg` | 390 | 390 × 1489 |
| `legal-disclosures--es--mobile.jpg` | 390 | 390 × 1532 |
| `legal-document--en--mobile.jpg` | 390 | 390 × 1703 |
| `legal-document--es--mobile.jpg` | 390 | 390 × 1723 |
| `plus-brief--en--mobile.jpg` | 390 | 390 × 1086 |
| `plus-brief--es--mobile.jpg` | 390 | 390 × 1127 |
| `plus-entry--en--mobile.jpg` | 390 | 390 × 1653 |
| `plus-entry--es--mobile.jpg` | 390 | 390 × 1673 |
| `plus-select--en--mobile.jpg` | 390 | 390 × 1959 |
| `plus-select--es--mobile.jpg` | 390 | 390 × 1979 |
| `plus-workspace--en--mobile.jpg` | 390 | 390 × 1666 |
| `plus-workspace--es--mobile.jpg` | 390 | 390 × 1715 |
| `public--en--mobile.jpg` | 401 | 390 × 6075 |
| `public--es--mobile.jpg` | 390 | 390 × 6127 |
| `public-menu--en--mobile.jpg` | 390 | 390 × 880 |
| `public-menu--es--mobile.jpg` | 390 | 390 × 900 |
| `x-brief--en--mobile.jpg` | 390 | 390 × 1335 |
| `x-brief--es--mobile.jpg` | 390 | 390 × 1405 |
| `x-select--en--mobile.jpg` | 390 | 390 × 1810 |
| `x-select--es--mobile.jpg` | 390 | 390 × 1864 |
| `x-workspace--en--mobile.jpg` | 390 | 390 × 1748 |
| `x-workspace--es--mobile.jpg` | 390 | 390 × 1811 |

### Disclaimers confirmed

- Every page carries the top banner "Design prototype — not the production application".
- Noetia+ pages carry "Conceptual prototype · Noetia+ is APPROVED and NOT implemented (release blocked)".
- NoetiaX pages carry the equivalent banner, and X-P2, X-P3 and X-P4 elements are badged as requiring PO approval. X-P3 and X-P4 are **not** implemented anywhere.
- Every illustrative research answer and Brief carries "Illustrative example — answer, citations and verification states are simulated. Not real system output."; verification badges read "Verified (example)".
- Legal pages contain placeholders only.
- Ownership and privacy claims are flagged with †, with a footnote; the claims register is in `visual-specification.md` §11.

### Changed files in this correction (all inside `docs/design/ecosystem-ux/prototypes/`)

- `tools/build_prototypes.py`, `tools/capture.js`: newly committed (previously ignored under `build/`).
- `src/assets/proto.css`: popover and header mobile rules; illustrative and claim styles.
- `src/*.html` (36 regenerated pages).
- `screenshots/*.jpg` (68 regenerated).
- `README.md`, `visual-specification.md`, `causas-mechanism-decision.md`.

## Limitations

1. **Static prototypes.** Interaction (hover, focus, menus opening, audio) is represented as states, not behaviour. The mobile tab bar is drawn at the end of each page so full-page captures stay readable; in the product it is pinned to the viewport. Research answers and citations are **illustrative examples**, not system output.
2. **Rendering:** screens were rendered only in headless Chromium on Linux. They weren't checked on real devices, Safari, Firefox, tablet widths or dark system mode.
3. **Illustrative data:** names, counts, dates and usage values are illustrative or placeholders. Prices shown are the current published monthly prices.
4. **Fonts:** the repository's Merriweather and Lato files carry one weight each, so bold is synthesized by the browser. Production should self-host the full weight sets (Package A).
5. **Competitors:** no competitor UI was used. The prototypes are original.
6. **Legal and copy:** no legal statement, privacy guarantee or financial-policy change is introduced. Copy marked pending awaits PO decisions.
7. **Production code:** no production code, translations, assets or configuration were modified.
