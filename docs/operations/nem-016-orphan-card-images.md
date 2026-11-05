# NEM-016 R3: card images left behind before the F2 correction

**Status: proposal. Nothing here has been run on staging or production, and no object has been deleted.** The audit is read-only and has no delete mode. Running it on staging or production, and any clean-up, each need separate Product Owner authorization.

## Can the system identify them?

**Partly.** Card images live at the root of the public `images` bucket as `<uuid>.png`. `shares.imageUrl` links a share to its image, so anything still linked can be judged. Nothing links an image whose share row is gone, so those can't be judged.

## Classification

| Class | How it's recognized | Confidence | Dry-run plan |
|---|---|---|---|
| `in_use` | A live share of an eligible book | Certain | Never touched |
| `book_deleted` | A live share, but the book row is gone. **This is the F2 defect** | **Safely identifiable** | Revoke the share; delete the object |
| `revoked_not_deleted` | Every share using it is revoked, and no outbox row | **Safely identifiable** | Delete the object |
| `queued` | An outbox row exists | Handled | Nothing; the sweep deletes it |
| `live_book_ineligible` | A live share, and the book exists but fails the gate today | Ambiguous | Nothing. It may become eligible again |
| `recent` | Younger than the minimum age (default 24 hours) | Ambiguous | Nothing. It may be a request in flight |
| `unreferenced_before_shares` | No share row, and older than every share | Ambiguous | Nothing |
| `unreferenced` | No share row, and newer than the first share | Ambiguous | Nothing |

Objects that aren't root-level `<uuid>.png`, such as `covers/` and `backgrounds/`, are never considered.

**Report only:** live shares whose image is missing, and shares whose `imageUrl` isn't a card URL.

## False-positive risks

**Why the unreferenced classes are never proposed for deletion:**

- **Cards made before share records existed.** Before migration 065 a card had no share row at all, but its URL was given to the reader. It may be embedded in posts and pages today. It looks exactly like an orphan.
- **Share rows removed by account deletion before NEM-016.** A deleted reader's card and a card still linked from somewhere look the same.
- **A database restored from an older backup.** Newer objects would look unreferenced, and on staging this is a real possibility.
- **Clock and copy effects.** A bucket copy or restore can reset `LastModified`, which would move objects between the age-based classes.

**Why even the safe classes need a person to review them:**

- **A public URL may be in use outside Noetia.** Revoking withdraws it for good. That's the approved behaviour (D07), but old posts that use the URL would break.
- **The audit reads the database and then lists storage**, so they aren't one snapshot. A card made in between looks unreferenced; the minimum age keeps it out of the safe classes.
- **`book_deleted` assumes the book is gone for good.** If a book might be restored from a backup, revoking its shares can't be undone by that restore without also restoring shares.
- **Environment mix-ups.** Run it with one environment's database and the same environment's bucket. Mixing them would make every object look unreferenced. Those would land in ambiguous classes, so nothing would be proposed, but the report would be meaningless.

## Read-only query

The share side alone, without storage access, finds the F2 defect directly. Run it inside a read-only transaction:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT s.id, s."imageUrl", s."createdAt"
  FROM shares s
  LEFT JOIN books b ON b.id = s."bookId"
 WHERE b.id IS NULL AND s."revokedAt" IS NULL
 ORDER BY s."createdAt";
ROLLBACK;
```

On a database still before migration 068, drop the `revokedAt` condition.

## Full audit

Compares storage with the database. It can only list objects, and it reads inside a read-only transaction that's rolled back. It prints keys, share ids and counts, never quote text or personal data.

```bash
node dist/sharing/audit-orphan-images.js --min-age-hours=24
```

The output is the dry run: `counts`, `keys` by class, and `proposedActions`, which lists what an approved clean-up would do. **`--min-age-hours=0` exists only for local verification**, because new objects can't be aged. Don't use it for a plan.

## Proposed clean-up (not implemented)

No clean-up code exists. If the Product Owner approves one, it should go through the existing revocation path, so the outbox and sweep do the deleting:

1. **Dry run.** Run the audit and save the report.
2. **Review.** A person checks the safe classes and samples some keys. The Product Owner approves the exact list.
3. **Restore point.** Take a database dump. If it's production, take a storage backup as well, because deleted objects can't be recovered.
4. **Revoke.** For `book_deleted`, set `revokedAt` and add the outbox row in one transaction, for the approved ids only, using the guard below. For `revoked_not_deleted`, add only the outbox row.
5. **Let the sweep delete.** This keeps the existing retry behaviour. Nothing deletes objects directly.
6. **Verify.** Re-run the audit. The safe classes should be empty, and the ambiguous ones unchanged.

```sql
-- Sketch only, for review. Not to be run without approval.
BEGIN;
UPDATE shares s SET "revokedAt" = now()
 WHERE s.id = ANY($approved_ids) AND s."revokedAt" IS NULL
   AND NOT EXISTS (SELECT 1 FROM books b WHERE b.id = s."bookId");
INSERT INTO card_image_deletions ("key")
  SELECT unnest($approved_keys::varchar[]) ON CONFLICT ("key") DO NOTHING;
COMMIT;
```

**The ambiguous classes stay in place** unless the Product Owner decides otherwise, because deleting one could break a link in public use. Storing a few extra images costs far less than that.
