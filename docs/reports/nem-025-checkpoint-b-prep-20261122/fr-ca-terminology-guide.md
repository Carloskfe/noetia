# fr-CA terminology and style guide: DRAFT for PO decision and qualified review

**Status:** **Recommendations only.** None of the conventions below is approved. The only **PO-approved** fr-CA items are:
- the interface label **"Français (Canada)"**;
- USD-only commerce, with prices marked as US dollars;
- the **2.22%** Causas Noetia commitment.

The Checkpoint A draft dictionaries (PR #78) follow these recommendations provisionally. They change if the PO decides otherwise.

**Reference authorities for the reviewer:**
- Office québécois de la langue française (OQLF), *Grand dictionnaire terminologique* and *Banque de dépannage linguistique*.
- The Government of Canada's *Termium Plus* and *Clefs du français pratique*.

## 1. Register: "vous" vs "tu"

| | "vous" | "tu" |
|---|---|---|
| Fit with Québec commercial software | The norm for transactional, account, payment and legal-adjacent UI | Used by some lifestyle and youth brands |
| Fit with Noetia's ES voice (CLAUDE.md: "tú", warm peer) | Warmth comes from wording, not pronoun | Mirrors the Spanish voice directly |
| Risk | Can read formal if the copy is stiff | Can read over-familiar, or careless in security and payment messages |
| Mixed approach | — | Not recommended: switching register inside one product reads as an error |

**Recommendation:** **"vous" throughout** (UI, emails, push), with warm, direct wording to keep the brand voice.

**PO decision required (D-T1).** If the PO prefers "tu", it must apply everywhere, including emails.

## 2. Product terminology

| Concept | Canonical ES | EN | Recommended fr-CA | Alternatives | Notes |
|---|---|---|---|---|---|
| Interface language label | — | — | **Français (Canada)** | — | **PO-approved.** No flag icon; flags never identify a language |
| Subscription credit | Token | token | **jeton** (pl. jetons) | "Token" as a brand term | **PO decision (D-T2).** "Jeton" is natural French and OQLF-friendly. Keeping "Token" mirrors ES branding but reads as an anglicism in Québec |
| Synchronized listening mode | Escucha Activa (proper noun) | Active Listening | **Écoute active** | "Écoute Active"; keep "Escucha Activa" | **PO decision (D-T3).** French title case capitalizes only the first word. CLAUDE.md treats the ES name as a proper noun |
| Live group listening | Escucha Juntos | Listen Together | **Écouter ensemble** | keep "Escucha Juntos" | The mobile tour currently keeps "Escucha Juntos" as a proper noun; make it consistent with D-T3 |
| Email | correo | email | **courriel** | "e-mail" | OQLF-recommended; standard in Québec |
| User highlight | Fragmento | fragment | **fragment** | "extrait", "passage" | Keep "fragment" as the product term |
| Reading clubs | Clubes de Lectura | Reading Clubs | **clubs de lecture** | — | Lower case in running text |
| Book list | Biblioteca | library | **bibliothèque** | — | |
| Active phrase | Frase | phrase | **phrase** | — | |
| Plan | plan | plan | **forfait** | "abonnement" (the subscription itself) | forfait = the tier (Individuel/Duo/Famille); abonnement = the act or contract |
| Plan names | Individual / Dúo / Familia | Individual / Duo / Family | **Individuel / Duo / Famille** | keep the EN names | **Note:** plan names come from the database (`plans.name`) and are shown untranslated today in every language; see D-T6 |
| Chat | chat | chat | **clavardage** | "chat", "messagerie" | Québec usage; reviewer to confirm for a young audience |
| Cookies | cookies | cookies | **témoins** | "cookies" | OQLF term; legal text must match the final legal translation |
| Upload | subir | upload | **téléverser** | — | |
| Coming Soon (Noetia+/NoetiaX) | Próximamente | Coming Soon | **Bientôt offert** | "Bientôt disponible" | Must never imply purchasability (PO policy) |
| Causas Noetia | Causas Noetia | Causas Noetia | **Causas Noetia** | — | Proper noun, never translated; the percentage is always **2,22 %** |
| Noetia+ / NoetiaX | — | — | unchanged | — | Proper nouns |

## 3. Typography and formatting (Canadian French)

- **Prices:** `8,99 $ US` (decimal comma, symbol after the number, space before `$`, "US" marker). Never a bare `$`. Use `Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD' })`, which yields `8,99 $ US`.
- **Percentages:** `2,22 %`, ideally with a non-breaking space (U+00A0 or U+202F) before `%`.
- **Punctuation:** Québec practice puts **no space** before `? ! ;` and a space before `:`. Use guillemets `« … »` with inner (non-breaking) spaces. Use typographic apostrophes `’`.
- **Ellipsis:** the Unicode `…` (as in the ES/EN rule).
- **Capitalization:** sentence case for labels (as in the ES rule). Titles capitalize only the first word and proper nouns.
- **Dates and times:** `22 novembre 2026`; a 24-hour clock `14 h 30`. Use `Intl.DateTimeFormat('fr-CA')`. **Gap:** several components call `toLocaleString()` with no locale.
- **Numbers:** a space as the thousands separator (`1 234`). Use `Intl.NumberFormat('fr-CA')`.

## 4. Inclusive language (PO decision D-T4)

The draft mixes doublets ("Lecteur ou lectrice", "Auteur ou autrice") with masculine generics ("Vous êtes parti", "abonné"). Options:
- **(a)** epicene rephrasing where possible, with doublets only where unavoidable (recommended; reads naturally);
- **(b)** the masculine generic throughout;
- **(c)** contracted forms such as "lecteur·rice" (not recommended for UI readability or screen readers).

## 5. Qualified human review: requirements (no procurement, no expense)

- **Who:** a native Canadian-French (Québec) professional translator or reviser, preferably certified by OTTIAQ (or another provincial order), with software UI localization experience.
- **Legal documents** (Terms, Privacy, Cookies, consent) need a **legal** translator or lawyer reviewer qualified for Québec and Canada. This is separate from UI review.
- **Scope (approximate source words):**
  - web UI dictionary ~3 200 (Checkpoint A draft);
  - mobile ~650;
  - inline bilingual pages ~3 700 (French source after extraction; roughly half the ES+EN count);
  - emails ~900;
  - push ~60;
  - PR #60 payment-status copy (~150 strings, including PO-approved financial wording);
  - legal ~2 000 per document set.
- **Deliverables:**
  - a reviewed dictionary diff;
  - a filled terminology table (§2) with justifications;
  - screenshots or proofs of the key flows (sign-up, password reset, account deletion, gift, pricing, reader);
  - a sign-off statement per surface.
- **Acceptance criteria:**
  - no untranslated strings outside the allowlist;
  - a consistent register (D-T1) and terminology (D-T2 to D-T6);
  - correct typography (§3);
  - meaning preserved for financial, Causas and legal-adjacent copy, which is checked against the PO-approved ES/EN text;
  - accessible labels make sense when read aloud.
- **AI-only translation is not sufficient** (NEM-025 §16.2). Engineering may produce drafts; certification is human.
- **Cost:** not estimated here. The PO decides between an internal qualified reviewer and a **capped** external review (NEM-025 §16.2). The word counts above let the PO request quotes.
