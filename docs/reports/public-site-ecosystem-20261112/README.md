# Public Website — Complete Ecosystem Presentation (Quiet Editorial) · Validation Report

**Authorization:** Product Owner decision *Complete Public Ecosystem Presentation* (2026-11-12), plus the final Causas decision (PO-053, recorded in Draft PR #58).
**Branch:** `feat/public-ecosystem-site-20261112`, from `main@6a5e5c0`. **Status:** Draft PR; **not merged, not deployed, not activated.**
**Design reference:** Quiet Editorial prototypes and Appendix G (Draft PR #57, `b1be30a`).

## 1. What changed

| File | Change |
|---|---|
| `services/web/app/LandingContent.tsx` | Rewritten in the Quiet Editorial direction. Sections: product-focused header and mobile menu; hero with a static, labelled illustration (public-domain text); Absorbe/Captura/Expresa; ecosystem (Noetia **Available**; Noetia+ and NoetiaX **Coming Soon / Próximamente**); Clubes de Lectura; **Causas Noetia** (PO-053 wording); authors; closing CTA. **No footer of its own.** All copy from i18n |
| `services/web/lib/i18n/{es,en}.ts` | New `landing` namespace (identical structure; parity test passes) |
| `services/web/components/Footer.tsx` | The single global footer: dark tone on `/` and `/causas`, light elsewhere. Contrast raised (no `gray-300`/`gray-400` text; headings 12 px instead of 10 px). Untranslated "Knowledge Expression Platform" strip removed |
| `services/web/app/causas/page.tsx` | Its duplicate footer strip removed; nothing else changed |
| `services/web/app/page.tsx` | Wraps the landing page with the display-font variable. Metadata: Spanish title and description without the "first platform" claim; bilingual summary in the description |
| `services/web/app/fonts.ts`, `services/web/app/fonts/playfair-display.ttf` | Self-hosted Playfair Display (SIL OFL), reused from `services/image-gen/fonts`; `display: swap`; no third-party font request |
| `services/web/tailwind.config.ts` | Additive tokens: `navy` / `navy.raised`; `fontFamily.display`. Brand emerald uses Tailwind `emerald-400` (= `#34D399`) and `emerald-700` (= `#047857`) |
| `services/web/tests/unit/app/LandingContent.spec.tsx` (new), `services/web/tests/unit/components/Footer.spec.tsx` (new) | Tests for tiers, absence of premium paths, Causas wording, navigation, menu, language switch, single footer, footer tone and legal links |

**Not changed:**
- pricing, billing, checkout, subscriptions, entitlements, cookie consent and legal texts;
- the API, migrations and infrastructure;
- Noetia+/NoetiaX functionality and NEM-024;
- `CauseSelector` and the preference API (PO-053 alignment is planned separately).

## 2. Verification

| Check | Result |
|---|---|
| Web unit tests (`jest --maxWorkers=2`) | **319 / 319 passed, 21 suites** (2 new suites, 14 new tests; i18n parity included) |
| Type-check (`tsc --noEmit`) | **pass** |
| Lint (`next lint`) | **0 errors.** No warnings in changed files; the remaining warnings are pre-existing in unrelated files (ClubPollCard, ClubSessionCard, ShareModal, admin, clubs, profile) |
| Production build (`next build`) | **pass**; `/` prerendered as static |
| Distinction between available and forthcoming tiers | Noetia shows "Disponible / Available" with "Crear cuenta / Create account". Noetia+ and NoetiaX show "Próximamente / Coming Soon" |
| No premium upgrade or payment path | Premium cards contain **0 links or buttons** (all 6 rendered variants and the unit tests). No `checkout`, `billing`, `subscribe` or `upgrade` link on the page. No premium prices or dates |
| Accurate descriptions | Noetia: implemented features. Noetia+: source-aware AI research across up to **3** eligible selected books per session (PO-027). NoetiaX: up to **10** eligible selected books, deeper exploration and comparison (PO-025/027). Subscription prerequisite in the future tense (PO-026). Note: "not available yet… may change… no dates or prices announced". No evidence matrix or other unapproved concept advertised |
| Broken links | All 22 internal links from `/` and `/causas` return **HTTP 200** on the production build. Anchors `#como-funciona` and `#ecosistema` resolve. `mailto:` links unchanged |
| One footer | **1** `<footer>` on `/` and `/causas` at every width and in both languages (previously 2) |
| Responsive | No horizontal overflow at **360, 390 and 1440 px** in ES and EN (`scrollWidth = clientWidth`) |
| Accessibility (structural) | Language buttons with `aria-pressed` and `lang`; menu as `role="dialog"` with Esc close and autofocused close button; icon-only controls labelled; decorative SVGs `aria-hidden`; focus-visible outlines. Contrast: body `slate-300` on navy 11.7:1, muted `slate-400` 6.8:1, primary button navy on `emerald-400` 9.05:1, light-footer links `gray-600` 7.6:1. **Not run:** axe and Lighthouse (no tooling installed locally; to run in review) |
| Existing subscriptions and payments | No file under `billing`, `pricing`, `account`, `subscriptions` or the API changed; the cookie-consent component is unchanged |
| Console errors | `/`: none. `/causas`: CORS errors fetching `localhost:4000/causes`. These are pre-existing and environmental: no API ran during local validation |

### CI (GitHub Actions, run `43314730608`)

| Job | Result | Assessment |
|---|---|---|
| web — lint / typecheck / build | pass | — |
| web — unit tests (≥80% coverage) | fail | **All 319 tests pass.** Only the global coverage threshold over `lib/**` fails (statements 72.8%). It is **identical with `main`'s `lib/`** (measured locally: 324/445 statements in both), so the failure is pre-existing. The same job also failed on PR #22 (same `main` base) |
| web — E2E tests (Playwright) | fail | **Environmental:** the job stops at "Install Playwright browsers" with *Playwright does not support chromium on ubuntu26.04-x64*. No test ran. The same job passed on PR #22 with an earlier runner image |
| api — unit tests; mobile — unit tests | fail | Pre-existing coverage-threshold failures (api 948/948 and mobile 179/179 tests pass); also failing on PR #22. Not touched by this PR |
| api / worker lint-build, worker and image-gen unit tests | pass | — |

**Validation method:**
1. Local production build served with `next start` on `127.0.0.1:3107`, then stopped afterwards.
2. Headless Chromium checks (desktop 1440×900, mobile 390×844 and 360×780; ES and EN, set through the site's `noetia_lang` storage).
3. HTTP status of every link.

No production or staging system was accessed.

## 3. Screenshots

Full-page captures of the local production build, 2026-11-12. The existing cookie banner is visible, as on a first visit.

| Route | Desktop 1440 | Mobile 390 |
|---|---|---|
| `/` ES | [home--es--desktop.jpg](screenshots/home--es--desktop.jpg) | [home--es--mobile.jpg](screenshots/home--es--mobile.jpg) |
| `/` EN | [home--en--desktop.jpg](screenshots/home--en--desktop.jpg) | [home--en--mobile.jpg](screenshots/home--en--mobile.jpg) |
| `/causas` ES (single footer) | [causas--es--desktop.jpg](screenshots/causas--es--desktop.jpg) | [causas--es--mobile.jpg](screenshots/causas--es--mobile.jpg) |
| `/causas` EN | [causas--en--desktop.jpg](screenshots/causas--en--desktop.jpg) | [causas--en--mobile.jpg](screenshots/causas--en--mobile.jpg) |

## 4. Unresolved decisions and known limitations

| # | Item | Owner |
|---|---|---|
| U-1 | **Causas alignment.** The landing page states the PO-053 policy (one cause; equal default). The existing **cause selector still allows two causes and a "random" option**, and the `/causas` page body still describes "up to two… or randomly" and "from day one". Both are out of this PR's scope and planned in PR #58 (`causas-policy-alignment-plan.md`, steps S1–S4). Until aligned, the product is inconsistent with the landing wording | PO (authorize alignment) |
| U-2 | "Every payment" (approved public wording) vs "each qualifying payment" (PO-053 rule 1) | PO (OP-1), legal |
| U-3 | Cookie banner overlaps the hero on first visit, asks analytics consent although no analytics exist, and gives "Aceptar todo" more prominence than "Solo esenciales". Unchanged by design (consent behaviour preserved) | Legal, PO (Appendix G LP-07/LP-08) |
| U-4 | English footer label "Noetia Causes" vs the brand name "Causas Noetia" (existing i18n; unchanged) | PO (LPD-9) |
| U-5 | Metadata is a single language (Spanish title with bilingual description). Per-language metadata needs server-side locale detection (not in scope) | Engineering (later) |
| U-6 | English term for *fragmento* is undecided (DV-04): the landing page uses "passage" in English, while the app still says "fragment" | PO |
| U-7 | The ownership and privacy claims flagged in the prototypes are **omitted** from the live copy pending approval | PO, legal |
| U-8 | Playfair Display ships as a 300 KB TTF, preloaded with `display: swap` (headline text renders immediately in fallback). WOFF2 subsetting is recommended in Package A | Engineering (later) |
| U-9 | axe, Lighthouse and the Playwright e2e suite were not run locally (no tooling or running stack) | Review |
| U-10 | Release: merge equals production deploy (CD on `main`). Requires explicit PO authorization; check no deploy is running first | PO |

## 5. Boundaries respected

- Noetia+/NoetiaX not activated.
- No premium checkout path.
- No entitlement change.
- No AI functionality.
- No subscription-economics, legal-policy or financial-allocation change.
- NEM-024 unchanged: E-1 OPEN and BLOCKED; Checkpoint E NOT QUALIFIED.
- PR #56 and PR #57 not modified.
- No merge, deployment or activation.
