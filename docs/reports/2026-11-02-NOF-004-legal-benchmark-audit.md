# NOF-004 — Terms of Service legal benchmark audit (Amazon, Kindle, Google Play, New York and US law)

> **Internal risk assessment — not legal advice or legal certification.** The Product Owner selected an internal benchmark-and-approval process instead of external counsel. Nothing here says Noetia complies with any law. Matching Amazon or Google practice is **not** treated as proof of compliance.

## 1. Mission and objective

**Mission:** NOF-004, Terms of Service benchmark audit.
**Objective:** do a read-only review of Noetia's published Terms of Service, Privacy Policy and Cookie Policy (English and Spanish) against:
- what the product actually does
- the official terms of Amazon, Kindle and Google Play
- New York and US federal requirements, kept separate from competitor practice

International requirements are flagged for later review. The findings go to the Product Owner before any implementation is proposed.

## 2. Date and status

| | |
|---|---|
| Audit performed | 2026-11-02 |
| Report published | 2026-11-02 (this documentation-only Draft PR) |
| Status | **Complete; awaiting Product Owner review.** No recommendation is approved, implemented, merged or deployed. |
| Repository baseline | `main` at `6a5e5c0`. Published legal documents dated "4 de junio de 2026 / June 4, 2026" (`services/web/lib/legal/cookie-policy.ts:1`). |
| Related PRs (left untouched) | [#21](https://github.com/Carloskfe/noetia/pull/21) (NOF-004 presentation, Draft) · [#22](https://github.com/Carloskfe/noetia/pull/22) (Terms annual-price correction, Draft, approval-gated) |

### Confirmed Product Owner assumptions

These are facts supplied by the Product Owner. They were not checked by engineering.

- Noetia is currently operated by **an individual in New York, United States**.
- "Noetia" is an **unregistered project name**, not an LLC, corporation or registered DBA.
- **Annual subscriptions remain available.**
- Approval is by **internal benchmark review**, not external counsel, and is not presented as legal certification.
- PR #21 and PR #22 stay untouched and in Draft.

## 3. Scope and exclusions

**In scope**
- Terms, Privacy Policy and Cookie Policy, EN and ES, as published on `main` (`services/web/lib/legal/{terms-of-service,privacy-policy,cookie-policy}.ts`).
- Product behaviour as written in the code for:
  - subscriptions, trials, renewals and cancellation
  - tokens and gifts
  - refunds
  - access to purchased content
  - account deletion
  - the related customer-facing copy (web and mobile i18n)

**Excluded**
- Production databases, Stripe Dashboard or API, and live systems. No queries were run. Stripe Dashboard and Billing Portal settings are therefore **unverified**.
- Running any flow end-to-end. Behaviour comes from reading the code.
- International law beyond flagging it (§6.4).
- Apple App Store and Google Play store payment rules beyond flagging them.
- Drafting replacement legal text. The recommendations are topics, not wording.

**Evidence labels used throughout**
- **[Fact]** Read directly from the repository or from a primary source fetched on 2026-11-02.
- **[Interpretation]** Engineering's reading of how a fact relates to a rule. Not a legal conclusion.
- **[Unverified]** Identified but not researched, or seen only in secondary or search-index sources.

## 4. Executive summary

- **The biggest risks come from how the product behaves, not from the wording.**
  - Deleting an account does not cancel the Stripe subscription.
  - Any published book can be added to a library, and that permanently unlocks it.
  - Annual subscribers who turn off auto-renew stop receiving the monthly tokens they've already paid for.
  - Trials hand out tokens that unlock books permanently.
  - There's no in-app cancellation, no confirmation after subscribing, no annual renewal reminder, and no refund or chargeback handling.
- **The renewal terms fall short of New York's automatic-renewal law (GBL §527-a) and ROSCA** [Interpretation]. Missing: material terms next to the consent request, affirmative consent, a confirmation the user can keep, cancellation as easy as signing up, the annual renewal notice, and rules for material changes and price increases.
- **The documents don't describe the actual operator.** They name a Spanish governing law and courts, and identify the provider only by a handle ("Carloskfe"), although the operator is an individual in New York.
- **Several provisions are missing altogether:** acceptance, how the Terms change, the content licence and what "permanent ownership" means, gifts, the copyright-complaint process and repeat-infringer policy, the full token rules, and tax.
- **The English and Spanish legal documents agree with each other.** No substantive contradictions found. The contradictions are between the legal documents and the product, in both languages (§5.3).
- **13 Product Owner decisions** are needed before replacement wording can be drafted (§10).

## 5. Verified findings

### 5.1 Product behaviour (code-level) [Fact unless marked]

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **Deleting an account doesn't cancel the Stripe subscription.** `deleteAccount` deletes the local `subscriptions` row and makes no Stripe call, so billing can continue after deletion. The only safeguard is a warning in the deletion dialog. It also deletes the payment-related rows the Privacy Policy says are kept for 7 years. | `services/api/src/users/users.service.ts:54-76` (line 65); `services/web/lib/i18n/en.ts:278`; `services/web/lib/legal/privacy-policy.ts:52,151` |
| F-2 | **Adding a book to the library unlocks it permanently.** `POST /library/:bookId` inserts a `user_books` row for **any** published book, with the default `purchaseType 'free'`. `SubscriptionGuard` treats any `user_books` row as ownership, so the book can be read with no token or subscription. The web Discover page's "add" action calls this endpoint. | `services/api/src/library/library.controller.ts:31`; `library.service.ts:14-19`; `subscription.guard.ts:30-37`; `services/web/app/(library)/discover/page.tsx:124` |
| F-3 | **An active subscription unlocks every book, not just token-redeemed books.** The guard lets `active`, `trialing` and `canceling` subscribers, and linked members, open any published book. The Terms describe tokens "redeemed to access individual books". This was already recorded in the NOF-003 audit (NEM-013 not built). | `subscription.guard.ts:13,40-60`; `terms-of-service.ts` §3 |
| F-4 | **Annual subscribers stop getting monthly tokens once they turn off auto-renew.** The daily job only selects `status: 'active'`, so a subscriber in `canceling` (auto-renew off, term still paid) gets no more tokens for the rest of the prepaid year. The Terms say cancellation "takes effect at the end of the current billing period". Tokens are issued every **30 days**, not each calendar month. | `services/api/src/subscriptions/subscriptions.service.ts:172,183,310` |
| F-5 | **Every checkout gets a 14-day trial**, with no once-per-customer limit. | `subscriptions.service.ts:216` |
| F-6 | **Trial users get paid tokens.** Every `invoice.paid` event marks the subscription `active` and issues paid 90-day tokens. [Unverified] Stripe sends `invoice.paid` for the $0 invoice at the start of a trial; this is standard Stripe behaviour but should be confirmed in test mode. If it does, trial users get full tokens and keep redeemed books permanently even if they cancel during the trial. | `services/api/src/subscriptions/webhooks.service.ts:63,125-141` |
| F-7 | **Cancellation only goes through the Stripe Billing Portal** ("Gestionar facturación"). `POST /subscriptions/cancel` exists, but no web or mobile client calls it. Whether the portal is configured to allow cancellation is **[Unverified]**. | `services/web/app/(account)/account/billing/page.tsx:71,172`; `subscriptions.service.ts:482` |
| F-8 | **Noetia sends no subscription email.** The email service only sends account emails (confirmation, password reset, farewell), waitlist emails, gift emails and plan invites. Whether Stripe's own receipt or renewal emails are enabled is **[Unverified]**. | `services/api/src/email/email.service.ts` (methods at lines 28-94) |
| F-9 | **Refunds and chargebacks aren't handled.** There are no `charge.refunded` or `charge.dispute.*` handlers, so refunded tokens and books stay with the user. | `webhooks.service.ts:57-77` |
| F-10 | **Promotional and courtesy tokens expire after 30 days**, paid tokens after 90. The Terms mention only 90 days. | `subscriptions.service.ts:27-29`; `terms-of-service.ts` §3 |
| F-11 | **Gifts:**<ul><li>prices are hard-coded: 1 token $9.99, 3 tokens $24.99</li><li>no account needed to buy</li><li>the claim link expires after **365 days**</li><li>tokens expire **90 days after claiming**</li></ul>The web copy says "Tokens are valid for 1 year" (EN and ES). | `services/api/src/gifts/gifts.service.ts:13-14,52-66`; `en.ts:793`; `es.ts:790` |
| F-12 | **Family plan size:** the product allows 5 users (`maxProfiles` 5) and the web card says "Up to 5 users". The Terms say "up to 4 members". | `en.ts:360`; `es.ts:362`; `terms-of-service.ts:27,124` |
| F-13 | **No age check at sign-up.** The Terms require 18+. The sign-up page doesn't link the Terms. | `terms-of-service.ts:17,114`; `services/web/app/(auth)/register/page.tsx` |
| F-14 | **Privacy Policy claims with no matching code found** (searched by keyword, so absence isn't proven):<ul><li>2-year rolling purge of behavioural events</li><li>data export for portability</li><li>author-facing aggregate statistics with a 50-user threshold (only admin persona endpoints exist)</li></ul>No analytics library was found in web code, although the Cookie Policy lists analytics cookies. | `privacy-policy.ts:53,69,77,152,168,176`; `services/api/src/personas/personas.controller.ts`; `cookie-policy.ts:29,71` |
| F-15 | **"Full library access" is still a mobile paywall benefit.** It was removed from web in Draft PR #21. | `services/mobile/src/i18n/en.ts:104` |

### 5.2 Benchmark and legal matrix

Risk: **C** Critical · **H** High · **M** Medium · **L** Low.
Benchmark and law tags: **[V]** primary source read 2026-11-02 · **[S]** secondary or search-index only · **[U]** not researched.

| # | Topic: current Noetia clause | Actual behaviour | Official benchmark | Applicable legal requirement | Discrepancy and risk | Recommended change | PO decision |
|---|---|---|---|---|---|---|---|
| 1 | **Provider identity.** "Carloskfe / Noetia" (Terms `:79,176`); "operated by Carloskfe" (Privacy `:11,110`). No legal name or address. | Individual in New York; unregistered project name. | Google Play names Google LLC (Mountain View) and states who the seller is on each purchase [V]. Amazon names its contracting entity [S]. | ROSCA and NY 527-a require material terms to be disclosed, which assumes an identifiable seller [V; Interpretation]. NY GBL §130 (assumed-name certificate for an individual trading under another name) [U]. EU and Spain: provider identification rules (LSSI) [U]. | **H.** Users can't identify who they're contracting with. | Publish the legal name, "doing business as Noetia" status and a postal contact address. | Name and address to publish; whether to register a DBA or form an entity first. |
| 2 | **Governing law and disputes.** Spanish law and Spanish courts (Terms `:93,190`); Privacy governed by GDPR and Spanish law (`:85,184`). | New York operator; USD Stripe billing. | Amazon US: Washington law, binding individual arbitration (JAMS), class waiver, small-claims exception [S; page returned 503]. Google Play Terms defer to the Google ToS, not fetched [V]. | No verified rule mandates a choice. Mandatory consumer law of the user's place of residence usually applies anyway [U]. | **H.** Names a jurisdiction with no connection to the operator. | Name New York law and New York courts or arbitration; keep a mandatory-law statement and a small-claims exception. | Courts or arbitration (with or without a class waiver). |
| 3 | **Acceptance.** No acceptance clause. | Terms are never shown or accepted at sign-up or checkout; no record kept (F-13). | Google: accepted by agreeing and using [V]. Kindle: purchase or use binds the buyer, and product pages say so [S]. | ROSCA §8403(2): express informed consent before charging [V]. NY 527-a(1)(b): affirmative consent to the renewal terms before charging [V]. | **H.** The Terms are hard to enforce, and the consent requirements aren't met. | Wording: acceptance clause. Engineering: checkbox at sign-up and checkout, recording version, time and method. | Re-acceptance flow for existing users. |
| 4 | **Changes to the Terms.** No clause (Privacy §10 has one). | No mechanism to notify users. | Google: at least 30 days' notice; users may stop using the service and keep content under the earlier terms [V]. Kindle: may change by posting; continued use is acceptance [S]. | NY 527-a(1)(g): notice of a material change, including a price increase, 5 business days to 30 days beforehand [V]. 527-a(1)(b-1): a price increase needs prior affirmative consent, or the right to cancel within 14 days with a pro-rata refund [V]. | **H.** Renewal terms and prices can't lawfully be changed for existing subscribers. | Clause on changes and notice with an effective date; price-change clause matching 527-a. | Notice period. |
| 5 | **Plan prices.** Annual $80.99 / $125.99 / $170.99 (`:25-27,122-124`). | Shown and charged: $83.99 / $129.99 / $179.99. | — | Accurate disclosure of material terms: ROSCA [V]; 527-a(1)(a) [V]; GBL §349 [U]. | **M.** No subscribers yet (PO audit, 2026-11-01). Corrected in Draft PR #22. | Ship #22, or fold it into the full revision. | Timing of #22. |
| 6 | **Auto-renewal disclosure.** "Renew automatically… unless you cancel beforehand." | Pricing page shows the price and "14-day free trial. Cancel anytime." (`en.ts:335`). It doesn't show the post-trial charge, its date, how often, the cancellation deadline or how to cancel next to the button. | Google developer policy: before enrolment, trial length, post-trial price, when and how it converts, and how to cancel [V]. | 527-a(1)(a): five material terms, clear and conspicuous, next to the consent request, plus how and when the price changes after a trial [V]. ROSCA §8403(1): disclosed before billing details are collected [V]. | **H.** | Engineering: disclosure block next to the button. Wording: Terms aligned. | — |
| 7 | **Confirmation after subscribing.** None. | None from Noetia (F-8). | — | 527-a(1)(c): a confirmation the user can keep, with the terms, price, frequency, deadline and how to cancel [V]. | **H.** | Engineering: confirmation email triggered by the webhook. | — |
| 8 | **Free trial.** "When available, terms will be specified at the time of subscription." | Always 14 days, unlimited per customer, with tokens issued (F-5, F-6). | Google: trial length and conversion disclosed; cancelling a trial may end access immediately [V]. | 527-a(1)(a) [V]. The pre-charge notice in 527-a(1)(h) applies only to trials **longer than one month**, so not to the current 14-day trial [V; Interpretation]. | **H.** The Terms don't describe how trials actually work; abuse risk. | Wording: trial length, conversion, eligibility. Engineering: limit trials; hold tokens until the first paid invoice. | One trial per customer? Tokens during the trial? |
| 9 | **Cancellation.** "From your account settings"; effective at the end of the period; no partial refunds (`:38,135`). | Stripe portal only (F-7); annual token drip stops while `canceling` (F-4). | Google: cancel any time, keep access to the end of the period, cancellation centre linked from the app [V]. Kindle Unlimited: cancel from account settings, active until the next billing date [S]. | 527-a(1)(d)/(d-1): available at any time, as easy as signing up, in the same medium [V]. 527-a(1)(e): no obstruction [V]. ROSCA §8403(3): "simple mechanisms" [V]. | **H.** The clause doesn't match the product; paid-for annual tokens are withheld. | Engineering: in-app cancel button or a verified portal setting; keep the annual drip running while `canceling`. Wording: describe the real path. | — |
| 10 | **Annual renewal notice.** None. | Not implemented. | Google charges no earlier than 48 hours before the period [V]. | 527-a(1)(f): for initial terms of a year or more renewing for 6 months or more, notice 15 to 45 days before the cancellation deadline, with instructions to cancel [V]. | **H.** Annual plans are kept by PO decision. | Engineering: reminder job, or a verified Stripe upcoming-renewal email. | — |
| 11 | **Account deletion and billing.** Not covered. | F-1. | — | ROSCA "simple mechanisms" [V]; 527-a(1)(e) [V]; GBL §349 [U]. | **C.** Possible charges after deletion. | Engineering: cancel in Stripe on deletion, in a transaction. Wording: what happens to subscriptions and owned books on deletion. | — |
| 12 | **Plan changes.** Take effect at the next cycle. | No code; Stripe portal behaviour applies, and its settings are [Unverified]. | Google: depends on the developer; leftover days may be credited [V]. | Disclosures must match practice (GBL §349) [U]. | **M.** | Confirm the portal settings, then align the clause. | Immediate with proration, or next cycle? |
| 13 | **Refunds.** Only for "proven technical failure" (`:40,137`). | No refund or chargeback handling (F-9). | Google Play Books: ebooks refundable within 7 days, or within 65 days if the ebook doesn't work; audiobooks final sale; subscriptions not refunded for the current period [V]. Kindle return policy referenced [S]. | 527-a(1)(b-1): pro-rata refund in the price-increase route [V]. NY GBL §218-a (posting a refund policy), unclear whether it applies online [U]. EU withdrawal right [U]. | **M.** Statutory rights aren't acknowledged; refunds aren't processed. | Wording: "without prejudice to statutory rights", the request process, timing. Engineering: refund and chargeback handlers. | Refund policy. |
| 14 | **Tokens.** Valid for 90 days from issue. | Paid tokens 90 days; promotional and courtesy 30 days (F-10); every 30 days for annual plans; Duo and Family share the owner's pool. | Kindle Unlimited: borrowed titles end when the membership ends [S]. Noetia's permanent books are more generous. | Purchased token packs might count as prepaid store credit (see row 15) [U]. | **M.** | Wording: each token type and expiry, shared pools, issuing schedule. | Confirm 30-day promotional expiry. |
| 15 | **Gifts.** Not in the Terms; copy says "valid for 1 year". | F-11. | Amazon gift-card terms: fetch failed (503), not benchmarked. | NY GBL §396-i covers electronic "pre-funded records" issued in a specified amount; a non-promotional one may not expire within **9 years**; fees are prohibited; a notice that terms apply is required [V]. 12 CFR §1005.20: 5 years; emailed codes covered; a card for a specific item with no dollar value is generally not covered [V, with parts from summary]. Whether a gift of tokens counts as "a specified amount" is **unresolved** [Interpretation]. | **H.** The copy is misleading either way, and gift-card law may apply. 0 gifts sold. | Wording: a gift section. Engineering: depends on the decision. | Treat as gift certificates (9-year floor), or redesign gifts. |
| 16 | **Content access and ownership.** Not addressed; §8 says content is "licensed to Noetia". | Redeemed and purchased books stay permanently; an active subscription opens every book (F-3); account deletion removes owned books. | Kindle: a licence, not ownership; personal, non-commercial; no resale; subscription content lasts only while subscribed [S]. Google: personal licence; content may be removed if rights are lost, with a replacement or refund [V]. | California's disclosure rule for "buy" wording on digital goods [U]. FTC Act §5 deception [U]. | **H.** Users' rights to books are undefined, including when an author withdraws a book. | Wording: licence grant, meaning of "permanent", what happens on withdrawal (replacement or refund), suspension or deletion. | Wording for "permanent ownership"; access model (all-access or token-only, NEM-013). |
| 17 | **Causas.** "2.22% of every payment is automatically allocated… you authorise this distribution" (`:44,141`). | No allocation is implemented (NOF-003 audit). | — | NY rules on businesses advertising that part of a sale goes to charity ("commercial co-venturer") [U]. GBL §§349/350 on unsubstantiated claims [U]. | **M–H.** | Reword as Noetia's own commitment, link to how it's reported, drop "you authorise". | Whether the 2.22% commitment can be stated as fact yet. |
| 18 | **Family size.** "Up to 4 members". | 5 (F-12). | — | Accurate disclosure [U]. | **M.** | Align after the decision. | 4 or 5? |
| 19 | **Eligibility.** 18+. | No age check (F-13). | Google: minors allowed with parental permission [V]. | COPPA, if the service targets children or knowingly collects data from under-13s [U]. | **M.** | Engineering: age statement at sign-up. | 18+ only, or 13–17 with parental consent? |
| 20 | **User content and copyright.** DRM and fragment clauses; no copyright-complaint process. | Authors upload books; users share fragments and post in clubs. | Amazon and Google copyright processes: not fetched [U]. | 17 U.S.C. §512(c)(2): hosting safe harbour only with a designated agent, published on the site and registered with the Copyright Office. §512(c)(3): notice elements. §512(i)(1)(A): repeat-infringer policy, communicated to users [V]. | **H.** No safe harbour for uploaded content. | Wording: copyright-complaint and repeat-infringer section. Ops: register the agent. | Who the agent is, and the address. |
| 21 | **Termination.** "Immediate suspension without refund." | No termination flow. | Google: licence ends on breach, no refund [V]. Amazon (Kindle+): prorated refund if Amazon terminates without misconduct [S]. | Unfair-terms law [U]. | **M.** What happens to owned books on suspension isn't defined. | Wording: grounds, notice, appeal route, effect on owned books. | Do owned books survive a suspension? |
| 22 | **Disclaimer and liability cap.** Capped at the amount paid in the last 12 months. | — | Industry-standard [S]. | Exceptions required by mandatory law [U]. | **L.** | "To the extent permitted by law" exceptions. | — |
| 23 | **Privacy legal framework.** GDPR, Spain; a CCPA section. | New York operator; stores email and password. | — | NY SHIELD Act (§899-bb): reasonable safeguards, with a scaled programme for small businesses [V]. §899-aa: email or username plus password counts as private information; breach notice within 30 days of discovery [V]. CCPA thresholds likely not met [U]. GDPR Art. 3(2) and the Art. 27 EU representative, if serving the EU [U]. | **M.** | Rewrite the "applicable law" and "your rights" sections for New York and the US; keep GDPR only if the EU is targeted. | Is the EU a target market? |
| 24 | **Privacy claims not matched by the code.** | F-14 and F-1 (7-year payment records). | — | GBL §349 if the claims mislead [U]. GDPR Art. 20 if GDPR applies [U]. | **M.** | Make the policy describe current practice, or build the missing features. | — |
| 25 | **Cookie Policy.** Lists analytics cookies, 30 days. | No analytics library found (F-14). | — | — | **L.** Over-discloses. | Mark analytics as "not currently used". | — |
| 26 | **Tax.** USD prices, no statement about tax. | Stripe automatic tax not enabled at checkout. | Kindle Unlimited: fees may be subject to tax [S]. | NY and multistate sales tax on digital books [U]; EU VAT [U]. | **M.** | "Plus applicable taxes", or tax-inclusive pricing. | Tax registration review. |
| 27 | **Mobile purchases.** The paywall sends users to noetia.app. | — | Apple and Google rules on buying outside the app [U]. | Store contracts, not statute [U]. | **M.** | Check before store submission. | — |

### 5.3 English and Spanish versions [Fact]

- **No substantive contradictions between the EN and ES legal documents.** I compared every section of all three documents; tables, figures, durations and rights match.
- **Minor naming inconsistencies:**
  - The Causas programme is "Causas Noetia" (Terms ES), "Noetia Causas" (Terms EN) and "Noetia Causes" (EN product copy).
  - The rights-request subject line is "Derechos RGPD" (ES) and "GDPR Rights" (EN). Acceptable, but staff must recognise both.
- **The real contradictions are between the legal documents and the product, the same in both languages:**
  - Family 4 vs 5 (F-12)
  - gift "1 year" vs claim-link expiry plus 90 days (F-11)
  - cancellation "from account settings" vs the Stripe portal (F-7)
  - "monthly" tokens vs every 30 days (F-4)
  - undisclosed 30-day tokens (F-10)
  - annual prices (until #22)
  - "Full library access" on the mobile paywall (F-15)

## 6. External references

All accessed **2026-11-02**. "Version" is the revision or date shown on the page at access.

### 6.1 Law: primary sources read [V]

| Source | URL | Version shown |
|---|---|---|
| NY GBL §527-a (automatic renewal; unlawful practices) | https://www.nysenate.gov/legislation/laws/GBS/527-A | Revision from 2025-11-07 |
| NY GBL §527 (definitions) | https://www.nysenate.gov/legislation/laws/GBS/527 | Revision from 2025-11-07 |
| NY GBL §396-i (gift certificates) | https://www.nysenate.gov/legislation/laws/GBS/396-I | Revision from 2023-06-23 |
| NY GBL §899-bb (SHIELD Act, data security) | https://www.nysenate.gov/legislation/laws/GBS/899-BB | Revision from 2020-03-27 |
| NY GBL §899-aa (breach notification) | https://www.nysenate.gov/legislation/laws/GBS/899-AA | Revision from 2025-03-28 |
| 15 U.S.C. §8403 (ROSCA) | https://www.law.cornell.edu/uscode/text/15/8403 | No date shown (Pub. L. 111-345) |
| 17 U.S.C. §512 (DMCA safe harbours) | https://www.law.cornell.edu/uscode/text/17/512 | No date shown |
| 12 CFR §1005.20 (Regulation E, gift cards) | https://www.consumerfinance.gov/rules-policy/regulations/1005/20/ | "Current regulation"; text cut off after (b)(2), so later paragraphs come from a summary |

### 6.2 Competitor benchmarks

| Source | URL | Status |
|---|---|---|
| Google Play Terms of Service | https://play.google.com/about/play-terms/ | [V] Dated July 29, 2026; an update takes effect November 17, 2026 (not reviewed) |
| Google Play refund policies | https://support.google.com/googleplay/answer/2479637?hl=en | [V] No date shown |
| Google Play Books refunds | https://support.google.com/googleplay/answer/15575530 | [V] No date shown |
| Google Play apps and subscriptions refunds | https://support.google.com/googleplay/answer/15574908 | [V] No date shown |
| Google Play: cancel, pause or change a subscription | https://support.google.com/googleplay/answer/7018481?hl=en | [V] No date shown |
| Google Play developer policy: subscriptions | https://support.google.com/googleplay/android-developer/answer/9900533?hl=en | [V] Notes a change effective January 27, 2027 |
| Play Console: create and manage subscriptions | https://support.google.com/googleplay/android-developer/answer/140504 | [V] How-to article, not policy |
| Amazon Conditions of Use | https://www.amazon.com/gp/help/customer/display.html?nodeId=GLSBYFE9MGKKQXXM | **[S] Direct fetch returned HTTP 503**; search-index excerpts only |
| Kindle Store Terms of Use | https://www.amazon.com/gp/help/customer/display.html?nodeId=201014950 | **[S] HTTP 503**; search excerpt showed "last updated October 21, 2026" |
| Kindle Unlimited Terms of Use | https://www.amazon.com/gp/help/customer/display.html?nodeId=201556940 | **[S] HTTP 503** (the nodeId=201556910 tried first also failed) |
| Amazon gift card terms | https://www.amazon.com/gp/help/customer/display.html?nodeId=201936990 | **Not benchmarked: HTTP 503** |

No competitor legal text was copied. Benchmarks are paraphrased.

### 6.3 Secondary sources on regulatory status [S]

- FTC 2024 Negative Option ("click-to-cancel") Rule vacated by the Eighth Circuit, July 8, 2025 (*Custom Communications v. FTC*). Reports say a new rulemaking began in March 2026.
  - [Cooley](https://www.cooley.com/news/insight/2025/2025-07-11-click-to-cancel-just-got-cancelled-eighth-circuit-vacates-entirety-of-ftcs-negative-option-rule)
  - [Gibson Dunn](https://www.gibsondunn.com/ftc-restarts-negative-option-rulemaking-after-eighth-circuit-vacatur-enforcement-under-rosca-continues/)
  - [Jones Day](https://www.jonesday.com/en/insights/2026/05/ftc-revives-clicktocancel-rule-new-risks-for-subscription-businesses)
  - **Verify against the Federal Register.** ROSCA is unaffected.
- NY 2025 amendments to the automatic-renewal law (price increases, material changes), and pending bill S5615 (2025):
  - [Perkins Coie](https://perkinscoie.com/insights/update/new-york-and-colorado-update-auto-renewing-subscription-requirements)
  - [NY Senate S5615A](https://www.nysenate.gov/legislation/bills/2025/S5615/amendment/A)

### 6.4 International requirements needing jurisdiction-specific review [U]

- **EU and Spain:** GDPR (Art. 3(2) reach, Art. 27 EU representative); the 14-day withdrawal right and the consent needed to waive it for digital content; Spanish provider-information rules (LSSI); VAT on digital services.
- **United Kingdom:** consumer contract and digital content rules.
- **Latin America:** Mexico (LFPC / PROFECO), Colombia, Argentina (including its online "cancel button" requirement).
- **Other US states:** automatic-renewal laws, especially California; California's rule on "buy" wording for digital goods.
- **App stores:** Apple App Store and Google Play rules on buying outside the app.

## 7. Risks

| Level | Items |
|---|---|
| **Critical** | F-1 / row 11: account deletion doesn't cancel Stripe billing. F-2: library entries unlock any book permanently (revenue and author-payout integrity; security-relevant). |
| **High** | Row 1 provider identity · Row 2 governing law · Row 3 acceptance and consent · Row 4 changes and price increases · Row 6 auto-renewal disclosure · Row 7 confirmation · Row 8 trial (F-5, F-6) · Row 9 cancellation and annual token drip (F-4, F-7) · Row 10 annual renewal notice · Row 15 gifts · Row 16 content ownership and access model (F-3) · Row 20 copyright safe harbour · Row 17 Causas (Medium to High) |
| **Medium** | Row 5 prices (fix pending in #22) · Row 12 plan changes · Row 13 refunds (F-9) · Row 14 token types · Row 18 Family size · Row 19 age · Row 21 termination · Row 23 privacy framework · Row 24 privacy claims · Row 26 tax · Row 27 mobile purchases · F-15 mobile "Full library access" |
| **Low** | Row 22 liability exceptions · Row 25 cookie analytics wording · EN/ES naming inconsistencies |

Exposure note [Fact, from the PO's 2026-11-01 production audit]: 16 registered users, 0 subscriptions, 0 token purchases, 0 gifts. Stripe history verification is still pending. That makes current financial harm low, but the risks apply from the first subscriber.

## 8. Recommendations

None of these is approved. Each needs separate Product Owner authorization.

### 8.1 Required corrections: wording (Terms and policies)

1. **Provider identity:** legal name, "doing business as Noetia" status, postal contact address. (Rows 1, 23)
2. **Governing law and disputes:** New York, with a mandatory-law statement and a small-claims exception. (Row 2)
3. **Subscription section** matching NY 527-a and ROSCA: material terms; how the trial converts; renewal frequency; the cancellation path and deadline; access until the end of the period; notice of material changes and price increases (5 business days to 30 days; consent, or cancel within 14 days with a pro-rata refund); the annual renewal notice; correct plan table. (Rows 4–10, 12, 18)
4. **Acceptance and changes clause**, with an effective date alongside "last updated". (Rows 3, 4)
5. **Content licence and ownership:** the meaning of "permanent"; what happens if a book is withdrawn, on suspension and on deletion. (Row 16)
6. **Token and gift section:** every token type and its expiry, shared pools, gift terms once decided. (Rows 14, 15)
7. **Refunds:** keep statutory rights; request process; the policy once decided. (Row 13)
8. **Copyright complaints and repeat infringers.** (Row 20)
9. **Causas** reworded as Noetia's own commitment. (Row 17)
10. **Privacy Policy:** New York and US framework, SHIELD Act, retention and export claims that match the code. **Cookie Policy:** analytics wording. (Rows 23–25)
11. Remove "MVP — subject to legal review" only once items 1–10 are approved.

### 8.2 Required corrections: engineering

1. **Critical:** cancel the Stripe subscription when an account is deleted. (F-1)
2. **Critical:** allow `POST /library` only for free books, and have `SubscriptionGuard` count only `token`, `purchase` and `courtesy` entries as ownership. (F-2)
3. **High:** keep issuing annual tokens to the end of the paid term while `canceling` (F-4). Hold trial tokens until the first paid invoice and allow one trial per customer, pending decision (F-5, F-6).
4. **High:**
   - checkout disclosure block next to the button
   - Terms checkbox at sign-up and checkout, with version, time and method recorded
   - confirmation email after subscribing
   - annual renewal reminder 15–45 days ahead
   - in-app cancel button, or a verified portal setting (rows 3, 6, 7, 9, 10)
5. **Medium:**
   - refund and chargeback handlers (F-9)
   - age statement at sign-up
   - gift expiry changes once decided
   - privacy purge and export, or narrower claims
   - "plus tax" display or Stripe automatic tax
   - remove "Full library access" from the mobile paywall (F-15)

### 8.3 Optional improvements

- An EN/ES glossary for programme names ("Noetia Causes" / "Causas Noetia").
- Plain-language summary boxes above the Terms sections (as Google does) [Interpretation: helps make the material terms conspicuous].
- Pause instead of cancel for subscriptions (Kindle Unlimited and Google offer this) [S/V].
- A public page listing the current version and change history of each legal document.

## 9. Tests and verification performed

- **Repository review:** read the full published EN/ES legal documents on `origin/main` (`6a5e5c0`), plus the subscription, webhook, gift, library, guard, user-deletion, email and persona code and the web/mobile i18n listed in §5. Line numbers are from `main`.
- **Keyword searches** for consent collection, automatic tax, age checks, refund and dispute events, renewal reminders, data export, retention purges and analytics libraries. A result of "not found" is limited by the search terms used.
- **Primary-source fetches** succeeded for all [V] sources in §6.
- **Limitations and failures:**
  - **Amazon pages failed to load (HTTP 503)**, so Amazon benchmarks are search-index excerpts only.
  - Reg E §1005.20 was only partly fetched.
  - The current Google ToS (governing law and venue) was not fetched.
  - The FTC rule status relies on secondary sources.
- **Not done:**
  - no end-to-end runs
  - no Stripe test-mode checks (F-6 still to confirm)
  - no Stripe Dashboard or Billing Portal checks
  - no production or database queries
  - no unit tests run, since no code changed

## 10. Open questions and Product Owner decisions required

1. **Legal identity:** the name and address to publish; whether to file an assumed-name certificate or form an entity first.
2. **Disputes:** New York courts, or arbitration with or without a class waiver.
3. **Access model:** a subscription opens all books, or tokens only (NEM-013).
4. **"Permanent ownership":** what it means when a book is withdrawn, or an account is suspended or deleted.
5. **Trials:** one per customer? Tokens during the trial: none, one, or the full amount?
6. **Gifts:** treat as gift certificates (9-year minimum under §396-i), or redesign.
7. **Refund policy:** for example, a window for unused tokens.
8. **Family plan:** 4 or 5 members.
9. **Age:** 18+ only, or 13–17 with parental consent.
10. **Copyright agent:** who, and at what address.
11. **Causas:** whether the 2.22% can be stated as fact yet.
12. **PR #22:** ship the price-only correction now (date set on deploy day, PO authorization), or include it in the full revision.
13. **Target markets:** whether the EU and Latin America are targets now; this sets the scope of the §6.4 review.

**Also needed:**
- Confirm the Stripe Billing Portal settings for cancellation and plan changes, and whether Stripe receipt and renewal emails are enabled. (The PO has Dashboard access.)
- How to reconcile this protocol with the open governance proposal **PR #16** (`REPORTING-PROTOCOL.md` / `REGISTRY.md`). See `docs/reports/README.md`.

## 11. Changes made

- **No application code, legal documents, tests, configuration, production systems, Stripe or databases were changed.**
- PR #21 and PR #22 are untouched and still in Draft.
- This PR adds documentation only:
  - this report
  - `docs/reports/README.md` (reporting protocol and index)
  - a short pointer to the protocol in `CLAUDE.md`

## 12. Next recommended action

1. Product Owner reviews this report and records decisions on §10 items 1–13.
2. After those decisions, and only with explicit authorization, two separate missions:
   - (a) an **engineering mission for the two Critical defects** (F-1, F-2). These are independent of the wording decisions and could go first.
   - (b) a **Terms and Privacy revision mission**, drafting replacement wording against this matrix for internal benchmark approval.
3. Do not merge this PR, #21 or #22 without explicit Product Owner authorization.
