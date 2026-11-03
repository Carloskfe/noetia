# NEM-016: SA-001 Stage 0, sharing security and integrity corrections

> Implementation report (agent reporting protocol). **Not merged, not deployed.** No production migration, production query, data change or clean-up has been run. Copyright, privacy and platform conclusions are internal assessments, not legal certification.

**Revision history**

| Rev | Date | Change |
|---|---|---|
| 1 | 2026-11-02 | Stage 0 implementation (S1, S2/C1, S3/G9, S8/S15, S12, S13, S14, G8, G10) |
| 2 | 2026-11-02 | **Independent-review follow-up (§13):** fail-closed renderer host validation with DNS and IP pinning; validator reconciled with the C1 policy; transactional lifecycle with an image-deletion outbox and retry sweep; migration 068 readiness assessment; read-only legacy-share audit tool; new finding S18 |

## 1. Mission and objective

Close the sharing defects documented in the SA-001 report (Draft PR #24) before any SA-001 feature work:
- S1, S2/C1, S3/G9, S8/S15, S12, S13, S14
- G8, G10

Rev 2 then addresses the independent review of Draft PR #25 within the same scope.

Mission record: `docs/engineering-missions/IN-PROGRESS/NEM-016-sa001-stage0-sharing-integrity.md`.

## 2. Date and status

- **Date:** 2026-11-02 (rev 2)
- **Branch:** `fix/nem-016-sa001-stage0-sharing-integrity`, from `origin/main` `6a5e5c0`
- **Status:** Draft PR #25, awaiting Product Architecture review and PO decisions
- **Merge readiness:** see §12

## 3. Scope and exclusions

**In scope:** §5 (rev 1) and §13 (rev 2).

**Excluded, not started:**
- the public book page
- new sharing UX
- the reflection-sharing experience
- the `[…]` source-range editor (design §5.10)
- the D06 rights policy
- analytics
- native links
- the auth throttling fixes (S16, S17)
- the `/align/chapters` hardening (S18)
- the **pending preview prompt** (§13.7)

## 4. Executive summary

- **All Stage 0 areas are implemented. Rev 2 confirmed every review concern and corrected it:**
  1. **Renderer allowlist.** It was fail-open when unset; it's now **fail-closed**. Built-in hosts are https-only and must resolve to public addresses. The connection is pinned to the checked IP and redirects are refused. The API and image-gen now read one variable with identical rules. All 18 presets still load.
  2. **Validator was more permissive than C1.** It folded case and punctuation and accepted bare `…` and `(…)` as omissions. Now only `[…]` marks an omission, and punctuation and case must match apart from narrow conventional exceptions. Each share stores its provenance (source spans). Omissions can't cross a negation or exception word, or more than 1,500 characters of source.
  3. **Best-effort cleanup could leave withdrawn images public indefinitely.** This is replaced by a **transactional outbox** plus a 10-minute retry sweep. Fragment and account deletion are now atomic.
  4. **Migration 068 assessment and a read-only legacy-share audit tool** were prepared. Neither was run in production.
- **Tests: all pass.**

  | Suite | Result |
  |---|---|
  | API | 1100 / 1100 (rev 1: 1056; pre-change baseline: 948) |
  | Web | 304 / 304 |
  | Mobile | 188 / 188 |
  | image-gen | 261 / 261, 94.6% coverage |

  Migration 068 was re-tested on local PG16 in a rolled-back transaction.
- **Merge recommendation: not yet. Conditionally ready** after the three gating steps in §12.

## 5. Verified findings and changes (rev 1, as amended by rev 2)

| # | Correction | Rev 2 status |
|---|---|---|
| 5.1 S1 | Only the fragment's owner may share it (404 otherwise; nothing rendered, counted or emitted) | unchanged |
| 5.2 S3/G9 | Revocation (`DELETE /shares/:id`, owner-only, idempotent). Fragment deletion revokes its shares. Account deletion hard-deletes the user's shares plus shares of the user's fragments made by others. Revoked shares are 404 publicly. | **Reworked:** transactional, outbox-backed (§13.3) |
| 5.3 G10 | Mobile "Open image" opens the PNG. Android puts the link in `message`; iOS passes `url`. Specific error copy. | Two omission messages added |
| 5.4 G8 | Config hash plus partial unique index: one live share per creator and card. Concurrent duplicates resolve to the winner and delete the orphan image. `shareCount` uses atomic increment. | unchanged |
| 5.5 S12 | API: inline raster data URI (≤ 8 M chars) or preset `/backgrounds/imagen-N.jpg`, N 1–18. image-gen: defence in depth. | **Hardened** (§13.1) |
| 5.6 S13 | Social publish requires an exact public card URL that matches the caller's live share. Bytes are read from storage; no HTTP fetch. Per-user rate limit. | unchanged |
| 5.7 S14 | A single quality-gate definition (`book-eligibility.ts`). Shares of ineligible books are refused (422); public share pages for them return 404. | unchanged |
| 5.8 S15/S8 | `ShareFragmentDto` limits. Per-user Redis limits: 20 renders and 10 publishes per 10 minutes. Fail-open on a Redis outage. | unchanged |
| 5.9 S2/C1 | Card text verified against the book source | **Reconciled with C1** (§13.2) |

### 5.10 Technical design: the `[…]` source-range editor (Stage 3, not implemented)

1. **Representation.** `sourceSpans jsonb` on `fragments`, captured from reader selection (phrase index plus offset); combine concatenates spans. Shares already store `quoteProvenance` since rev 2. `null` means legacy, verified by text as in Stage 0.
2. **Verification.** The server rebuilds the quote from spans. The quote part is never typed freely: the reader can only shorten a span or drop a middle range, and `[…]` is inserted automatically.
3. **Meaning safeguards beyond Stage 0:**
   - a publish preview that shows the omitted text (the **preview prompt**, §13.7)
   - a reader attestation for multi-span quotes
   - D06 per-title limits and the rights-holder removal path
4. **Previously edited fragments.** Never auto-overwritten. Reader-initiated "restore the author's wording" (fuzzy-locate the passage) and "keep my wording as a note".
5. **Migration:** additive, one column, no backfill.
6. **Estimate [A]:** 4–6 engineer-days.

### 5.11 Pre-existing findings, not fixed (out of scope)

| # | Finding | Evidence | Risk | Recommendation |
|---|---|---|---|---|
| S16 | Auth `@Throttle({ default: … })` limits are ignored: the only throttler is named `global`, and `@nestjs/throttler` 6.5 reads limits by name | `auth.controller.ts:65,215,225,235`; `app.module.ts:34-36` | High | Separate fix mission |
| S17 | No `trust proxy`, so behind Traefik all clients probably share one IP throttle bucket | no `trust proxy` in `src/` [V]; production effect [A] | Medium | Separate, infra-reviewed |
| **S18** *(new, rev 2)* | image-gen `GET /align/chapters?url=` passes any URL straight to `ffprobe`, which supports `file:` and other protocols. A value starting with `-` would be parsed as an option. The service is internal-only (no ports or Traefik route [V `docker-compose.server.yml`]) and called by ingestion with audio URLs. | `services/image-gen/app.py:30-47`; `alignment.service.ts:80-82` | Medium (requires internal network access or a crafted audio URL) | Separate fix: allow-list schemes and hosts, prefix `--`, or pass a local file |

## 6. External references

None new. Platform references are in the SA-001 report §6.

## 7. Risks (after rev 2)

| Level | Risk |
|---|---|
| High | **Legacy shares** created before this change stay public until the PO decides, after the read-only audit (§13.5). |
| Medium | **Deploy window.** CD starts the new containers before running migrations. Until 068 completes, endpoints touching `shares` fail (§13.4). |
| Medium | **Code-only rollback** after 068 would re-serve revoked shares (§13.4). |
| Medium | **Stricter C1 rules may refuse genuine quotes**, for example where the reader's selection differs from the stored source text. The specific messages guide the reader. The real refusal rate is unknown until production use; the audit (§13.5) gives a first measure on legacy shares. |
| Low | **Window before image deletion.** A withdrawn card image stays reachable at its unguessable URL until the immediate purge or the next sweep succeeds: normally seconds, at most about 10 minutes plus any storage outage. Copies already downloaded or cached by platforms can't be recalled (D07). |
| Low | **Staging presets.** Staging is behind basic auth, so presets requested with a `staging.noetia.app` URL would render the navy fallback. This is pre-existing; mobile uses `noetia.app` in production. |

## 8. Migration 068 and rollback

See §13.4 for the full production-readiness assessment.

## 9. Tests and verification

| Suite | Command | Result |
|---|---|---|
| API | `npx jest --coverage` | **76 suites, 1100 tests, all pass.** Statements 91.5%; `quote-integrity` 100%; `share-lifecycle` and `legacy-share-audit` fully covered. |
| API types and lint | `tsc --noEmit`; `eslint src/sharing …` | pass; 0 errors, 0 warnings |
| image-gen | `python3 -m pytest` | **261 pass, 94.6%** |
| Web | `npx jest`; `tsc` | **304 pass**; types pass |
| Mobile | `npx jest`; `tsc` | **188 pass**; types pass |
| Migration 068 | local PG16, one rolled-back transaction | up, idempotent re-up, outbox insert de-duplication, `lock_timeout` set, down refused with pending deletions, down refused with revoked shares, clean down, re-up; local DB unchanged |
| Audit CLI | run against the **local dev DB** (read-only) | completed; pre-068 path; output contained ids and counts only (local DB has 0 shares) |

**New negative security tests in rev 2:**

*image-gen*
- 17 rejected URLs, with no DNS lookup or connection
- 10 non-public resolutions: loopback, RFC 1918, link-local and metadata, CGNAT, unspecified, IPv6 loopback, ULA, link-local
- a mixed public and private DNS answer
- an unresolvable host
- DNS rebinding (the connection stays pinned to the first answer)
- 7 non-200 statuses including redirects
- oversized download
- an empty `SHARE_BG_ALLOWED_HOSTS` (4 forms)
- the legacy variable name ignored
- certificate verification on
- all 18 presets accepted

*API*
- built-in hosts https-only
- `WEB_URL` no longer widens the allowlist
- empty-variable cases

*Quote integrity (43 tests)*
- changed word, paraphrase, added "?" or "!", removed comma, mid-quote case change, partial words
- bare `…` treated as an omission, `(…)`, out of order, overlap, stitching
- negation removed (5 words), too-long omission
- choosing a later occurrence that avoids a negation
- the author's own ellipsis accepted

*Lifecycle*
- transaction ordering
- purge only after commit
- storage outage keeps the queue and records only the error class
- sweep retry and overdue alert
- no throws from the purge or the sweep

*Fragment and account deletion*
- rollback on share failure
- no purge or e-mail if the delete fails

**Limitations:**
- No end-to-end run against Docker: the local stack mounts the main checkout.
- No production data was examined.

## 10. Open questions and PO decisions

1. **Legacy shares.** Authorize running the read-only audit (§13.5) in production? Then decide per category: keep, revoke or delete. Changes are irreversible and need separate authorization.
2. **Orphan shares of deleted accounts.** Delete or keep, after the audit count.
3. **Rate limits:** 20 renders and 10 publishes per 10 minutes. Confirm.
4. **C1 thresholds:**
   - at least 3 words per passage with omissions
   - at most 6 passages
   - at most 1,500 characters omitted per gap
   - the ES/EN negation and exception list (§13.2)

   Confirm or adjust.
5. **Legacy combined fragments** (joined with ` … `) are now refused with "mark omissions with `[…]`". The alternative is accepting the legacy separator only for combined fragments created before this change; those can't currently be distinguished. Recommendation: keep it strict.
6. **Deploy approach** (§13.4): merge only after staging verification, in a quiet window, with no other deploy running.
7. **Separate missions** for S16, S17 and S18?
8. **Stage 3:** accept the §5.10 design, including the preview prompt (§13.7)?

## 11. Changes made

**Rev 1:** see §5 and the PR description.

**Rev 2**

*API*
- New:
  - `src/sharing/card-image-deletion.entity.ts`
  - `src/sharing/legacy-share-audit.ts`
  - `src/sharing/audit-legacy-shares.ts` (read-only CLI)
- Modified:
  - `src/sharing/{quote-integrity.service.ts, share-background.ts, share-lifecycle.service.ts, share-lifecycle.module.ts, share.entity.ts, sharing.service.ts}`
  - `src/fragments/fragments.service.ts`: transactional delete; combine joins with ` […] `
  - `src/users/users.service.ts`: transactional account deletion
  - `src/migrations/1748300000068-AddShareLifecycle.ts`: never deployed, so it was amended in place rather than with a corrective migration
- Tests: `quote-integrity`, `share-lifecycle`, `share-background`, `sharing.service`, `fragments.service`, `users.service` and the new `legacy-share-audit` spec

*image-gen*
- `templates/base.py`
- `tests/unit/templates/test_base.py`

*Web*
- `lib/share-utils.ts`
- `lib/i18n/{en,es}.ts` (two keys)
- `tests/unit/lib/share-utils.spec.ts`

*Mobile*
- `src/components/ShareSheet.tsx`
- `src/i18n/{en,es}.ts` (two keys)
- `tests/unit/components/ShareSheet.spec.ts`

*Docs*
- this report
- the mission record

**Not changed:** Stripe, entitlements, the reader, the sync pipeline, infrastructure, production, existing fragments or shares.

## 12. Merge-readiness recommendation and next action

**Code and tests:** ready for Product Architecture review.

**Not recommended to merge yet.** Merge after three gating steps:

1. **Run the read-only legacy audit (§13.5)** with explicit authorization. Its counts decide whether legacy shares must be handled before or right after the release; it also gives the table size for the lock assessment.
2. **Staging verification of the built images** (NEM-006A environment; requires authorization):
   - migration 068 applies
   - share, reuse and revoke work
   - a preset background renders through image-gen's DNS and IP check
   - fragment and account deletion clean up
   - the retry sweep drains the outbox
3. **PO acknowledgement of the deploy window and the roll-forward-only rule** (§13.4), and decisions §10 items 3–5.

When those are done: merge in a quiet window after `gh run list` shows no running deploy, then run the `CLAUDE.md` deployment verification and confirm 068 is applied.

---

## 13. Independent-review follow-up (rev 2)

### 13.1 Renderer host validation: CONFIRMED and corrected

**Confirmed issues (rev 1):**
- `_allowed_bg_hosts()` returned an empty set when `BG_IMAGE_ALLOWED_HOSTS` was unset, which meant **any** host was allowed (path-restricted only).
- No DNS or IP check: an allowed name resolving to a private address would be fetched.
- `http` was allowed for production hosts.
- The API auto-allowed the `WEB_URL` host over http.
- The API and image-gen used **different** variable names, a configuration-drift risk.

Redirects were already refused (confirmed) and still are.

**Corrections:**

*image-gen (`templates/base.py`)*
- Built-in hosts are `noetia.app` and `staging.noetia.app`, **https only**.
- Other hosts are allowed only through `SHARE_BG_ALLOWED_HOSTS`, the same variable as the API and read from the same `.env`. An empty or unset value adds nothing.
- Built-in hosts must resolve **only** to global addresses; any non-public address in the answer fails.
- The connection is **pinned** to the checked IP (custom `HTTPConnection`/`HTTPSConnection`; TLS is verified against the original hostname with SNI), which defeats DNS rebinding.
- `http.client` never follows redirects; any non-200 fails.
- 10 MB cap; 10-second timeout.
- Configured dev hosts may use http and private addresses, but only for the preset paths.

*API (`share-background.ts`)*
- Identical host rules: built-in https only, or a configured host.
- `WEB_URL` no longer widens the allowlist.

**Interaction.** The API is the first gate; it rejects with 400 before rendering. image-gen is defence in depth, enforced again at the network layer. image-gen is internal-only (no ports or Traefik [V]); the API is its only caller for cards.

**Compatibility:**
- Web sends presets as data URIs, with no fetch.
- Mobile sends `${WEB_URL}/backgrounds/imagen-N.jpg`, which in production is `https://noetia.app/...`. That's accepted, and all 18 are tested.
- **Local mobile development** must set `SHARE_BG_ALLOWED_HOSTS=<lan-ip>`.
- **Never set this variable in production.** It relaxes the public-address check for the listed hosts.

### 13.2 Quotation integrity vs the C1 policy: CONFIRMED more permissive, and corrected

| Rev 1 behaviour | Why it exceeded C1 | Rev 2 |
|---|---|---|
| Case-folded and punctuation-stripped comparison | Allowed changed punctuation ("right" → "right?") and capitalization, i.e. altered wording | Only typographic variants are folded (quote and dash styles, `...`/`…`, spacing, soft hyphen). Words, punctuation and case must match. Conventional exceptions apply only at passage edges: wrapping quotes or truncation `…`, an added closing `.`, the first letter's case. |
| `…`, `...`, `(…)`, `[...]`, `[…]` all accepted as omission markers | The approved marker is `[…]` | Only `[…]` (typed `[...]` is accepted and **rendered** as `[…]`; the stored fragment is untouched). A bare `…` is valid only where the author wrote it. Fixed a rev 1 false rejection: an author's own `…` used to be split as an omission. |
| Order checked, positions discarded | No traceability | Each new share stores `quoteProvenance`: source kind, sha256 of the normalized source, matched spans |
| No meaning safeguard beyond 3 words per passage | "Must not materially distort meaning" | A gap may not exceed 1,500 source characters or contain a negation or exception (ES/EN: not, no, never, nor, neither, without, except, unless, cannot, any `n't`; nunca, jamás, ni, tampoco, sin, excepto, salvo, nadie, nada, ninguno/a, ningún). The search backtracks to an occurrence whose gap is clean. |
| Combine joined fragments with ` … ` | An unapproved marker | New combines join with ` […] `. **Existing combined fragments are not modified.** Sharing one gets "mark omissions with `[…]`" (reason `omission_marker_required`). |

**Stage 0 vs the source-range editor.** Stage 0 can verify wording, order, traceability and the mechanical meaning safeguards. Judging meaning distortion in general needs the §5.10 editor and its preview and attestation. Reader reflections stay separate and editable (`note`, `PATCH /fragments/:id` unchanged), and card customization is unchanged.

### 13.3 Share lifecycle: CONFIRMED gaps, corrected

**Confirmed issues (rev 1):**
- Card images live in the anonymous-download `images/` bucket. It isn't listable (`mc anonymous set download` [V `infra/minio/buckets.sh:40`]), but any URL already shared stays fetchable.
- Rev 1 cleanup was best-effort with **no retry**. A storage failure on revocation left the image public indefinitely.
- On account deletion, the share rows, which held the only record of the URLs, were already gone.
- Fragment deletion (revoke, then delete) and account deletion (a sequence of deletes) weren't atomic, a pre-existing issue.

**Correction: a transactional outbox, within the existing architecture** (Postgres, `@nestjs/schedule`, MinIO).

| Path | Rev 2 behaviour |
|---|---|
| Revocation | One transaction: set `revokedAt` and insert the image key into `card_image_deletions` |
| Fragment deletion | One transaction: revoke shares, queue keys, delete the fragment |
| Account deletion | **One transaction** for all of it: the existing deletes, the share delete plus queued keys, the user row |
| After commit | `purgeImages` deletes each object (MinIO delete is idempotent). Success clears the outbox row; failure records the attempt and the error **class**. It never throws. |
| `@Cron` every 10 minutes | Retries the 100 oldest queued keys. Rows with 12 or more attempts are logged at error level. |

**Guarantees and limits:**
- The database is authoritative: a revoked or deleted share is never served again, even while its image deletion is pending.
- A queued image is retried until deleted.
- The outbox holds only random object keys, no personal data.
- A crash between commit and purge is covered by the sweep.
- **Out of Noetia's control (D07):** downloads, platform caches (for example Facebook caches OG images by URL), and posts already published.
- Cloudflare is DNS-only, so there's no CDN copy [V `CLAUDE.md`].

### 13.4 Migration 068: production-readiness assessment (not executed)

**Contents.** Additive only:
- `shares`: `revokedAt`, `configHash`, `quoteProvenance` (all nullable, no default)
- the index `IDX_shares_createdById`
- the partial unique index `UQ_shares_creator_config_live`
- the table `card_image_deletions`

It was amended in place because it has never been deployed (golden rule respected).

**Execution and locking**
- The TypeORM CLI runs pending migrations in a single transaction (default `all`), so 068 applies completely or not at all.
- `SET LOCAL lock_timeout = '10s'`: it fails fast instead of queueing behind long queries and stalling traffic.
- `ADD COLUMN` (nullable) is catalog-only. Index builds hold a SHARE lock on `shares` (writes wait) for the build. The table size is unknown and the audit reports it [A]; locally it's 0 rows.
- No `CONCURRENTLY`, which can't run inside the migration transaction.

**Existing share records**
- Untouched: `configHash`, `quoteProvenance` and `revokedAt` are `NULL`.
- Legacy shares are never de-duplicated against new ones, and stay public until the PO decides on the audit (§13.5).

**Deploy sequencing (verified CD order:** build → `up -d --wait` → `migration:run`, `.github/workflows/cd.yml:41-50`)
- New containers serve **before** 068 is applied. For that interval, typically seconds, endpoints that select `shares` fail with 500: share, public share page, revoke, fragment delete, account delete, social publish.
- Account and fragment deletion fail closed: the transaction rolls back and nothing is half-deleted.
- **If the migration fails** (for example on `lock_timeout`), CD fails with the new code live. Recovery:
  - (a) re-run the migration (`migration:run:prod`) once the blocking query clears, or
  - (b) redeploy the previous commit. That's safe *at that moment*, because no revocations can exist yet.

**Rollback sequencing (after 068 applied and the new code in use)**
- **Code-only rollback is unsafe once any share is revoked:** the old code ignores `revokedAt` and would re-serve the quote text, and nothing would drain the outbox.
- Rule: **roll forward.** If a rollback is unavoidable:
  1. stop sharing traffic, or accept the exposure
  2. the PO decides whether to hard-delete revoked shares (irreversible)
  3. drain the outbox
  4. only then roll back the code
- **Database rollback:** `down` refuses while revoked shares or queued deletions exist, so it can't silently re-publish withdrawn content or forget public images.

**Revoked-share privacy guarantee.** With 068 and this code, a revoked share is 404 on every Noetia surface immediately on commit, and its image is deleted or queued. The guarantee holds only while this code version, or a later one, is running.

**Recommended:**
- Staging first.
- A verified database backup before the deploy. The offsite backup timer exists; an extra snapshot isn't required for an additive migration.
- No other deploy running.
- Run the post-deploy checks in `CLAUDE.md`.

### 13.5 Legacy-share audit: read-only procedure (not executed)

**Tool:**
- `services/api/src/sharing/legacy-share-audit.ts` (logic, unit-tested)
- `src/sharing/audit-legacy-shares.ts` (CLI)

It runs every query inside `START TRANSACTION READ ONLY` with a 60-second statement timeout, then `ROLLBACK`. It prints **share ids and counts only**: no quote text, names or e-mails. It works before or after 068.

| Check | Rule |
|---|---|
| A. Created by someone other than the fragment owner | `shares` ⋈ `fragments` where `createdById IS DISTINCT FROM fragments.userId` (plus, for information, shares whose source fragment no longer exists) |
| B. Author-attributed quote fails C1 | Each live share's `quote` is checked with the same validator against the book source. Results come with failure reasons; books whose source can't be loaded are reported as *unverifiable*. |
| C. Orphan shares of deleted accounts | `createdById` is NULL or has no `users` row |
| D. Ineligible books | No published book passing the shared quality gate |

**Procedure (each step needs PO authorization before production):**
1. Inside the production api container: `node dist/sharing/audit-legacy-shares.js > /root/nem016-audit-<date>.json`. This is a single-line command, per the `CLAUDE.md` SSH rule.
2. Copy the report off the server. Don't commit it: share ids are pseudonymous but operational.
3. Review the counts with the PO and decide per category. Any revocation or deletion is a separate, explicitly authorized and irreversible step.

Validated locally against the dev DB (0 shares).

### 13.6 Findings summary

| Review item | Verdict |
|---|---|
| Fail-open renderer allowlist | **Confirmed**, corrected |
| Redirects | **Disproved**: already refused in rev 1, and still refused |
| DNS, local network and rebinding | **Confirmed** gap, corrected (public-only, pinned) |
| Environment configuration drift (two variable names, `WEB_URL` widening) | **Confirmed**, corrected |
| Validator more permissive than C1 | **Confirmed** (5 points, §13.2), corrected |
| Withdrawn images could stay public | **Confirmed**, corrected (outbox and retry); residual limits documented |
| Transaction boundaries | **Confirmed** non-atomic, corrected |
| Migration readiness | Assessed (§13.4). New: the deploy-window and roll-forward constraints. |
| Additional finding | **S18** (§5.11) |

### 13.7 Outstanding workflow item: pending preview prompt

**Preserved, not addressed in this follow-up.** This is the planned publish-preview prompt: before publishing a quote with omissions, show the reader the omitted text and ask them to confirm. It's part of the Stage 3 source-range editor (§5.10, item 3) and remains an open item for PO scheduling.
