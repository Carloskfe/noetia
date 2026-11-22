# Noetia — `@noetia.app` email addresses (admin register and pending tasks)

A durable register of every `@noetia.app` address that Noetia **publishes, sends from, or depends on**, and the admin work still needed to create or route each one.

- **Started:** 2026-11-22, at the Product Owner's request (PR #60 discussion, addendum F).
- **Source:** a repository scan of `main` at `8f2f294` (`git grep '@noetia.app'`), plus addresses decided in open design work.
- **Not verified:** whether each mailbox or alias already exists at the mail provider. There is no mail-provider access from the development environment. Every inbound address is marked **"verify"** until the PO confirms it.
- **Domain:** `noetia.app` on Cloudflare DNS; DKIM, SPF and DMARC are verified for sending through **Resend** (`smtp.resend.com:465`). Resend is the *sending* service. Receiving mail at an address needs a mailbox or forwarding (alias) at an inbound mail provider, which is a separate setup.

> **Rule:** do not commit personal addresses here. Record only role addresses and *where* a forward points ("Stripe refund owner", "founder"), never the private destination.

---

## How to use this list

1. **Create or confirm** each address at the mail provider (a mailbox, or an alias that forwards).
2. **Send a test message** to it from an outside account and confirm it arrives.
3. **Tick it off** here in a docs-only PR, with the date and who verified it (by role).
4. **Adding a new address to the product?** Add it here in the same PR.

---

## A. Pending tasks — new addresses to create

| # | Address | Purpose | Needed by | Routing | Status |
|---|---|---|---|---|---|
| A1 | `payments@noetia.app` *(proposed name; `ops@noetia.app` is the alternative; PO to confirm)* | **Payment escalation recipient (Q3 = option A).** Receives one internal alert per case per stage when a paid purchase is still unresolved 48 h after payment, or when a Stripe refund fails. It carries no customer personal data, only the Stripe session id. | Before **payment activation** (recommended launch prerequisite; PO to confirm) | Forward to whoever holds **Stripe Dashboard refund rights** *and* a Noetia admin account | [ ] **Pending:** create alias, set forwarding, test, then set `PAYMENT_ESCALATION_EMAIL` in `.env.production` on the server (only after the escalation code is implemented and authorized) |

Design reference: PR #60, PR60-I1-R2 §C5 and addenda E/F.

---

## B. Pending tasks — published inbound addresses to verify

These addresses are **shown to users today** (website, legal pages, store listings, emails). Each must actually receive mail. If one doesn't exist, users writing to it get a bounce, or silence.

| # | Address | Where it is published (on `main`) | Purpose | Priority | Status |
|---|---|---|---|---|---|
| B1 | `legal@noetia.app` | Privacy Policy (`services/web/lib/legal/privacy-policy.ts`: contact, GDPR rights, CCPA requests), Cookie Policy, Footer, `/contact`, `/trust`, App Store privacy label and Google Play data-safety docs (`docs/store-listings/`) | Legal, privacy and data-subject requests | **High.** Legal and store-compliance obligation; GDPR/CCPA requests must be answerable | [ ] Verify exists and is monitored |
| B2 | `hola@noetia.app` | Footer of transactional emails (`services/api/src/email/email.service.ts`: "Have questions? Write to us at …") | General customer support; customers reply here about payments, gifts and accounts | **High.** Every customer email points here, including the future payment-exception and gift notices | [ ] Verify exists and is monitored |
| B3 | `info@noetia.app` | Footer, `/contact` | General information | Medium | [ ] Verify |
| B4 | `autores@noetia.app` | `/contact`, author dashboard (`(admin)/author/page.tsx`), upload guide (web + `docs/upload-guide.md`), `docs/PRD.md` | Author onboarding and upload support | Medium–High (author supply chain) | [ ] Verify |
| B5 | `causas@noetia.app` | `/causas` page, `/contact`; Causas program terms draft | Causas Noetia (social giving) enquiries | Medium | [ ] Verify |
| B6 | `editorial@noetia.app` | `/contact` | Publishers: large catalogues, distribution agreements | Medium | [ ] Verify |
| B7 | `socios@noetia.app` | `/contact` | Strategic partners and integrations | Low–Medium | [ ] Verify |
| B8 | `prensa@noetia.app` | `/contact` | Press and media | Low–Medium | [ ] Verify |
| B9 | `equipo@noetia.app` | `/careers`, `/contact` | Careers and job applications | Low–Medium | [ ] Verify |

**Suggestion (PO decision):** fewer real mailboxes is easier to monitor. For example, B3, B6, B7, B8 and B9 can be aliases that forward to one shared inbox, while B1, B2 and B4 stay separately monitored. All of them still need to *receive*.

---

## C. Sending identities (no inbox required, but check them)

| # | Address | Used by | Notes | Status |
|---|---|---|---|---|
| C1 | `noreply@noetia.app` | `SMTP_FROM` for all API email (confirmation, password reset, gift cards, future payment and gift notices); `.env.example`, `CLAUDE.md` | Sends through Resend on the verified domain. Replies sent to it go nowhere. Consider a **Reply-To: `hola@noetia.app`** on customer emails so replies reach support *(engineering change; needs its own approval)* | [ ] Confirm sending works in prod; [ ] PO decision on Reply-To |
| C2 | `alerts@noetia.app` | Grafana SMTP sender (`docker-compose.server.yml` `GF_SMTP_FROM_ADDRESS`; `docs/grafana-monitoring.md`) | Send-only. Grafana alert *recipients* are currently a personal address (see `docs/grafana-monitoring.md`); consider moving them to a role address such as A1's or an `ops@` alias | [ ] PO decision: keep or move alert recipient to a role address |

---

## D. Change log

| Date | Change |
|---|---|
| 2026-11-22 | Register created: A1 (payment escalation, PO Q3 = option A), B1–B9 from a repository scan of `main` at `8f2f294`, C1–C2 sending identities. Mail-provider existence not verified. |
