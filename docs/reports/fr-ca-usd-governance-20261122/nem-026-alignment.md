# NEM-026 (initial French catalogue pilot): alignment requirements

**Status:** governance alignment annex. **Not** a mission specification, and **not** an execution authorization. No ingestion or publication is authorized.

> **Baseline finding:** the approved NEM-026 specification file is **not in the repository**. It is absent from `main` at `8f2f294`, from every remote branch, and from GitHub issues and PRs (searched 2026-11-22). Its content therefore **could not be compared**. When the approved text is committed, PA reconciles it against this checklist.

## A. Exact title selection (PO, FINAL; do not expand or change)

| # | Title | Author | Edition constraint |
|---|---|---|---|
| 1 | *Candide* | Voltaire | — |
| 2 | *Le Horla* | Guy de Maupassant | — |
| 3 | *Le Tour du monde en quatre-vingts jours* | Jules Verne | — |
| 4 | *Madame Bovary* | Gustave Flaubert | **French Project Gutenberg edition #14155** |
| 5 | *Maria Chapdelaine* | Louis Hémon | — |

- **Exactly five titles.** These are approved **candidates**, not automatically cleared for Canadian distribution or publication.
- **Repository fact:** none of the five is in `services/api/src/ingestion/catalogue.ts` on `main`, and the catalogue has no `fr` entries today (it holds `es` by default and some `en`). `books.language` is `varchar` with default `'es'`, so `fr` fits with no schema change.
- **Not verified here:** Project Gutenberg returned HTTP 503 for every request on 2026-11-22, so the title, author and language of #14155, and the French editions of the other four, are **unverified**. This is a NEM-026 pre-execution check.

## B. Requirements to keep

1. **Original French text:** the ingested text is the original French work, not a translation.
2. **Rights verification for every intended territory**, Canada included. Public-domain status differs by jurisdiction and by edition, and covers translations, prefaces, notes and the audio recording separately. Hémon (d. 1913) and the 19th-century authors are expected to be public domain in Canada; this must still be confirmed per edition and per recording, and is **not asserted here**.
3. **Audio-source verification:** source, licence (for example, LibriVox public-domain dedication) and reader for each recording.
4. **Text/audio edition matching:** the recording must read the same edition and text as the ingested source. Mismatches are the documented cause of failing sync on existing books (`docs/whisper-sync-troubleshooting.md`).
5. **Synchronization quality:** the existing standard of **`syncCoverage` ≥ 90%** (CLAUDE.md), measured with the existing tooling (`diagnose-sync --realign`). A title below the standard is not offered (feedback rule: only offer books that meet the standard).
6. **Private, unpublished pilot:** French titles are invisible in discovery, search (Meilisearch `meetsStandard`), collections and public pages until a separate checkpoint approves a public French release.
7. **No unauthorized ingestion or publication:** nothing runs against production or staging without a distinct PO execution instruction for NEM-026.

## C. Dependencies on NEM-025 and the commerce policy

- **Interface language and book language stay independent** (NEM-025 A3). A French book can be read with an `es` or `en` interface, and the reverse.
- **No commerce change:** the pilot titles follow existing book and pricing rules. Any price shown is USD under USD-LOCAL-REFERENCE.
- **French-language Whisper/alignment:** the pipeline (`scripts/whisper-colab.ipynb`, `phrase-aligner.ts`) has been validated on `es`/`en`. French text normalisation (elisions such as `l'homme`, guillemets « », non-breaking spaces before `; : ! ?`) is an **unvalidated risk** for alignment quality and must be tested in the private pilot.
