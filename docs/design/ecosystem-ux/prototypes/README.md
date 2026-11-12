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
| [build/](build/) | `build_prototypes.py` (stdlib-only generator) and `capture.js` (screenshot tool; uses a locally available `playwright-core` through `PLAYWRIGHT_CORE`; **not added as a dependency**) |

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

```bash
cd docs/design/ecosystem-ux/prototypes/build
python3 build_prototypes.py                                   # writes src/*.html
PLAYWRIGHT_CORE=/path/to/playwright-core node capture.js      # writes screenshots/*.jpg
```

Open `src/index.es.html` in a browser from a repository checkout. Relative paths need the repository layout for fonts and images.

## Limitations

1. **Static prototypes.** Interaction (hover, focus, menus opening, audio) is represented as states, not behaviour. The mobile tab bar is drawn at the end of each page so full-page captures stay readable; in the product it is pinned to the viewport.
2. **Rendering:** screens were rendered only in headless Chromium on Linux. They weren't checked on real devices, Safari, Firefox, tablet widths or dark system mode.
3. **Illustrative data:** names, counts, dates and usage values are illustrative or placeholders. Prices shown are the current published monthly prices.
4. **Fonts:** the repository's Merriweather and Lato files carry one weight each, so bold is synthesized by the browser. Production should self-host the full weight sets (Package A).
5. **Competitors:** no competitor UI was used. The prototypes are original.
6. **Legal and copy:** no legal statement, privacy guarantee or financial-policy change is introduced. Copy marked pending awaits PO decisions.
7. **Production code:** no production code, translations, assets or configuration were modified.
