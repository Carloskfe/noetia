# NOF-004 — Terms of Service legal-review package

**Purpose:** give qualified counsel what they need to approve (or amend) the Terms of Service annual-price correction in PR B, and to advise on related gaps.
**Status:** prepared by engineering for review. **This document is not legal advice and records no legal approval.** Nothing here has been published.
**Prepared:** 2026-11-01 · **Change under review:** `services/web/lib/legal/terms-of-service.ts` (PR B)

---

## 1. The change requested for approval

Only the annual column of the plan table in §3 changes, in both languages. All other provisions are unchanged.

| Plan | Monthly (unchanged) | Annual — published today | Annual — proposed |
|---|---|---|---|
| Individual | $8.99 USD | $80.99 USD | **$83.99 USD** |
| Duo / Dúo (up to 2 members) | $13.99 USD | $125.99 USD | **$129.99 USD** |
| Family / Familia (up to 4 members) | $18.99 USD | $170.99 USD | **$179.99 USD** |

Spanish text uses a decimal comma (`$83,99 USD`, etc.).

Also in PR B (engineering, not substantive):
- The Terms get their own revision-date constant instead of sharing the Cookie Policy's date. The Cookie Policy date is unchanged.
- The "Last updated" line will show the **actual production publication date**. It's a placeholder until approval; the build's tests fail while it's unset.

**Why the correction is needed:** the approved prices (PO decision, NOF-003) are $83.99 / $129.99 / $179.99 per year. Since 2026-10-31, Noetia's pricing page has shown those amounts, and they're configured in Stripe. The published Terms understate them. Monthly prices already match.

## 2. Facts available to counsel

**Confirmed — production database, read-only audit by the PO, 2026-11-01:**

| Item | Count |
|---|---|
| Registered users | 16 |
| Registered since 2026-06-04 (date of the current Terms) | 4 |
| Subscription records, any status (incl. trial/canceled) | 0 |
| Token-package purchases | 0 |
| Gift cards | 0 |

Subscription records are never deleted when a subscription is canceled; only deleting the user account removes them.

**Preliminary — Stripe Dashboard observation, not verified:** no subscriptions and no payments shown. Live-mode confirmation and full transaction-history verification are **pending**, so the conclusion "no one was charged under the old annual figures" is provisional.

**Confirmed — code and documentation:**
- The Terms are headed "MVP Version — subject to legal review" in both languages.
- Governing law (§11): Spanish law, with jurisdiction in Spain unless the user's country of residence mandates otherwise.
- Users are **not** shown or asked to accept the Terms at registration (email, Google/Facebook sign-in, or mobile). No record of acceptance or version is kept. The Terms are linked from the site footer, a trust page and the sitemap.
- Stripe Checkout is not configured to collect Terms acceptance. Gift purchases can be made without an account.
- The Terms contain no clause on how they're amended or how users are notified.
- Provider identification: "Noetia is operated by Carloskfe" (Privacy Policy) and "Carloskfe / Noetia" (Terms). No legal name, address, tax ID or registry details appear.

## 3. Questions for counsel

### A. Annual-price correction (blocks PR B)
1. May the correction in §1 be published as shown?
2. Should it be treated as a correction of an error, or as an amendment to the Terms? Does that change anything in items B1–B4?
3. Is any wording beyond the price change required, such as a change note or a statement that prices shown at checkout prevail? Engineering won't draft legal provisions; please supply any required text.
4. Can the revision be published while the document still says "MVP Version — subject to legal review", or must that heading change first?

### B. Customer notice
1. Is notice to the **16 registered, non-paying users** required for this change? If so: by what method, how far in advance, and with what content?
2. Should the "effective date" differ from the publication date (e.g. a notice period)? The current document has only a "Last updated" date.
3. If the Stripe verification finds any subscription or payment at $83.99 / $129.99 / $179.99, what remedy applies (refund of the difference, notice, cancellation right)?
4. With no record of who accepted which version, is notice to all registered users the right approach?

### C. Provider identification
1. What provider and data-controller details must the Terms and Privacy Policy show for the target markets (legal name or business name, address, tax ID, registry details, contact)?
2. Is "Carloskfe" acceptable in the meantime, and does it affect whether PR B can be published?

### D. Acceptance and checkout disclosure gaps (affect future engineering work, not PR B itself unless counsel says otherwise)
1. Are the Terms enforceable without active acceptance? Is acceptance at registration required, including for Google/Facebook sign-ups and the 16 existing users?
2. What evidence of acceptance should be kept (user, document version, timestamp, method; IP or device?), for how long, and after account deletion?
3. Must Stripe Checkout require acceptance of the Terms, for subscriptions, token packs and gifts?
4. What must be shown before purchase: renewal price after the 14-day trial, automatic renewal, how to cancel, refund terms, a Terms link? Is an explicit waiver of the EU 14-day withdrawal right needed for digital content?
5. Are trial-ending or renewal reminders required in any target market?
6. Tax: VAT on digital services for EU consumers, and showing prices tax-inclusive or tax-exclusive.

### E. Other items noted, not part of PR B
- Family plan: the Terms say "up to 4 members"; the product allows 5 users. Policy decision pending.
- Gifts: the copy says "valid for 1 year"; tokens expire 90 days after the gift is claimed. Policy decision pending; 0 gifts sold.
- Refunds: "only for proven technical failure" and "no partial refunds", against consumer statutory rights.
- Cancellation: the Terms say "from your account settings"; the app sends users to the Stripe Billing Portal, whose settings aren't yet verified.
- Age 18+: stated in the Terms only; not confirmed at sign-up.
- Mobile app: the paywall links to web checkout (app-store rules).
- Jurisdictions to cover: Spain/EU, Latin America (Spanish-speaking target markets), United States (state auto-renewal laws), plus Apple and Google platform rules.

## 4. Approval needed before PR B can be published

PR B may be merged and deployed only after **all** of the following:
1. **Counsel approves the §1 correction** (A1), and supplies any additional wording required (A3).
2. **Counsel rules on notice** (B1–B2). If notice is required, it's sent, or scheduled as counsel directs, before or at publication.
3. **Counsel confirms** whether publication may proceed with the current heading (A4) and current provider identification (C2).
4. **The Product Owner authorizes the merge and deployment.**
5. **On deploy day,** the placeholder is replaced with the actual publication date.

Recommended but not blocking unless counsel says so: complete the Stripe live-mode and full-history verification first, so B3 can be answered definitively.

## 5. Evidence references

- Change: PR B diff (`terms-of-service.ts`, `terms-of-service.spec.ts`)
- Approved prices: NOF-003 (PR #19 audit, PR #20 deployed 2026-10-31)
- Gap analysis: NOF-004 audit and Terms-compliance review (2026-11-01)
- Registration: `services/api/src/auth/dto/register.dto.ts`, `services/api/src/auth/auth.service.ts`, `services/web/app/(auth)/register/page.tsx`, `services/mobile/src/screens/auth/RegisterScreen.tsx`
- Checkout: `services/api/src/subscriptions/subscriptions.service.ts` (`createCheckoutSession`), `services/api/src/gifts/gifts.service.ts`
- Legal documents: `services/web/lib/legal/{terms-of-service,privacy-policy,cookie-policy}.ts`
