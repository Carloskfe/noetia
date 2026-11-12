# Appendix E — Evidence Baselines, Method and Limitations

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md).

## 1. Baselines

| Purpose | Branch | Commit | Status |
|---|---|---|---|
| Product code ("IMPLEMENTED") | `main` | `6a5e5c0850a73a9de432be87d5be647bd138dbe7` (2026-10-31) | Production branch |
| Governance (PO-025 to PO-052, ADR-005/006, D13) and the minimal research UI | `feat/nem-024-checkpoint-b` | `860f53168e1a994cdb9edeb5c0c211cefe99ce50` | Draft PR #56, **unmerged; release blocked** |
| Legal benchmark findings F-1 to F-15 | `docs/nof-004-legal-benchmark-audit` | `8b0e4f9b9d578c3bba8c35249af055f3e5d14734` | Draft PR #23 |
| Proposed Terms annual-price correction | `fix/nof-004-terms-annual-prices` | `d254eeab2a178c813c5a19598ab5b953bd1f6726` | Draft PR #22, pending legal review |

`main` was read from a clean `git archive` extraction. Other branches were read in place. No branch was merged or rebased into this documentation branch.

## 2. Method

- **Code inspection:** routes (46 `page.tsx`), components, i18n catalogues, legal modules, Tailwind configuration, package manifests, email templates and mobile catalogues.
- **Quantitative scans** with `grep` and Python over `services/web/{app,components,lib}`:
  - palette-class and hex counts;
  - accessibility markers (`aria-*`, `role=`, `sr-only`, focus classes, `outline-none`, text sizes, motion);
  - emoji usage;
  - inline language ternaries;
  - JSX text literals;
  - `localStorage` keys;
  - analytics scripts.
- **Content review:** targeted review of flagged strings plus a seeded random sample of 26 strings per language.
- **Contrast:** WCAG 2.x relative-luminance formula, applied to token pairs and to background images (Appendix D).
- **Images:** labelled contact sheets of all 18 backgrounds and 11 covers were generated in a temporary local directory (not committed) and **viewed**.
- **Legal:** the full Spanish text of all three documents was read. English parity was checked on every key fact (prices, members, age, cancellation, governing law, controller, retention, processors, cookie entries).

## 3. Limitations (explicit)

1. **No rendered UI.** No browser, emulator or device screenshots were captured. Layout, spacing, rendered contrast and interaction findings are **INFERRED** from source unless marked otherwise.
2. **Mobile assets not viewed.** The mobile app assets (icon, splash) were listed but not viewed, and the mobile app was not run.
3. **No live services.** The Open Library covers, the `image-gen` output and the Stripe portal configuration were not inspected.
4. **Competitors not inspected.** No competitor interface was opened in this assessment. The competitor comparison is based on general product knowledge and is labeled **unverified**.
5. **Unverified claims.** Background image provenance and licences, the Causas donation mechanism, and the state of Apple Sign In configuration were not verified.
6. **No production data.** No production, staging, Stripe or user data was accessed. No credentials, personal user data or research questions appear in this report.
7. **Heuristic counts.** Hard-coded-string and emoji counts are heuristic and may include a few false positives, such as code fragments matched by the JSX-text pattern.
8. **No legal compliance claim.** Legal observations are risk identification for qualified counsel.
9. **Unmerged research UI.** Research-UI findings refer to unmerged Draft PR #56 and do not describe production.
