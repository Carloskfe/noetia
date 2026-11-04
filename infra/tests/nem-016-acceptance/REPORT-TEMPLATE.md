# NEM-016 acceptance report (template)

| Field | Value |
|---|---|
| Target | ____ |
| Deployed commit | ____ |
| Run ID | ____ |
| Generated | ____ |
| Operator | ____ |
| Product Owner authorization (reference) | ____ |
| Approved disruptive tests | ____ |

## Verdict: ____

| PASS | FAIL | BLOCKED | NOT RUN |
|---|---|---|---|
| 0 | 0 | 0 | 31 |

## Classification

| Status | Meaning |
|---|---|
| **PASS** | Executed; the expected result was observed |
| **FAIL** | Executed; the result differed from what was expected |
| **BLOCKED** | Can't be executed yet: approval or a prerequisite is missing, or the sequence can no longer be replayed |
| **NOT RUN** | Could be executed but hasn't been, or the result was inconclusive |

A test's status comes from its checks: any FAIL makes it FAIL, otherwise any BLOCKED makes it BLOCKED, otherwise any NOT RUN makes it NOT RUN. It's PASS only if every check passed.

The verdict is **ACCEPTED** only if every required test passed. It's **REJECTED** if any test failed, including an optional one. Anything else is **INCOMPLETE**. Optional tests (A8b, A14b) and local-only evidence (X7) can't produce ACCEPTED.

## Summary

| Test | Area | Requirement | Status |
|---|---|---|---|
| A1 | Cross-user authorization | S1 | NOT RUN |
| A2 | Faithful quotation | S2, C1 | NOT RUN |
| A3 | Faithful quotation (negative) | S2, C1 | NOT RUN |
| A4 | Internal omissions | C1 | NOT RUN |
| A5 | Internal omissions (negative) | C1 | NOT RUN |
| A6 | Background security | S12, D09 | NOT RUN |
| A7 | Background security (negative) | S12 | NOT RUN |
| A8 | Social publish restrictions | S13 | NOT RUN |
| A8b | Social publish restrictions (optional) | S13 | NOT RUN |
| A9 | Duplicate prevention | G8 | NOT RUN |
| A10 | Revocation and image deletion | S3, G9, D07 | NOT RUN |
| A11 | Deletion retry | S3, G9 | NOT RUN |
| A12 | Fragment and account deletion | S3, G9 | NOT RUN |
| A13 | Migration compatibility | 068 | NOT RUN |
| A14 | Book eligibility | S14 | NOT RUN |
| A14b | Book eligibility (optional, end of run) | S14 | NOT RUN |
| A15 | Rate limiting | S8, S15 | NOT RUN |
| A16 | Mobile | G10 | NOT RUN |
| A17 | Reader content preserved | Protected: reader | NOT RUN |
| A18 | Legacy audit rehearsal | S14, C1 | NOT RUN |
| A19 | Real seeded book | C1, S14 | NOT RUN |
| A20 | Protected reader | Protected: reader, Escucha Activa | NOT RUN |
| X1 | Request limits | S15 | NOT RUN |
| X2 | Authentication required | S1, S3 | NOT RUN |
| X3 | Public share data | S14 | NOT RUN |
| X4 | Concurrent duplicates | G8 | NOT RUN |
| X5 | Revocation lifecycle | S3, D07 | NOT RUN |
| X6 | Existing books untouched | PO constraint | NOT RUN |
| X8 | Stalled storage is bounded (F1) | F1, S3, G9 | NOT RUN |
| X9 | Book deletion withdraws shares (F2) | F2, S3, S14, D07 | NOT RUN |
| X7 | Old app on the 068 schema (local only) | 068 | NOT RUN |

## Checks

| Check | Kind | Expected | Status | Evidence |
|---|---|---|---|---|
| A1.api | api | B's POST /fragments/<A's fragment>/share returns 404 | NOT RUN |  |
| A1.db | db | No share row exists for that fragment created by B | NOT RUN |  |
| A1.log | operator | image-gen logs show no render for the refused request | NOT RUN |  |
| A2.api | api | Q1, Q2, Q3 return 200; page URL and PNG resolve; the snapshot holds the quote | NOT RUN |  |
| A2.db | db | quoteProvenance set: source text_file, sha256, expected span counts | NOT RUN |  |
| A2.card | manual | The rendered card shows the quoted text | NOT RUN |  |
| A3.api | api | N1, N2, N3 return 422 quote_not_in_source / not_in_source | NOT RUN |  |
| A3.db | db | No share row was created by a refused request | NOT RUN |  |
| A3.web | manual | The web modal shows "doesn't match the book's wording" | NOT RUN |  |
| A4.api | api | Q4, Q5, Q6 return 200; Q5 stored as […]; Q4 and Q5 give the same /s/<id> | NOT RUN |  |
| A4.db | db | Q4 and Q6 provenance have 2 spans | NOT RUN |  |
| A4.card | manual | Q5's rendered card shows […] | NOT RUN |  |
| A5.api | api | N4–N9 return 422 with the §15.2 reasons | NOT RUN |  |
| A5.db | db | No share row was created by a refused request | NOT RUN |  |
| A5.client | manual | Web and mobile show the omission-specific messages | NOT RUN |  |
| A6.api | api | A data URI and a preset URL both return 200 with a PNG | NOT RUN |  |
| A6.card | manual | The chosen background is used (not the navy fallback) and the watermark is unchanged | NOT RUN |  |
| A7.api | api | All 6 unsafe backgrounds return 400 unsupported_background_image | NOT RUN |  |
| A7.db | db | No share row was created by a refused request | NOT RUN |  |
| A7.log | operator | image-gen logs show no fetch or render for those requests | NOT RUN |  |
| A8.api | api | Publishing without a connected account returns 401 account_not_connected | NOT RUN |  |
| A8b.api | api | Other-host and internal URLs return 400 untrusted_image_source; B's card and a revoked card return 404 share_not_found | NOT RUN |  |
| A9.api | api | Three identical requests return the same URL | NOT RUN |  |
| A9.db | db | Exactly one live row for that configuration; the fixture's shareCount matches the shares created | NOT RUN |  |
| A9.client | manual | Web Download, Copy link and Publish on one card give the same /s/<id> | NOT RUN |  |
| A10.api | api | B's revoke returns 404 and the share stays live; A's returns 204; share and image then return 404 | NOT RUN |  |
| A10.db | db | revokedAt set; no outbox row for that image | NOT RUN |  |
| A11.prepare | api | A live share exists before storage is interrupted | NOT RUN |  |
| A11.paused | api | With storage interrupted, revocation completes and the share returns 404 | NOT RUN |  |
| A11.outbox | db | While interrupted: an outbox row with attempts ≥ 1 and lastError set to a class name | NOT RUN |  |
| A11.after | api | After the sweep (≤ 10 min): the image returns 404 | NOT RUN |  |
| A11.drained | db | After the sweep: the outbox row is gone | NOT RUN |  |
| A12.fragment | api | Deleting a fragment with 2 shares returns 204; both shares and images return 404 | NOT RUN |  |
| A12.fragment.db | db | Those shares are revoked and no outbox row remains | NOT RUN |  |
| A12.account | api | Deleting account D returns 204; its share and image return 404; login fails | NOT RUN |  |
| A12.account.db | db | D's user, fragment and share rows are gone | NOT RUN |  |
| A12.mail | operator | No farewell e-mail was delivered (SMTP_HOST empty, gate G4) | NOT RUN |  |
| A13.sequence | operator | The old app worked on the 068 schema during the deploy (only from evidence captured at the time) | NOT RUN |  |
| A13.schema | db | 068 is the latest migration; 3 columns, the outbox table and both indexes exist | NOT RUN |  |
| A14.api | api | Sharing a fragment of an ingested book below the gate returns 422 book_not_shareable | NOT RUN |  |
| A14b.api | api | After the admin deletes the fixture, an existing share's API page and card image return 404 | NOT RUN |  |
| A14b.web | manual | The /s/<id> web page shows "not found" | NOT RUN |  |
| A15.api | api | The first 20 distinct cards return 200; the 21st returns 429 rate_limited; repeating an existing card still returns 200 | NOT RUN |  |
| A15.db | db | Exactly 20 live shares for account R | NOT RUN |  |
| A16.android | manual | Android: "Open image" opens the PNG; the share message has text and the /s/ link; refusal messages appear | NOT RUN |  |
| A16.ios | manual | iOS: "Open image" opens the PNG; the share passes url; refusal messages appear | NOT RUN |  |
| A17.run | db | Non-test fragments' count and checksum are the same before and after this run | NOT RUN |  |
| A17.deploy | operator | The same count and checksum match the pre-deploy dump, if it exists | NOT RUN |  |
| A17.smoke | manual | Reader smoke test: open a book, save a fragment, add a note | NOT RUN |  |
| A18.audit | operator | The portable audit (§14.3) produces a report and changes nothing | NOT RUN |  |
| A19.api | api | An excerpt of a seeded book returns 200; the same excerpt with one changed word returns 422 | NOT RUN |  |
| A19.db | db | quoteProvenance.source is sync_map | NOT RUN |  |
| A20.audio | manual | A seeded book plays in Escucha Activa with correct highlight sync | NOT RUN |  |
| A20.progress | manual | Reading progress is saved and restored | NOT RUN |  |
| A20.fragments | manual | Saving and opening fragments works in the reader | NOT RUN |  |
| X1.api | api | Bad platform, bgType, colour, scale and oversized text return 400 without rendering | NOT RUN |  |
| X2.api | api | Sharing and revoking without a token return 401 | NOT RUN |  |
| X3.api | api | GET /shares/<id> needs no token and exposes no creator, fragment or provenance fields | NOT RUN |  |
| X4.api | api | 3 concurrent identical requests return one URL | NOT RUN |  |
| X4.db | db | Exactly one live row for that configuration; the fixture's shareCount matches the shares created | NOT RUN |  |
| X5.api | api | A repeated revoke returns 204; the same card can then be shared again under a new URL | NOT RUN |  |
| X6.books | db | Non-fixture books' published flag, uploader and sync coverage are identical before and after | NOT RUN |  |
| X6.admin | db | The set of administrator accounts is the same before and after | NOT RUN |  |
| X6.protected | db | The pre-existing fixture and administrator records are unchanged | NOT RUN |  |
| X8.prepare | api | Shares exist before storage stalls | NOT RUN |  |
| X8.revoke | api | With storage stalled, revocation returns 204 within the limit and the share returns 404 | NOT RUN |  |
| X8.repeat | api | Revoking again during the stall returns 204 within the limit | NOT RUN |  |
| X8.fragment | api | With storage stalled, fragment deletion returns 204 within the limit and its shares return 404 | NOT RUN |  |
| X8.account | api | With storage stalled, account deletion returns 204 within the limit and its shares return 404 | NOT RUN |  |
| X8.book | api | With storage stalled, book deletion returns 204 within the limit and its shares return 404 | NOT RUN |  |
| X8.outbox | db | During the stall: a queued row with attempts ≥ 1 and a recorded error class | NOT RUN |  |
| X8.recovered | api | After storage returns and the sweep runs: every affected image returns 404 | NOT RUN |  |
| X8.drained | db | After the sweep: none of those outbox rows remain | NOT RUN |  |
| X9.api | api | Deleting a book with shares returns 204; its share pages and images return 404; a repeat delete returns 404; a book with no shares deletes cleanly; another book's share stays live | NOT RUN |  |
| X9.db | db | Those shares are revoked, none of their outbox rows remain, and the other book's share is untouched | NOT RUN |  |
| X7.local | operator | Locally, the baseline API creates a real share on the migrated schema | NOT RUN |  |

## Data changes and clean-up

- Accounts created: ____
- Shares recorded: ____
- Fixture book: ____
- Clean-up: ____
- Left behind: the fixture text object, A19's `shareCount` +1, rate-limit keys until they expire

## Findings and deviations

____

## Sign-off

- Operator: ____
- Product Owner: ____
