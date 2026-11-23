# Noetia — FR-CA Five-Title Pilot: Frozen Selection & Source Manifest

**Specification finalized:** November 22, 2026  
**PO selection:** Exactly five French titles; *Maria Chapdelaine* **replaces** *Les Trois Mousquetaires*.  
**Status:** FIVE TITLES SELECTED; SOURCES IDENTIFIED; **NOT RIGHTS-CLEARED, IMPORTED, SYNCHRONIZED, PUBLISHED OR APPROVED FOR IMPLEMENTATION**.  
**UI locale:** `fr-CA`. **Original book language:** `fr`. English/Spanish UI must also display French books correctly.

## A. Frozen five-title list

| # | Work / author | Exact candidate French text | Candidate French narration | Verified source-page facts | Remaining gate |
|---|---|---|---|---|---|
| 1 | *Candide, ou l’optimisme* — Voltaire | [Project Gutenberg #59859](https://www.gutenberg.org/ebooks/59859) | [LibriVox — Candide ou L'optimisme](https://librivox.org/candide-by-voltaire-2/) | Gutenberg identifies **French**; LibriVox reports **French**, about **3h53**, one recording | Text vs narrated edition, chapter/order, quality and rights |
| 2 | *Le Horla* — Guy de Maupassant | [Project Gutenberg #10775](https://www.gutenberg.org/ebooks/10775) | [LibriVox — Le Horla](https://librivox.org/le-horla-by-guy-de-maupassant-1203/) | **Both represent a French story collection**, not simply the title novella; LibriVox has 14 chapters/story tracks totaling **3h48**, first is *Le Horla* (~52 min) | Map table of contents to all audio stories, agree catalog presentation and rights |
| 3 | *Le Tour du monde en quatre-vingts jours* — Jules Verne | [Project Gutenberg #800](https://www.gutenberg.org/ebooks/800) | [LibriVox — Le Tour du monde en quatre-vingts jours](https://librivox.org/le-tour-du-monde-en-quatre-vingts-jours-by-jules-verne/) | Gutenberg and LibriVox identify **French**; LibriVox is **8h05**, many readers, 37 chapters, ~222 MB ZIP | Chapter-order and pronunciation QA; stream seek and bandwidth |
| 4 | *Madame Bovary* — Gustave Flaubert | [Project Gutenberg **#14155** (French)](https://www.gutenberg.org/ebooks/14155) | [LibriVox — Madame Bovary (French)](https://librivox.org/6435) | Gutenberg #14155 explicitly **French**; LibriVox **French**, **13h11**, **three M4B files** (~119, 129, 118 MB) | Multipart playback not supported by current single-M4B picker; HOLD pending solution, rights, alignment |
| 5 | *Maria Chapdelaine* — Louis Hémon | [Project Gutenberg **#13525** (French)](https://www.gutenberg.org/ebooks/13525) | [LibriVox — Maria Chapdelaine](https://librivox.org/maria-chapdelaine-by-louis-hemon/) | Gutenberg identifies the French source; LibriVox **French**, **5h06**, 16 chapters/sections, ~140 MB M4B | Original text to LibriVox chapter match, Canadian recording rights and reader QA |

### Correction to the previous candidate draft

The prior draft incorrectly assigned Project Gutenberg **#2413** to *Madame Bovary* in French. **#2413 is Eleanor Marx-Aveling's English translation**, unsuitable for French text/audio synchronization. The correct *French-language* candidate is **#14155**. This correction is a source-language qualification, not a change in the five PO-selected work identities.

The PO's November 22 instruction replaces **only** *Les Trois Mousquetaires* with *Maria Chapdelaine*. No sixth title, alternate or automatic substitute is authorized.

## B. Verification status — distinguish discovery from clearance

**Verified from public source pages on November 22, 2026:** Candidate pages exist; Gutenberg language metadata for all five is French (using #14155 for *Madame Bovary*); the specified LibriVox recording pages identify French audio; source pages supply the summary durations and multipart information above.

**NOT verified:** Exact text checksum/edition; rights to distribute/stream each specific narration in Canada; permission for commercial use or modifications where applicable; soundtrack recording legal status in Canadian territory; chapter-by-chapter linguistic identity; successful local ingestion; French word timestamps; 90%+ synchronized coverage; listen-test and exact media seek behavior. All remain **HOLD** for public release until separately qualified.

Public-domain classification of the underlying nineteenth-century work or LibriVox's U.S. public-domain designation does not, by itself, clear Canadian distribution or derivative processing. Use no modern covers without separate rights evidence. Preserve attribution or required license terms after verification.

## C. Controlled preparation order and resource safeguards

1. **Candide:** establish the first French text/audio normalization and alignment baseline using an approximately four-hour recording.
2. **Maria Chapdelaine:** validate the Québec-relevant title and 16-chapter correspondence; check accent and locale presentation separately.
3. **Le Horla:** reconcile the **collection** structure and audio's 14 stories before creating a single book entry or display copy.
4. **Le Tour du monde en quatre-vingts jours:** handle extended audio and multiple readers only if previous QA succeeds without new infrastructure.
5. **Madame Bovary:** hold until the three-part M4B handling is explicitly designed/qualified without duplicating large files on the server.

The above is a technical processing sequence, **not** a change of the PO-selected set. Do not download large ZIPs/M4Bs or ingest into any live database before a separate bounded execution approval and cost cap.

## D. Required per-title evidence before any publication decision

- [ ] Exact Gutenberg URL, original language, editorial details, full-text integrity and SHA-256 of fetched file recorded.
- [ ] Original work and **specific digital text edition** rights verified for U.S. and Canada and intended public or commercial distribution.
- [ ] Exact LibriVox audio item, section URLs, narrator/recording terms and Canadian recording rights verified.
- [ ] Narrated story/chapters and source text scope matched with a chapter-by-chapter manifest, including non-narrated front matter.
- [ ] French punctuation, quotation marks, apostrophes, diacritics, `œ/æ`, headings and narrative trimming checked with tests.
- [ ] Word-level French transcript/audio alignment checked; valid audio seeks on web/mobile; existing **≥90%** sync coverage and manual samples passed.
- [ ] Content remains `isPublished=false`, absent from public book search/Meilisearch and inaccessible through unpublished direct reader endpoints.
- [ ] EN/ES regressions pass; no extra copy of large audio files introduced without justified storage costs.
- [ ] Independent PA rights, media and architecture review recorded; separate PO approval for publishing **each** title.

## E. Operational and governance boundaries

- Title list is frozen **for PO approval**; the sources are research candidates, not final licensed assets.
- Catalog entries must be authored with `language: 'fr'` explicitly; `fr-CA` is for UI only.
- Current `IngestionService.ingestOne()` marks books published at creation. **Do not execute it unchanged** for this pilot.
- Current `LibrivoxApiService.getM4bUrl()` selects the first M4B only. This cannot fully ingest the three-part *Madame Bovary* recording.
- French content QA does not authorize subscription purchases, production data modification, public availability, deployments, merges, CDN changes or commercial activation.
- An unqualified title stays HOLD; do not replace a title without new PO approval.

## F. Primary source URLs

- Source Gutenberg IDs: [59859](https://www.gutenberg.org/ebooks/59859), [10775](https://www.gutenberg.org/ebooks/10775), [800](https://www.gutenberg.org/ebooks/800), [14155](https://www.gutenberg.org/ebooks/14155), [13525](https://www.gutenberg.org/ebooks/13525).
- Recording pages: [Candide](https://librivox.org/candide-by-voltaire-2/), [Le Horla](https://librivox.org/le-horla-by-guy-de-maupassant-1203/), [Le Tour du monde](https://librivox.org/le-tour-du-monde-en-quatre-vingts-jours-by-jules-verne/), [Madame Bovary](https://librivox.org/6435), [Maria Chapdelaine](https://librivox.org/maria-chapdelaine-by-louis-hemon/).
- Rights starting points (not a substitute for clearance): [Project Gutenberg copyright](https://www.gutenberg.org/help/copyright), [LibriVox](https://librivox.org/), [Canadian Copyright Act](https://laws-lois.justice.gc.ca/eng/acts/C-42/).

**MANIFEST FINALIZED FOR PO APPROVAL — NO CONTENT INGESTION OR PUBLICATION AUTHORIZED.**
