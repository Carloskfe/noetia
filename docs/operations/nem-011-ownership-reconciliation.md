# NEM-011 — Production Ownership Reconciliation (read-only procedure)

**Authority:** Product Owner decision D2 (2026-10-29) — *read-only; do not change, delete, or revoke historical ownership records.*
**Script:** [`scripts/sql/nem-011-ownership-reconciliation.sql`](../../scripts/sql/nem-011-ownership-reconciliation.sql)
**Operator:** a person with production SSH access. Claude does not run this on production.

## What it answers

| Section | Question |
|---|---|
| 1 | How is ownership distributed across acquisition types (`free` / `token` / `purchase` / `courtesy`) and current book status? |
| 2–3 | How many `'free'` rows exist on books that are **not** free now (the G1 bypass signature), split into author titles and catalogue titles, and how many of those users can read anyway through current streaming? |
| 4a–c | G2 signatures: token ownership with no spent token, books paid with several tokens, tokens spent with no ownership |

Output contains **UUIDs only** — no emails or names. Treat it as internal; share **counts**, not row listings.

## Safety layers (both validated 2026-10-29 on a fully migrated throwaway database)

1. The script runs inside `BEGIN TRANSACTION READ ONLY … ROLLBACK`; Postgres rejects any write inside it.
2. The session itself is forced read-only with `PGOPTIONS='-c default_transaction_read_only=on'`; a direct `DELETE` in that session fails with `cannot execute DELETE in a read-only transaction`.
3. `statement_timeout = 60s` bounds the run.

Validation also confirmed each defect signature is counted exactly on seeded data (one row per seeded case).

## Procedure

Every command is **one line** — never paste multi-line content into the server terminal (CLAUDE.md, 2026-05-12 incident).

**1. Copy the script to the server** (from a machine with the repository checked out at the NEM-011 branch):
```bash
scp -P 222 scripts/sql/nem-011-ownership-reconciliation.sql root@84.247.140.175:/tmp/nem011-reconciliation.sql
```

**2. On the server, verify the file is the reviewed version** — the hash must equal the one recorded in PR #11 for the reviewed commit:
```bash
sha256sum /tmp/nem011-reconciliation.sql
```
Reviewed hash (commit `5723b2a`): `f5fc9cd7a4a3d820dc01f58255537995175b632acd94746ed84019888e980b9a`. If it differs, **stop**.

**3. Run it read-only and keep the output on the server:**
```bash
cd /opt/noetia && docker compose --env-file .env.production -f docker-compose.server.yml exec -T -e PGOPTIONS='-c default_transaction_read_only=on' db psql -U noetia -d noetia -v ON_ERROR_STOP=1 -P pager=off -f - < /tmp/nem011-reconciliation.sql > /root/nem011-reconciliation-$(date +%F-%H%M).txt 2>&1; echo "exit=$?"
```
Expected: `exit=0`, and the file ends with `ROLLBACK`.

**4. Read the counts only:**
```bash
grep -vE '^ [0-9a-f]{8}-' /root/nem011-reconciliation-*.txt | tail -60
```
This prints the summary tables and hides the UUID detail rows of section 3.

**5. Clean up the copy:**
```bash
rm /tmp/nem011-reconciliation.sql
```

## When to run

| Run | Purpose |
|---|---|
| **Baseline** — before the coordinated NEM-011 + NEM-012 deploy | Size historical impact for decision B-10 |
| **Post-deploy** — 24 h after | G1 counts must not grow for rows `addedAt` after the deploy time; G2 4a–4c must not grow |
| **Before NEM-013** (entitlement enforcement) | Historical bypass rows become those users' only access path once streaming ends |

## Reading the results — caveats

- `books."isFree"` is the **current** sync-quality gate, not history: a catalogue title (`uploadedById IS NULL`) may have been free when it was added.
- Before NEM-011 the Discover / collection "+" called the bypassed endpoint for paid books, so most G1 rows are likely ordinary clicks, not abuse.
- **No remediation is authorized.** Results inform a Product Owner decision (B-10); any change to ownership records needs its own decision and mission.
