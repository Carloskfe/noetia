# NOETIA ENGINEERING MISSION — NEM-020 (DRAFT)
## Pre-Launch Billing and Commercial Data Inventory (Read-Only)

> **SA-003 Annex A.** Prepared under the Product Owner direction of 2026-11-07, *SA-003 Revisions and NEM-020 Preparation*.
> - Staged here as an annex of the SA-003 report. Its canonical location, `docs/engineering-missions/DRAFT/NEM-020-pre-launch-billing-data-inventory.md`, awaits Product Owner authorization.
> - **Status: DRAFT.** Not approved, not executable.
> - **APPROVED ≠ EXECUTE.** Execution requires an explicit Product Owner instruction naming NEM-020.

| | |
|---|---|
| **Mission type** | VERIFICATION (read-only) |
| **Identifier** | `NEM-020`, proposed. It is unused on every branch checked on 2026-11-07; NEM-019 (draft, PR #35) is the highest |
| **Implementation authorization** | NONE. No code, schema, migration, Stripe, infrastructure, or deployment change |
| **Data access** | Read-only production and staging database counts; read-only Stripe information (operator-performed) |
| **Product Owner approval** | REQUIRED, plus the access approvals in §3 |

---

## 1. Context

Noetia is pre-launch, with no paying subscribers and no active paid subscriptions (Product Owner, 2026-11-07). SA-003 Rev 5 recommends a unified billing rebuild on new tables (draft ADR-007, SA-003 Annex B).

Production must **not** be assumed empty:
- Real accounts exist.
- `user_books`, `token_ledger`, and `gift_cards` may hold rows.
- Release A was validated with a Stripe test key, so test-mode objects exist in at least one Stripe account (PR #14).
- The production Stripe key mode cannot be determined from source code (`docs/production-safety/02-stripe-mode-verification.md`).

## 2. Objective

Produce an aggregate-only inventory of billing and commercial data and Stripe objects, by mode, so that ADR-007, NEM-021, and NEM-022 can decide what to **preserve, migrate, archive, or retire**, without writing anything.

## 3. Dependencies

**Required before execution:**
1. Product Owner approval of this mission and an explicit execution instruction.
2. Authorization for read-only production database access: an operator runs the queries, or a dedicated read-only role is used. **No write-capable session.**
3. An operator with Stripe Dashboard access, or a **restricted read-only key** created by the operator. Claude has no Stripe access and must never receive a secret.
4. Authorization for a documentation-only branch and Draft PR for the completion report, or delivery in the response under `docs/reports/README.md` §5.2.

**Not required:** NEM-019, ADR-007 acceptance, staging isolation (no traffic is generated), or code changes.

## 4. Source-of-truth references

SA-003 report (Rev 3 §7.B and §16, Rev 5) · draft ADR-007 (Annex B) · `docs/production-safety/02-stripe-mode-verification.md` · `docs/reports/README.md` · CLAUDE.md §Development Safety Rules and §Critical server operations · PO-021, PO-024 (token rights) · migrations `000`–`067`.

## 5. In scope

1. **Stripe mode by key prefix** (doc 02 §A): prints only the word `live` or `test`, never the key.
2. **Production database aggregate counts** (§9.1).
3. **Staging database aggregate counts:** the same queries, if a staging database exists.
4. **Stripe aggregate counts per mode** (§9.2), performed by the operator.
5. **Treatment matrix:** a recommended keep, migrate, archive, or retire for each legacy object (§9.3).
6. **Completion report** under the reporting protocol.

## 6. Out of scope

- Any `INSERT`, `UPDATE`, `DELETE`, DDL, migration, backfill, or `VACUUM`/`ANALYZE`.
- Any Stripe create, update, cancel, refund, or webhook change, including enabling or disabling an endpoint.
- Exporting rows, emails, names, Stripe customer or subscription IDs, or any other identifier.
- Changes to application code, environment files, or containers.
- Deciding retirement (the matrix is a recommendation).

## 7. Product rules

- Book ownership (`user_books`) and already-issued token rights are **preserved** (PO-021, PO-024). The inventory never proposes deleting them; it only sizes them.
- No price, plan, or product decision is made by this mission.

## 8. Protected systems

Production database (read-only), reader / Escucha Activa, ownership, token ledger, Stripe, infrastructure. **Nothing is restarted or reconfigured.**

## 9. Technical requirements

### 9.1 Approved database queries (aggregate only)

All queries run in one session inside `BEGIN TRANSACTION READ ONLY; … ROLLBACK;`. They return counts and enumerations only; no row identifiers.

They run from a script delivered as a single-line base64 payload, or edited with `nano`. **Never by pasting multi-line text into the SSH terminal** (CLAUDE.md, the 2026-05-12 outage).

```sql
BEGIN TRANSACTION READ ONLY;

-- Q1 plans: legacy catalogue shape (names and amounts are not personal data)
SELECT name, interval, "amountCents", "maxProfiles", "tokensPerCycle",
       CASE WHEN "stripePriceId" LIKE 'price_%' AND "stripePriceId" NOT LIKE '%placeholder%'
                 AND "stripePriceId" <> 'price_changeme' THEN 'looks_real'
            WHEN "stripePriceId" IS NULL OR "stripePriceId" = '' THEN 'empty'
            ELSE 'placeholder' END AS price_id_state
FROM plans ORDER BY name, interval;

-- Q2 subscriptions by status, and how many reference a Stripe subscription
SELECT status, COUNT(*) AS rows,
       COUNT("stripeSubscriptionId") AS with_stripe_sub,
       COUNT(*) FILTER (WHERE cardinality("linkedUserIds") > 0) AS with_linked_members
FROM subscriptions GROUP BY status ORDER BY status;

-- Q3 subscriptions by plan (via plan name; no user data)
SELECT p.name, p.interval, s.status, COUNT(*) FROM subscriptions s
LEFT JOIN plans p ON p.id = s."planId" GROUP BY 1,2,3 ORDER BY 1,2,3;

-- Q4 users holding a Stripe customer reference
SELECT COUNT(*) FILTER (WHERE "stripeCustomerId" IS NOT NULL) AS with_stripe_customer,
       COUNT(*) AS total_users FROM users;

-- Q5 token ledger by type and status (expired vs active as stored, plus active-but-past-expiry)
SELECT type, status, COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE status = 'active' AND "expiresAt" < now()) AS active_past_expiry,
       MIN("issuedAt")::date AS first_issued, MAX("issuedAt")::date AS last_issued
FROM token_ledger GROUP BY type, status ORDER BY type, status;

-- Q6 ownership by acquisition type (preservation sizing; includes legacy title purchases)
SELECT "purchaseType", COUNT(*) AS rows, COUNT(DISTINCT "userId") AS users
FROM user_books GROUP BY "purchaseType" ORDER BY 1;

-- Q7 token packages (catalogue shape)
SELECT name, "tokenCount", "amountCents", active,
       CASE WHEN "stripePriceId" LIKE 'price_token_%' OR "stripePriceId" = '' THEN 'placeholder'
            ELSE 'looks_real' END AS price_id_state
FROM token_packages ORDER BY "tokenCount";

-- Q8 gift cards by status
SELECT status, "tokenCount", COUNT(*) FROM gift_cards GROUP BY 1,2 ORDER BY 1,2;

-- Q9 processed Stripe events by type (evidence of webhook traffic, and its age)
SELECT type, COUNT(*), MIN("processedAt")::date, MAX("processedAt")::date
FROM stripe_processed_events GROUP BY type ORDER BY type;

-- Q10 household invites and courtesy quotas
SELECT status, COUNT(*) FROM subscription_invites GROUP BY status ORDER BY status;
SELECT role, COUNT(*), SUM("issuedCount") AS issued, SUM("maxQuota") AS max_quota
FROM courtesy_token_quotas GROUP BY role ORDER BY role;

-- Q11 migration head (confirms the schema the counts refer to)
SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 3;

ROLLBACK;
```

**Privacy rule.** If a count is **below 5**, report it as `<5`, except counts that are expected to be 0 (Q2 `with_stripe_sub`, Q4, Q9 live-mode evidence), where the exact 0 or non-zero is the finding.

### 9.2 Stripe information (operator-performed, per mode, counts only)

| # | Item | Where |
|---|---|---|
| S1 | Production key mode (prefix word only) and webhook secret present (yes/no) | doc 02 §A |
| S2 | Webhook endpoints: count, URL host only (`noetia.app` / `staging…`), **API version**, enabled events count, mode | Dashboard → Developers → Webhooks |
| S3 | Products and prices: counts, active/archived, recurring vs one-time, currency | Dashboard → Product catalog |
| S4 | Customers: count | Dashboard → Customers |
| S5 | Subscriptions by status (`active`, `trialing`, `past_due`, `canceled`, other) | Dashboard → Subscriptions |
| S6 | Payments: count of succeeded charges, and whether any is live-mode; refunds and disputes count | Dashboard → Payments |
| S7 | Customer Portal: enabled? which features (cancel, plan switch) | Dashboard → Settings → Billing → Customer portal |
| S8 | Account default API version | Dashboard → Developers |

Each item is recorded for **test mode and live mode separately**. No IDs, names, emails, or amounts per customer.

### 9.3 Treatment matrix (output; recommendation only)

| Object | Inventory facts | Recommended treatment | Rationale |
|---|---|---|---|
| `plans` rows | Q1 | e.g. retire after the catalog exists; keep rows while referenced | — |
| `subscriptions` rows | Q2, Q3 | e.g. archive test/dev rows; migrate nothing billable if S5 live = 0 | — |
| `token_ledger` | Q5 | **Preserve** | PO-024 |
| `user_books` | Q6 | **Preserve**. Legacy `purchase` and bypass rows go to the PO (Q1 of Rev 5) | PO-021 |
| … | … | … | … |

## 10. Security / privacy / copyright

- No secrets in chat, logs, reports, or commits (doc 02 "What NOT to do").
- Aggregates only, with small-count suppression (§9.1).
- A read-only transaction plus a read-only role where possible.
- The operator performs the Stripe steps. If a restricted key is used, it is read-only, created for this mission, and **revoked afterwards**. The key never leaves the operator.

## 11. Acceptance criteria

1. Every Q1–Q11 and S1–S8 item has a result or an explicit "not accessible: <reason>".
2. Doc 02's decision-matrix verdict is recorded (live/live/live · test/test/test · mismatch).
3. **No write occurred.** Evidence: every query ran inside `READ ONLY` and ended in `ROLLBACK`; no Stripe write action was taken (operator attestation).
4. No personal data, identifiers, or secrets appear in any output.
5. The §9.3 treatment matrix is complete and labelled as a recommendation.
6. Any finding that contradicts the pre-launch premise (for example a live-mode active subscription or a live charge) is **escalated to the Product Owner immediately** and work stops.
7. The completion report follows `docs/reports/README.md`.

## 12. Required tests

No code is written, so there are no unit tests. **Validation instead:**
- **V-1:** the Q1–Q11 SQL is reviewed by Product Architecture before execution, and run first against a disposable local database with the current migrations (`000`–`067`) to prove it is syntactically valid and read-only.
- **V-2:** counts are run twice in the same session and must match.
- **V-3:** Q11 confirms the migration head matches the expected schema.
- **V-4:** a negative check: an `INSERT` attempted inside the `READ ONLY` transaction on the disposable database fails.

## 13. Observability

None added. Execution must not create load: aggregate queries on small tables only.

## 14. Deployment / rollout

None.

## 15. Documentation deliverables

- Completion report `docs/reports/YYYY-MM-DD-NEM-020-pre-launch-billing-inventory.md`, plus its index row.
- Updates to SA-003 / ADR-007 inputs only if authorized.

## 16. Open decisions

- Read-only role vs operator-run session.
- Restricted Stripe key vs dashboard-only reads.
- Whether staging is included.
- The small-count threshold (5 proposed).

## 17. Stop conditions

Stop and notify the Product Owner if:
- any step would require a write;
- a secret would be displayed;
- live-mode active subscriptions or live charges are found;
- the migration head differs from expectation;
- multi-line pasting over SSH would be required.

## 18. Completion report

Per `docs/reports/README.md` §4.1 and the engineering-missions completion standard.

## 19. Product Architecture review

Required before acceptance (`REVIEW-CHECKLIST.md`).
