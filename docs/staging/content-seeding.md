# Staging Content Seeding (NEM-006C)

How staging gets a reader-validatable catalog — text, audio, sync maps — and how to
rebuild it after a reset. **No secrets in this file.**

NEM-006A gave staging an isolated environment. It could not exercise Escucha Activa:
books had text but no audio, and their `sync_maps` rows were empty placeholders with
`syncCoverage` NULL, so every title failed the ≥90% catalog quality gate and
`GET /books` returned `[]`. This document covers closing that gap.

---

## 1. Strategy

Three phases, one command:

```
1. audio mirror    production MinIO ──READ-ONLY──> staging MinIO   (~13 GB)
2. transcripts     repository transcriptions/  ──> staging api container
3. staging run     wire audio keys + rebuild sync maps from the VTT corpus
```

**Whisper is never re-run.** The repository tracks 1,743 VTT files across 80 book
directories plus 88 pre-merged `*.merged.vtt` transcripts. That corpus — the expensive
GPU output — is the synchronization source. Re-transcribing would cost hours and
produce no better result.

---

## 2. Content source hierarchy

| Level | Source | Used for |
|---|---|---|
| 1 | Repository | VTT transcripts, catalogue metadata, fixtures |
| 2 | Upstream public domain | Book text (Gutenberg / Wikisource, via `seed-ingestion.js`) |
| 3 | Production read-only mirror | Audio objects |

Audio uses Level 3 deliberately. Re-downloading from archive.org is slower, repeats
known upstream 500s on three titles, and would make full-catalog rebuilds fragile.
The production mirror is a local-network copy: deterministic, resumable, and it never
leaves the host.

**Why the mirror is portable:** audio object keys are derived from the *title slug*
(`audio-source-resolver.ts` → `books/<slug>-audio.mp3`), not the book UUID. Staging and
production assign different UUIDs to the same title, so a UUID-keyed layout could not be
mirrored — a slug-keyed one can.

---

## 3. Production read policy

Production is a **read source only**. The seeder never writes to production's database,
object store, Redis, or Meilisearch, and the mirror is one-directional by construction.

Protections in the script:

- refuses to start unless `DB_NAME` and `MINIO_PUBLIC_URL` both contain `staging`;
- addresses each MinIO server by **container name**, never the `storage` service alias,
  which resolves on both networks and would be ambiguous;
- throttles the read (`--limit-download 200MiB`) so a bulk transfer cannot starve
  production's MinIO — the production container running closest to its memory limit;
- polls `https://noetia.app` and `https://noetia.app/api/books` every 30 s during the
  transfer and **stops the mirror** if either degrades.

Production reliability outranks staging completion. Always.

---

## 4. Usage

Run on the server from `/opt/noetia-staging`, after `git pull` and a rebuild (the api
image must contain `dist/ingestion/stage-content.js`).

```bash
scripts/seed-staging-content.sh --dry-run          # inventory + resolution, no writes
scripts/seed-staging-content.sh                    # full run
scripts/seed-staging-content.sh --skip-mirror      # audio already mirrored
scripts/seed-staging-content.sh --only "Niebla"    # one title (repeatable)
```

Always dry-run first. It reports what each title *would* do — including which transcript
resolves and whether audio is present — without touching anything, and it never contacts
production.

---

## 5. Idempotency, resumability, incremental refresh

State is derived from reality (database rows + object store), never from a state file.
That gives three properties for free:

- **Idempotent** — a book whose audio key is already correct is not re-saved; a re-run
  recomputes sync maps but converges to the same result.
- **Resumable** — if the run dies at title 60 of 86, re-run it. Completed work is
  detected, not repeated. `mc mirror` likewise skips objects already present with a
  matching etag, so an interrupted 13 GB transfer resumes at the remainder.
- **Incremental** — `--skip-mirror` re-runs only the database-side work, which is the
  normal path after a code change to the aligner.

---

## 6. Rebuilding after a reset

`dcs down -v` destroys staging's volumes, including its database and object store. Full
rebuild:

```bash
cd /opt/noetia-staging
dcs up -d --build
dcs exec -T -e DB_HOST=db api npm run migration:run:prod
dcs exec -T api node dist/ingestion/seed-ingestion.js      # text
dcs exec -T api node dist/ingestion/seed-collections.js
dcs exec -T api node dist/ingestion/seed-covers.js
# MinIO buckets — see EXTERNAL-ACTIONS.md §10
scripts/seed-staging-content.sh                            # audio + sync
```

Nothing here requires an undocumented manual step. Destructive reset is never the
default and must be typed deliberately.

---

## 7. Per-title outcomes

Every title lands in exactly one state. A single failure never aborts the run.

| Status | Meaning |
|---|---|
| `COMPLETE` | Text + audio + sync map at ≥90% coverage — Escucha Activa works |
| `SYNC_BELOW_GATE` | Aligned, but below 90%. Hidden from the catalog, exactly as in production |
| `MISSING_VTT` | Audio present, no committed transcript |
| `MISSING_AUDIO` | Transcript present, no audio object in staging MinIO |
| `TEXT_ONLY` | Neither audio nor transcript |
| `RIGHTS_REVIEW_REQUIRED` | Excluded by policy — see §9 |
| `SKIPPED` | No book row in staging, or dry run |
| `FAILED` | Unexpected error; the message is recorded in the report |

`SYNC_BELOW_GATE` is a real outcome, not a failure to hide. Production has 66 passing
maps out of 84 — staging reaching 66 **is** parity, and the other 18 are pre-existing
catalog debt this mission surfaces rather than conceals.

---

## 8. Transcript resolution

For each title, in order:

1. an explicit alias (`VTT_ALIASES` in `staging-content.service.ts`);
2. `transcriptions/<title-slug>.merged.vtt`;
3. the first `.vtt` inside a directory named exactly as the title.

Aliases exist because some transcripts predate the current titles — `Don Juan Tenorio` →
`don-juan.merged.vtt`, `Don Quijote de la Mancha — Vol. I` → `don-quijote-vol-1.merged.vtt`.
A wrong alias is self-correcting: a bad alignment lands below the 90% gate and is
reported as `SYNC_BELOW_GATE` rather than silently shipping a broken map.

---

## 9. Rights exclusions

`RIGHTS_PENDING_TITLES` in `staging-content.service.ts` lists titles excluded until
rights are settled — currently `Magnifica Humanitas`, consistent with the ingestion
pipeline's own "rights pending" skip. These are checked **before** any database access
and reported as `RIGHTS_REVIEW_REQUIRED`. One ambiguous title never blocks the catalog.

Do not add a title here to work around a technical failure; that is what the other
statuses are for.

---

## 10. Reconciliation report

Every run writes `staging-content-report.json` and `.md`, copied out to
`reports/staging-content/`. One row per title (text, audio, transcript, coverage,
status, reason) plus totals, including `readerValidatable` — the count of titles where
Escucha Activa actually works.

Report the honest number. `66/66 of production's synchronized titles` is useful;
`100% success` achieved by narrowing the definition is not.

---

## 11. Failure recovery

| Symptom | Action |
|---|---|
| Mirror exits non-zero | Re-run; `mc mirror` resumes from where it stopped |
| Mirror stopped on health check | Investigate production first. Re-run when healthy |
| `REFUSING TO RUN: destination is not unambiguously staging` | Working as designed — check `APP_ENV`, `DB_NAME`, `MINIO_PUBLIC_URL` |
| `Transcriptions directory not found` | Phase 2 did not run; check the api container is up |
| Many `MISSING_AUDIO` | Mirror did not complete — re-run without `--skip-mirror` |
| Many `SYNC_BELOW_GATE` | Compare against production's 66/84 before treating as a regression |

---

## 12. Related

- [EXTERNAL-ACTIONS.md](EXTERNAL-ACTIONS.md) — first activation, MinIO buckets
- [RUNBOOK.md](RUNBOOK.md) — day-to-day staging operations
- [data-and-sanitization.md](data-and-sanitization.md) — why no production **user** data
  is ever copied; this mission moves catalog content only
- [../whisper-sync-troubleshooting.md](../whisper-sync-troubleshooting.md) — diagnosing
  titles below the 90% gate
