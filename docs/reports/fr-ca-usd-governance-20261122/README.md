# FR-CA governance alignment and USD informational-currency policy: completion report

**Mission:** PO "FR-CA Governance Alignment and USD Informational Currency Policy" (2026-11-22).
**Authorization:** specification preparation and governance alignment only. Implementation, merge, deployment and payment activation are **not authorized**.
**Deliverables on this branch (docs only):**
- [`docs/product-governance/COMMERCE-USD-LOCAL-REFERENCE.md`](../../product-governance/COMMERCE-USD-LOCAL-REFERENCE.md): deliverable A, the commerce policy addendum.
- [`nem-025-reconciliation-checklist.md`](nem-025-reconciliation-checklist.md): deliverable B, a PA reconciliation checklist. **It does not replace the full approved NEM-025 specification.**
- [`nem-026-reconciliation-checklist.md`](nem-026-reconciliation-checklist.md): deliverable C, a PA reconciliation checklist. **It does not replace the full approved NEM-026 specification.**
- This report: §4 engineering map and the completion report.

---

## 1. Repository baseline and relevant PR status

| Item | State (2026-11-22) |
|---|---|
| `main` | `8f2f294` (PR #59 merge), unchanged since the COMMERCE-W1-W2-DOC baseline |
| **PR #74** (COMMERCE-W1-W2 policy record; holds `COMMERCE-DECISIONS.md`) | Draft, head `e0663d1`, **not merged**. **Not modified** by this mission. |
| **PR #60** (payment lifecycle; holds `services/web/lib/currency.ts` `formatUsd`) | Draft, stacked on #59, head `d8e61e2`. **Not modified.** Design addenda A–G are in its comments. |
| PR #75 (admin email register) | Draft, head `cb95360`. Not modified. |
| **NEM-025 / NEM-026 approved specification files** | Exist in the PO's finalized approval packet (PA confirmation) but are **not yet in GitHub**: not on `main`, not on any remote branch, not in GitHub issues or PRs; `docs/engineering-missions/APPROVED/` holds only `.gitkeep`. Required location: `docs/engineering-missions/APPROVED/NEM-025-<approved-title-slug>.md` and `…/NEM-026-<approved-title-slug>.md`, verbatim (§6, Q-1). |

Governance read: `CLAUDE.md` and `docs/engineering-missions/README.md` (APPROVED ≠ execute; DOCUMENTATION ONLY level; stop for PA).

## 2. Approved decisions incorporated

- **Trilingual platform:** `en`, `es`, `fr-CA`; label "Français (Canada)"; book language independent of interface language; private, unpublished French pilot until separately approved. → NEM-025 reconciliation checklist §A.
- **Initial French catalogue, exactly five titles** (*Candide*; *Le Horla*; *Le Tour du monde en quatre-vingts jours*; *Madame Bovary*, Gutenberg #14155; *Maria Chapdelaine*). These are candidates, not cleared. → NEM-026 reconciliation checklist §A.
- **USD exclusive transaction currency,** with informational local equivalents, reference-rate sourcing (Bank of Canada evaluated for CAD), date disclosure, card-issuer and bank disclaimer, USD-only fallback, and no other currencies, Stripe prices or FX settlement. → policy addendum.
- **Not reopened:** T-1, D1–D6, F-01, W-1/W-2, subscription, token and ownership rules.

## 3. Documentation changes

Three new files plus this report, all additive. **No existing file was modified**: PR #74's record, PR #60, CLAUDE.md and the PRD are untouched. `docs/product-governance/` is new on this branch (on `main` it does not exist yet; PR #74 adds a different file to it, so there is no conflict).

## 4. Currency architecture impact assessment and technical implementation map (analysis only)

### 4.1 Existing pricing and currency display utilities

| Location (`main` 8f2f294 unless noted) | What it does | Note |
|---|---|---|
| `services/web/app/(billing)/pricing/page.tsx:76` | local `formatPrice(cents)` → `$X.XX` (bare `$`) | client component; plans, annual "equivalent per month", token packages |
| `services/web/app/(billing)/gift/page.tsx:14` | local `formatPrice` → bare `$`; gift amounts hard-coded `999` / `2499` | duplicates the API gift price table |
| `services/web/lib/plan-utils.ts:18` | `formatPrice(amountCents, interval)` → number string (no symbol) | used by `components/PlanCard.tsx` |
| `services/web/app/(billing)/pricing/layout.tsx:6` | metadata "desde **$9.99**/mes" | **stale:** the locked price is $8.99 (fixed on PR #60, which has `US$8.99`) |
| `services/web/lib/i18n/{en,es}.ts` | literal `$8.33 ea.` / `c/u` | literal prices inside copy |
| `services/mobile/src/i18n/{en,es}.ts:104-108` | literal `$8.99/mo`, etc. | mobile paywall prices are **hard-coded in i18n**, not read from configuration |
| `services/web/lib/legal/terms-of-service.ts` | `$8,99 USD` / `$8.99 USD` tables | legal text; changes gated by legal review (PR #22) |
| **PR #60** `services/web/lib/currency.ts` | `COMMERCIAL_CURRENCY = 'USD'`, `formatUsd(cents)` → `US$8.99`; used by pricing and gift pages; mobile i18n moved to `US$` | **The natural home for the new formatter**, but it is not on `main`. NEM-025 depends on PR #60 landing or on transplanting this file. |

**Implication:** prices live in five independent places, two of them literal strings in copy. The `fr-CA` format `8,99 $ US` cannot come from literal `US$` strings. NEM-025 should route every displayed price through one formatter that is language-aware and USD-marked: `Intl.NumberFormat(locale, {style: 'currency', currency: 'USD'})` gives `8,99 $ US` for `fr-CA` (verified with Node). The mobile paywall should read amounts rather than literals; that is a NEM-025 scope decision.

### 4.2 Stripe checkout and refund boundaries that must stay strictly USD

| Boundary | File | Amount source | Currency |
|---|---|---|---|
| Subscription Checkout | `subscriptions.service.ts:212` | Stripe Price ID (server-side) | set in Stripe (USD; dashboard verification still pending per the USD decision) |
| Book purchase Checkout | `subscriptions.service.ts:239-245` | `book.priceCents` (DB) | `currency: 'usd'` hard-coded |
| Token-package Checkout | `subscriptions.service.ts:265` | `TokenPackage.stripePriceId` | Stripe Price (USD) |
| Gift Checkout | `gifts.service.ts:68-73` | server gift price table | `currency: 'usd'` hard-coded |
| Webhook fulfilment and W-2 verification | `webhooks.*` (PR #60 R2) | Stripe event vs purchase-time snapshot | USD only |
| Refunds | none in code (manual in the Stripe Dashboard, W1-PO policy) | — | USD (Stripe refunds in the charge currency) |

All amounts are server-side today. The global `ValidationPipe({ whitelist: true })` (`main.ts:40`) strips undeclared request fields. **Neither must change.**

### 4.3 Retrieving reference rates without exposing secrets

- **The Bank of Canada Valet API needs no key** (tested 2026-11-22: `GET https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1` → 200, `{"d":"2026-11-20","FXUSDCAD":{"v":"1.4325"}}`). **No secret is involved.**
- **Fetch server-side** (API), not from browsers: one outbound call per refresh instead of one per visitor, which respects the Terms §3 request limits and avoids exposing third-party calls client-side.
- **Smallest practical approach:**
  *Applies only if the PO approves P-1 to P-3; CAD is used below as the worked example, not as an approved scope.*
  1. **API:** a small read-only module (for example `fx/`) with `GET /api/fx/reference?currency=CAD` → `{ currency, rate, rateDate, source: 'Bank of Canada', derived: false }` or `204`/`null` when unavailable or stale. No auth is needed (public reference data, no PII).
  2. **Cache in the existing Redis** (`ioredis` is already a dependency), key `fx:USD:CAD` = `{rate, rateDate, fetchedAt}`, refreshed at most every 6 h, either lazily on request or with an existing `@nestjs/schedule` cron. **Keep the last good value**; serve it only while `rateDate` is within the freshness limit (proposed 5 calendar days).
  3. **Web and mobile:** one shared formatter, `formatLocalEstimate(usdCents, ref, locale)` → display string or `null`; render it under the USD price with the disclosure. Nothing returned is ever sent back to the API.
  - Node 20 (`api/Dockerfile`) has a built-in `fetch`: **no new dependency.**
- **Alternative (even smaller, CAD-only and mobile-less):** a Next.js server component with `fetch(..., { next: { revalidate: 21600 } })`. *Rejected:* `/pricing` is a client component, `/api/*` is routed to NestJS by Traefik, and mobile would need its own copy.

### 4.4 Caching, freshness and no continuous paid dependency

- **Freshness:** the Bank publishes once per business day by 16:30 ET, with gaps on weekends and statutory holidays. A 6-hour refresh plus a 5-day staleness limit covers long weekends while still hiding an outdated rate.
- **Validation:** reject non-numeric, ≤ 0 or implausible values (for example outside a configured sanity band); then USD only.
- **No paid dependency:** the Bank of Canada is free. Derived MXN/BRL/PEN/EUR come from the same source. COP/CLP/ARS have no free source identified here, so **no estimate** is shown for them unless the PO approves a source (policy U-3). No subscription to a commercial FX API is proposed.

### 4.5 Authorization needs of the proposed implementation

| Area | Needed? | Detail |
|---|---|---|
| Infrastructure | **No new infrastructure.** One check: outbound HTTPS from the `api` container to `www.bankofcanada.ca` (Docker default egress; the firewall is not expected to block it, but this must be verified, never assumed) | — |
| Database / migrations | **No** | Redis cache only; `users.uiLanguage` already fits `fr-CA` |
| New dependencies | **No** | built-in `fetch`, existing `ioredis` and `@nestjs/schedule` |
| Recurring cost | **No** | free public source |
| Stripe | **No change** | display only |
| **Legal** | **Yes** | Bank of Canada Terms reuse (§1.1 attribution, §1.3 paid services, §2.3 LSEG third-party content, §3 request limits); FR/EN/ES disclosure copy; French legal documents and Québec French-language obligations before any public French release (§6) |
| Product (PO) | **Yes, PENDING** | CAD scope, currency-selection behaviour (P-1, P-2) and legal-source clearance (P-3) |

### 4.6 Tests ensuring exchange rates never affect payment amounts

See the NEM-025 reconciliation checklist §D (D1–D6): Checkout parameter tests under available, stale and extreme rates; stripping of client-supplied amount or currency; module-isolation source scan; formatter null-on-stale and explicit marking; W-2 unchanged; UI renders USD and allows checkout when the rate endpoint fails.

## 5. NEM-025 / NEM-026 consistency verification

| Check | Result |
|---|---|
| Full approved NEM-025 text vs repository | **Pending:** the full file is not yet in GitHub (Q-1). Checklist B is ready for PA to apply once it is committed. |
| Full approved NEM-026 text vs repository | **Pending:** same (Q-1). Checklist C is ready. |
| Checklists vs PO decisions | Consistent: three interface languages, the exact label, independent book language, private pilot, exactly five titles, edition #14155, USD only, informational equivalents. |
| Checklists vs commerce policy | Consistent: NEM-025 §A5–A7 and §D reference USD-LOCAL-REFERENCE §1–§8. |
| Checklists vs existing decisions | No change to T-1, D1–D6, F-01, W-1/W-2, tokens or ownership. |
| Repository facts | `uiLanguage` VARCHAR(5) fits `fr-CA`; `books.language` fits `fr`; no French titles in the catalogue; binary `isEn` language handling would silently serve Spanish to `fr-CA` users. |

## 6. Risks, dependencies and unresolved material questions

**Material questions**
- **Q-1:** **The full PO-approved NEM-025 and NEM-026 specifications must be committed verbatim** to `docs/engineering-missions/APPROVED/NEM-025-<approved-title-slug>.md` and `…/NEM-026-<approved-title-slug>.md` (pattern of NEM-019/021/022), with their approval records, in a documentation-only change authorized by the PO. Committing them does not authorize execution. Then PA applies the reconciliation checklists. *(Not done in this PR: the full texts are not available to the agent, and this correction authorizes only the documentation fix.)*
- **Q-2 (policy P-1/P-2, U-2): PENDING PO DECISION.** CAD scope (whether CAD equivalents are shown, and to whom; any other currencies) and currency-selection behaviour. **Not approved; nothing is assumed.** Until decided, USD only.
- **Q-3 (policy P-2, U-3): PENDING PO DECISION.**** COP/CLP/ARS: no estimate, or another verifiable free source.
- **Q-4 (policy P-3, U-1): PENDING PO DECISION / legal.** Legal-source clearance of Bank of Canada data reuse, and of the disclosure copy.

**Risks and dependencies**
- **R-1, dependency on PR #60:** the USD formatter (`currency.ts`) and the explicit `US$` marking exist only on PR #60. `main` still shows bare `$` and stale metadata (`$9.99`). NEM-025 must land after #60, or transplant that utility.
- **R-2, legal before any public French release (not legal advice):** French versions of the Terms, Privacy and Cookie policies, and possible Québec French-language requirements for commercial communications and consumer contracts, need legal review. This is a dependency of the public-release checkpoint, not of the private pilot.
- **R-3, silent Spanish fallback:** the binary `isEn` handling would serve Spanish to `fr-CA` users if the preference were stored before NEM-025 completes. Keep the `fr-CA` option hidden until all transactional messages are covered.
- **R-4, French alignment quality:** the Whisper and aligner pipeline is unvalidated on French. This is a NEM-026 pilot risk.
- **R-5, Gutenberg verification:** edition #14155 and the French editions were not verifiable (HTTP 503 on 2026-11-22).
- **R-6, Stripe dashboard currency:** the USD decision's pending check (that Stripe Price objects are `usd`) is still open, and it is unaffected by this mission.
- **R-7, mobile paywall literals:** prices hard-coded in mobile i18n need conversion to the formatter for `fr-CA`. This is a NEM-025 scope item.

## 7. Confirmation

- **No application code, tests, migrations, Stripe configuration, price objects, `PAYMENTS_ENABLED`, dependencies, CI rules, production or staging were modified.** No French book was ingested or published. PR #60, PR #74 and all approved financial rules are unchanged.
- External calls made: read-only GETs to the Bank of Canada public pages and the Valet API, and Project Gutenberg (503). No user data was sent.
- NEM-025 and NEM-026 were **not started**; each requires a distinct PO execution instruction.

## 8. Draft PR

Link recorded in the PR body and the completion comment.

**FR-CA-USD GOVERNANCE ALIGNMENT COMPLETE — STOP FOR INDEPENDENT PRODUCT ARCHITECTURE REVIEW.**

---

## 9. PA review corrections (2026-11-22)

PA accepted PR #76 with two documentation corrections, applied in the follow-up commit:
1. **Policy precedence corrected:** the latest explicit PO decision governs the specific matter it addresses; all unrelated earlier commerce decisions remain in force (USD-LOCAL-REFERENCE header).
2. **Full specifications preserved:** the former "alignment annexes" are renamed and reframed as **reconciliation checklists**. They no longer claim to define what the specifications contain. The full PO-approved NEM-025 and NEM-026 specifications govern and must be committed verbatim under `docs/engineering-missions/APPROVED/` (Q-1).

Also made explicit: **CAD scope, currency-selection behaviour and legal-source clearance are PENDING PO decisions (P-1 to P-3).** No local-currency equivalent may be displayed until they are decided.

**STOP FOR INDEPENDENT PA RE-REVIEW.**
