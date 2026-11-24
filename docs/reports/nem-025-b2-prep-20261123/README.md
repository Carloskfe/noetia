# NEM-025 Checkpoint B2 preparation: transactional communications and French readiness

**Mode: diagnostic and design only.**

- No application code, templates, push handlers, schema, infrastructure, flags or dependencies were changed.
- No email or push was sent.
- B2-A and B2-B are **not** authorized or executed by this document.
- Every "recommendation" below is a proposal awaiting PO approval. Nothing here is an approved decision unless §8 marks it **APPROVED (source)**.

Companion: [`message-matrix.md`](message-matrix.md), the full per-flow matrix (deliverable 2).

---

## 1. Verified baseline (revalidated 2026-11-23)

| Item | Head | State |
|---|---|---|
| `main` | `8f2f294` (includes #59, #65, #63, #61) | — |
| PR #77 NEM-025/026 approved specs | `4ef2906d` | Draft, open |
| PR #78 Checkpoint A | `81143790` | Draft, open. **Contains `main` @ `8f2f294`.** |
| PR #79 Checkpoint B preparation | `e24c729c` | Draft, open |
| PR #80 B1-A web | `28aa6680` (on #78) | Draft, accepted |
| PR #81 B1-B mobile | `c4106a2b` (on #78) | Draft, awaiting PA re-review |
| PR #60 payment lifecycle | `d8e61e24` (on #59 branch) | Draft. **Touches `gifts.service.ts` (+46/−) and `subscriptions.service.ts` (+660/−).** No change to `email/` or `push/`. |
| PR #66 CI-2 EmailService tests | `9c9e4903` (on main) | Draft. Only `tests/unit/auth/email.service.spec.ts` (+405/−38). |
| PR #75 admin email addresses | `cb953607` (on main) | Draft, docs only (`docs/operations/email-addresses.md`, `TASKS.md`) |

**Checkpoint A facts this design builds on (`services/api/src/users/ui-locale.ts`):**

- `SUPPORTED_UI_LOCALES = ['es','en','fr-CA']` and `DEFAULT_UI_LOCALE = 'es'`.
- `isFrenchUiEnabled()` returns true only when `FR_CA_ENABLED` is exactly `'true'`.
- `selectableUiLocales()` and `normalizeUiLocale()` are the validation helpers.
- `UpdateUserDto.uiLanguage` is `@IsIn(SUPPORTED_UI_LOCALES)`, and the controller rejects `fr-CA` while the gate is off.

**Findings beyond PR #79:**

1. **Registration doesn't record the user's language.** This applies to local registration and, by code reading, to OAuth. The registrant gets Spanish emails (X-1), and by code reading the client switches to Spanish on its next load. The language-provider mount effect on web and mobile treats the server value as authoritative (`resolveServerLanguage`), and a new account's server value is the DB default `'es'`. This hasn't been verified at runtime.
2. **The language cast is unsafe.** The cast `(user.uiLanguage as 'es'|'en')` passes any stored string through. Before Checkpoint A, `UpdateUserDto.uiLanguage` accepted any string of up to 5 characters (`@MaxLength(5)` on `main`'s old DTO), so production may hold values outside `es`/`en`. Those values get a Spanish body with the raw stored value in `<html lang="…">` (X-4).
3. **PR #79's count of affected email flows is low.** #79 §2 says "4 flows ignore the user's language". The verified count is 6 of 9 call sites that pass no language (E-1, E-5, E-6, E-7, E-8, E-9). Only E-8, the logged-in buyer, ignores a language that is actually available.
4. **Push tokens are never removed** (X-11). Logout and account deletion leave them, and the table has no foreign key. This matters for privacy and for the deletion email's legal wording. It is not a translation issue.

---

## 2. Transactional-message matrix

See [`message-matrix.md`](message-matrix.md): 8 email templates across 9 call sites (E-1…E-9), and 5 push types (P-1…P-5). Each row gives:

- trigger and recipient;
- whether the recipient has an account;
- available and authoritative language;
- current EN/ES behaviour and proposed fr-CA behaviour;
- sensitivity;
- escaping;
- DTO changes, tests and STOP conditions.

### 2.1 Existing language defects, kept separate from the translation refactor

**Rule:** the refactor (B2-A1) must reproduce today's ES/EN output byte for byte, including these defects. Each correction is a separate, listed, PO-approved behaviour change (B2-A2, B2-B2).

| ID | Defect (pre-existing) | Affects ES users? | Affects EN users? | Correction belongs to | Decision |
|---|---|---|---|---|---|
| X-1 | Registration (local; OAuth by code reading) never stores the interface locale. E-1 is always ES, and the client switches to ES on next load. | No | **Yes** | B2-A2 | B2-D2 |
| X-2 | Logged-in buyer's gift confirmation (E-8) ignores the buyer's `ui` | No | **Yes** | B2-A2 | B2-D2 |
| X-3 | Non-user flows (E-5, E-6, E-7, E-9) are always ES. A policy gap rather than a code bug. | No | Yes (EN-interface senders) | B2-A2 | B2-D1 |
| X-4 | Unsafe cast. Values outside `es`/`en` get an ES body with the raw value in `<html lang>`. Stored `fr-CA` would produce Spanish under `lang="fr-CA"`. | Edge | Edge | B2-A1 (resolver). ES/EN output for valid values is unchanged. | B2-D4 |
| X-5 | Subjects HTML-escape names (E-7, E-9). A name containing `&` shows as `&amp;` in the subject line. | Yes | Yes | B2-A2 (listed change) | B2-D2 |
| X-6 | Spanish-only fallbacks and labels inside EN emails (`Alguien`, `Un usuario`, `lector/a`, occasion labels) | No | **Yes** | B2-A2 | B2-D2 |
| X-7 | `escape()` doesn't escape quotes. **Not a live defect**: every user value lands in a text node today. The design forbids user values in attributes. | — | — | B2-A1 constraint | — |
| X-8 | A failed send logs the recipient email address (CLAUDE.md: never log user PII) | — | — | Out of scope; separate fix proposed | PA |
| X-9 | Push P-3, P-4 and P-5 send title `Noetia` with an **empty body** and no `data` | Yes | Yes | B2-B2 | B2-D3 |
| X-10 | Expo response not checked. The push token is logged on network failure. | — | — | Out of scope; separate fix proposed | PA |
| X-11 | Push tokens are never deleted (logout, deletion; no foreign key). A shared device can receive another account's pushes. Rows survive deletion although E-4 says *"all your data … has been erased"*. | Yes | Yes | **Out of NEM-025 scope.** Privacy fix needs its own mission. | PO/PA |

---

## 3. B2-A engineering specification: email localization

### 3.1 Structure (proposed)

```
services/api/src/email/
  email.service.ts          # transport + send(); public method signatures keep (to, …, lang?)
  locale.ts                 # resolveMessageLocale(); EmailLocale = UiLocale; HTML_LANG map
  escape.ts                 # esc(): Escaped (branded type); escape() behaviour byte-identical
  copy/
    types.ts                # EmailCopy interface — every string or (Escaped, …) => string
    es.ts  en.ts  fr-ca.ts  # one dictionary per locale; `satisfies EmailCopy`
  templates/
    layout.ts               # shared shell (header, footer, button, link fallback) — ES/EN byte-identical
    confirmation.ts … plan-invite.ts   # 8 pure functions (copy, escapedVars) => html
tests/unit/email/            # mirrors src/email (CLAUDE.md rule); golden master + parity + locale tests
```

### 3.2 Rules

1. **Parity enforced by types.** `EmailCopy` is an explicit interface, so a missing key in any dictionary fails `tsc`. A parity test also walks the three dictionaries, matching the existing web/mobile approach.
2. **Escaping enforced by types.** Copy functions accept only `Escaped` arguments for user-supplied values (names, gift message, occasion label, plan name, recipient email). Subjects take **raw** values through separate subject builders. During B2-A1 those builders keep today's escaping exactly; only B2-A2 may change it (X-5).
3. **No user value in an HTML attribute.** Links are built from server-generated tokens and `WEB_URL` only, as today. The waitlist link keeps `encodeURIComponent`.
4. **`<html lang>` uses a constant map:** `{es:'es', en:'en', 'fr-CA':'fr-CA'}`. The stored value is never used (fixes X-4's attribute issue). Valid ES/EN output is unchanged.
5. **One resolver, `resolveMessageLocale(stored, env)`, shared by email and push.**
   - `es` and `en` pass through.
   - `fr-CA` passes only when `isFrenchUiEnabled(env)` **and** a second constant, `FR_CA_TRANSACTIONAL_READY`, is true in code. That constant ships `false` and is flipped only after linguistic sign-off (§7).
   - Every other value, including `null`, legacy strings and `fr-CA` while gated, returns the B2-D4 fallback.
6. **Callers stop casting.** They pass `user.uiLanguage` raw to the resolver. For the three callers that pass a language today (E-2, E-3, E-4), output is unchanged for `es`/`en`.
7. **No silent fallback for a French security email (E-1, E-2, E-3, E-4).** When the resolver returns `fr-CA` and a template key is missing, typing makes that impossible at compile time. A runtime test also asserts that the French template was used.

### 3.3 Golden master: exact EN/ES regression evidence

- **Commit 1 runs on unchanged code.** A spec calls each of the 8 public methods with `nodemailer` mocked and the clock frozen (`jest.useFakeTimers().setSystemTime('2026-01-01')`). It records `{from, to, subject, html}` for ES and EN, plus the default (no `lang`) call. The snapshot is committed before any refactor, as in B1-A and B1-B.
- **Fixture set: about 42 snapshots.**
  - One base case per template: 8 cases × 2 languages, plus the no-`lang` default.
  - Gift card variants: message ±, occasion ±, 1 and 3 tokens.
  - Gift confirmation: 1 and 3 tokens.
  - An **escaping fixture** for every template with user values (`name = 'A & <b>"x"</b>'`, message with `<script>`), proving escaping is identical.
- **Pass criterion for B2-A1:** byte-identical snapshots, no exceptions. Every snapshot change belongs to B2-A2 and is listed entry by entry, following the B1 precedent of IDs S-n/E-n for changed ES/EN entries.
- **PR #66 overlap.** #66 rewrites `tests/unit/auth/email.service.spec.ts`, which today sits at a non-mirrored path. B2-A adds `tests/unit/email/*` and must not edit #66's file until #66's fate is decided (§7).

### 3.4 Caller and DTO changes

Each change is listed with the decision that unlocks it.

| Change | Flows | Unlocked by | Schema? |
|---|---|---|---|
| `RegisterDto.uiLanguage?`: `@IsIn(SUPPORTED_UI_LOCALES)` plus the controller's `selectableUiLocales()` check; persisted at `usersService.create`; used for E-1. Web and mobile register pages send their current locale. | E-1 (X-1) | B2-D2 | No |
| OAuth: carry the locale. Options: (a) the OAuth `state` round-trip; (b) the client PATCHes its locale once after a **first** OAuth sign-in, which requires an `isNewUser` flag in the auth response; (c) leave as is. **Recommendation: (b).** No token or callback change; the PATCH path and its validation already exist. | Client language after OAuth sign-up (no email is sent for OAuth today) | B2-D2. **PA approval required:** touches the auth response (F-B1B-1 boundary). | No |
| Gift checkout DTO `locale?` (validated), stored in Stripe `metadata.locale`. `fulfillGift` uses it for E-8 when there is no `buyerUserId`, and for E-7 per B2-D1. | E-7, E-8 | B2-D1, B2-D2, **B2-D6** (PR #60 conflict) | No |
| `inviteUser`: pass the owner's `ui` for E-9 per B2-D1 | E-9 | B2-D1 | No |
| `JoinWaitlistDto.locale?` for E-5 | E-5 | B2-D1 | No |
| Locale for E-6, the later admin invite: a `waitlist_entries.locale` column | E-6 | B2-D1 **plus separate schema approval** | **Yes (protected)** |
| Optional lookup of the recipient account's `ui` by email (E-7, E-9) | E-7, E-9 | B2-D1 | No |

### 3.5 Tests (B2-A)

All tests mock nodemailer and send no network traffic.

- Golden master (§3.3).
- Dictionary parity and typography: no `...` (use `…`), the French non-breaking-space convention from terminology guide PR #79, no `!` or `¡` in errors.
- Resolver matrix: es, en, fr-CA × gate on/off × ready true/false, legacy `'pt'`, `'EN'`, `'"><'`, `null`.
- French selected for each of the 8 templates only when the gate is on and ready is true. Security emails never fall back while French is selected.
- `<html lang>` is always canonical.
- Registration DTO accepts and rejects the right values, including `fr-CA` while gated.
- Password-reset enumeration silence unchanged.
- Deletion still proceeds when the send fails.

### 3.6 STOP conditions (B2-A)

STOP and report if any of the following happens:

- a golden-master byte differs in B2-A1;
- a change requires a migration not separately approved (E-6);
- implementation must alter webhook fulfilment, exactly-once semantics or transaction boundaries in `fulfillGift` (PR #60 territory);
- the auth response or token lifecycle must change beyond the approved OAuth option;
- French copy for E-1, E-3 or E-4 lacks linguistic sign-off when the ready constant would be flipped;
- E-4's data-erasure claim must be translated before X-11 is resolved or legally reviewed.

---

## 4. B2-B engineering specification: push and readiness

### 4.1 Push message selection (proposed)

- **Typed push types.** `PushType = 'invite_accepted' | 'gift_claimed' | 'club_new_book' | 'club_nearby_comment' | 'club_session_scheduled'` replaces `type: string` at all 5 callers. `buildContent` becomes an exhaustive switch over `PushType` with **no default branch**, so a new type without copy fails `tsc`.
- **Unknown types fail closed.** If an unknown type ever arrives at runtime, the service doesn't send and logs the type only, never tokens.
- **Dictionaries.** `push/copy/{es,en,fr-ca}.ts` with `satisfies PushCopy`, and locale from the shared `resolveMessageLocale`.
- **Vars are plain text.** Push has no HTML. Admin-supplied `title` (P-5) is truncated to a fixed length if used at all (B2-D3).
- **`data` for P-3, P-4 and P-5** becomes `{ type, clubId, … ids }` with IDs only and no user content. The mobile tap handler is a no-op today, so there is no client change.

### 4.2 Regression requirements

- **Golden master (commit 1, unchanged code).** Mock `fetch` and record the exact Expo JSON body for P-1 and P-2 in ES and EN (P-2 with n = 1 and 3). It must be byte-identical after the refactor.
- **The P-3, P-4 and P-5 body change is intentional.** Their current payload (`{title:'Noetia', body:'', data:{}}`) is snapshotted, then replaced as a listed change under B2-D3.
- **Invariant test:** for every `PushType` × locale, `title` and `body` are non-empty.
- **Gate tests:** `fr-CA` copy only when the gate is on and ready is true; `fr-CA` with the gate off falls back per B2-D4.
- **No real delivery:** the global `fetch` mock asserts no call to `exp.host`.

### 4.3 Proposed copy for the empty-body types

For PO decision B2-D3. Generic copy, no user content.

| Type | ES (proposal) | EN (proposal) | fr-CA (draft, needs human review) |
|---|---|---|---|
| `club_new_book` | Nuevo libro en tu club · Tu Club de Lectura empezó un nuevo libro. | New book in your club · Your reading club started a new book. | Nouveau livre dans votre club · Votre club de lecture a commencé un nouveau livre. |
| `club_nearby_comment` | Nuevo comentario cerca de ti · Alguien comentó cerca de donde vas leyendo. | New comment near you · Someone commented near where you're reading. | Nouveau commentaire près de vous · Quelqu'un a commenté près de votre passage. |
| `club_session_scheduled` | Nueva sesión programada · Tu club programó una sesión de Escucha Juntos. | New session scheduled · Your club scheduled a listening session. | Nouvelle séance prévue · Votre club a prévu une séance d'écoute. |

The fr-CA column is a draft only. Register (*vous* vs *tu*) and terms follow terminology decisions D-T1–D-T6 (PR #79), which are still open.

### 4.4 Integration conditions for French readiness

| Area | Condition before French can be activated | Current state | Owner |
|---|---|---|---|
| Web gate `NEXT_PUBLIC_FR_CA_ENABLED` | B1-A merged into the release branch; B1-A limitations L-1 to L-9 closed or accepted | B1-A accepted, Draft | PO |
| Mobile gate `EXPO_PUBLIC_FR_CA_ENABLED` | B1-B accepted; runtime navigation-state check on device (B1-B R-4); **requires an app build or OTA**, which is a separate authorization | B1-B awaiting PA | PO |
| API gate `FR_CA_ENABLED` | B2-A and B2-B merged; `FR_CA_TRANSACTIONAL_READY` true after sign-off | Gate closed; ready constant doesn't exist yet | PO |
| **Gate order** | The **API gate must open first** (or together). Otherwise a client with French on sends `PATCH uiLanguage=fr-CA`, the API rejects it with 400 (swallowed), and the next load reverts the user to `es` via `resolveServerLanguage`. Turning a gate off later is safe: clients map a stored `fr-CA` to `es` (Checkpoint A), and messages fall back per B2-D4. | Verified by code reading | PA |
| API language validation | `@IsIn` plus the gate (done in A); add the same to `RegisterDto` and the checkout/waitlist DTOs | Partly done | B2-A |
| Registration and confirmation | X-1 fixed (local and OAuth) so the first email and the stored preference match the interface | Open | B2-D2 |
| Password recovery and deletion | French E-3 and E-4 reviewed. E-4's erasure claim reconciled with X-11 or legally reviewed. | Open | B2-D5 |
| Gifts, plan invitations, notifications | B2-D1 policy; PR #60 integration (B2-D6); occasion labels in three languages; push P-1 to P-5 non-empty | Open | PO |
| Human Canadian-French review | Native fr-CA reviewer signs off email, push and UI dictionaries (see §10) | No reviewer | PO |
| French legal consent | Consent stays bilingual ES/EN (B1-B decision); legal French translation is a separate PO decision. **French activation is blocked until it is resolved.** | Blocked | PO + legal |
| Billing and USD display | USD-only plus informational FX (PO final, PR #76); billing localization depends on PR #60 (B1-A L-items) | Open | PO |
| SEO and accessibility | B1-A SEO option undecided; `<html lang>` correct on web (A); email `lang` canonical (B2-A) | Open | PO |
| CI and branches | CI runs only on PRs into `main`, so stacked #78, #80, #81 and any B2 PR get no CI. The mobile and web coverage gates fail on `main` (pre-existing). A merge plan is needed before activation. | Open | PA |

---

## 5. Existing-language regression strategy

1. **Capture before change.** The first commit of B2-A and of B2-B adds golden-master snapshots on unchanged code. That commit's diff contains only tests.
2. **Pure refactor phases (B2-A1, B2-B1)** must keep every ES/EN snapshot byte-identical. The French dictionaries can be added, but the ready constant stays `false`, so production output can't change.
3. **Behaviour-change phases (B2-A2, B2-B2)** contain only PO-approved corrections, each with:
   - an ID (X-n);
   - before and after snapshots;
   - the user groups affected.
4. **Gate-off proof.** With `FR_CA_ENABLED` unset, `'TRUE'`, `'1'` or `' true'`, no email or push contains French. The test uses the same value set as B1-B.
5. **No production effect before release.** All work stays in Draft PRs stacked on #78; nothing reaches `main` without a separate merge authorization.

---

## 6. Security and privacy analysis

| Risk | Analysis | Design control |
|---|---|---|
| HTML injection in email | User values: names, gift message, occasion label, plan name, recipient email. Today all are text-node only and escaped for `&<>`. French adds `’`, `«»` and non-breaking spaces in **copy**, not in user values. | `Escaped` branded type; no user value in attributes; escaping golden-master fixtures; `<meta charset="UTF-8">` kept. |
| Header injection (subject) | Subjects contain buyer and inviter names and the recipient email. Nodemailer encodes header values. Name length limits at every entry point were **not verified** (the gift buyer name comes from Stripe). | Subject builders take raw strings; test with CR/LF in names, which must not produce extra headers. |
| Stored language as an attack vector | Legacy free-form `uiLanguage` reaches `<html lang>` (X-4). It affects only the user's own email, so impact is low. | Constant `HTML_LANG` map; resolver allowlist. |
| Account enumeration | E-3 is silent for unknown emails and OAuth accounts. | No change to branching. Test that the response and the "no email sent" behaviour are identical. |
| Secrets in links | Confirmation, reset, claim and invite tokens appear in URLs, as today. | No change. Tests assert tokens never appear in logs. |
| PII in logs | X-8 (recipient email) and X-10 (push token) are pre-existing. | Out of scope; listed for a separate fix. B2 must not add new PII logging. |
| Lock-screen disclosure | Push bodies are visible without unlocking. | Generic club copy; no comment text; session title optional and truncated (B2-D3). |
| Cross-account push | X-11: a shared device keeps every account's token. | **Not fixed by B2.** Recommend a separate privacy mission (deregister on logout, cascade on deletion). |
| Deletion claim | E-4 says all data is erased, while push tokens remain (X-11). Other residues, such as Stripe customer and gift rows, are tracked elsewhere (ToS audit). | French E-4 must not repeat the claim until legal review (B2-D5). |
| Recipient lookup by email (E-7, E-9) | Uses the recipient account's language. The sender learns nothing, because the email isn't shown to them. | Lookup result never returned to the caller. |
| External services | Email goes through Resend SMTP (configured) and push through Expo's free public endpoint. No new vendor or credential. | Tests mock both. No sends during preparation or tests. |

---

## 7. Dependencies and integration order

| Dependency | Interaction with B2 | Proposed handling |
|---|---|---|
| **PR #78** (Checkpoint A) | Provides `ui-locale.ts` and the API gate | B2 branches stack on #78 (like B1-A and B1-B) |
| **PR #60** (payments) | Rewrites `fulfillGift` into a post-commit closure and changes `subscriptions.service.ts` heavily (+660). Conflicts with the E-7, E-8 and E-9 caller changes. | **B2-D6.** Recommendation: B2-A1 (template refactor, signatures unchanged) needs no change in `gifts` or `subscriptions`, so it can go ahead independently. B2-A2's caller changes for E-7, E-8 and E-9 wait for #60's final shape, or are written as a patch on top of #60. |
| **PR #66** (EmailService tests) | Its test file sits at `tests/unit/auth/email.service.spec.ts`. B2 adds `tests/unit/email/` (correct mirror). | Don't edit #66's file. If #66 merges first, its assertions must keep passing (B2-A1 is byte-identical). If B2 merges first, #66 needs a rebase only, with no semantic conflict. |
| **PR #75** (addresses) | `hola@noetia.app` is hard-coded in E-8 in both languages | Put the support address in a single constant in B2-A1, keeping the **current value**. Changing it waits for the #75 decision. |
| **PR #69** (react-test-renderer) | Not needed by B2 (API only) | None |
| **#79 terminology** D-T1–D-T6 | French copy depends on them | French dictionaries are drafts until those decisions are made |

**Proposed order** (each step needs its own PO instruction):

1. **B2-A1:** email golden master and refactor, with French dictionaries inert.
2. **B2-B1:** push golden master and typed refactor, with French inert.
3. **B2-B2 and B2-A2:** approved corrections, the latter after the B2-D6 resolution.
4. **Linguistic review.**
5. **Flip the ready constant.**
6. **Activation checklist (§9).**

---

## 8. Product decisions awaiting approval

**Approved inputs used here:**

- **APPROVED (PO final, PR #76/#77):** locales en, es, fr-CA; USD-only with informational FX.
- **APPROVED (PA/PO, B1-B):** consent stays bilingual ES/EN with no French legal translation.
- Everything below is a **recommendation only**.

### B2-D1: Language for known users and non-users

| Option | Description | Risk |
|---|---|---|
| A | Known users: their `ui`. Non-users: the **sender's** locale (buyer, inviter, form locale for waitlist). | A recipient with a different language gets the sender's. Usually correct, since sender and recipient often share a language. |
| B | Known users: `ui`. Non-users: the default (`es`) always. | EN and FR senders' friends get Spanish (today's behaviour). |
| C | Non-users: a bilingual or trilingual email | Long emails. Security wording repeated in three languages. Harder review. |
| D | A, plus a recipient-account lookup by email (account `ui` wins over the sender's locale) | One extra query. Privacy acceptable (§6). |

**Recommendation: D.** For E-6 (later waitlist invite), use the language captured at sign-up only if the schema change is separately approved. Otherwise keep today's Spanish.

### B2-D2: Correct existing EN/ES language defects?

The defects are X-1, X-2, X-5 and X-6. Option A corrects them in B2-A2. Option B keeps today's behaviour. Option C corrects only X-1 and X-2.

**Recommendation: A.** Each correction is listed with before and after snapshots. The OAuth part of X-1 needs PA approval because it touches the auth response.

### B2-D3: Correct the three empty-body push types?

| Option | Description |
|---|---|
| A | Generic copy (§4.3) plus ID-only `data` |
| B | Copy naming the club or book (more useful; lock-screen disclosure risk for private clubs) |
| C | Stop sending those types until designed |
| D | Leave empty (today) |

**Recommendation: A.** Never include comment text. Don't format session times.

### B2-D4: Unknown, invalid or gated language preferences

| Option | Description |
|---|---|
| A | Fall back to `es`, matching today's behaviour and Checkpoint A's client `resolveServerLanguage` (a supported but disabled value maps to `es`) |
| B | Fall back to `en` for a stored `fr-CA` when French is gated |
| C | Don't send |

**Recommendation: A.** It keeps clients and messages consistent. C is unsafe for security emails. Also run a **one-time read-only count of production `uiLanguage` values** before activation (PO-run, `SELECT "uiLanguage", COUNT(*) … GROUP BY 1`) to size X-4. No data change is proposed.

### B2-D5: French sensitive messages and release prerequisites

Sensitive messages are E-1, E-2, E-3 and E-4, plus commerce emails E-7, E-8 and E-9.

- **Recommendation:**
  - native Canadian-French human review of all email and push copy;
  - legal review of E-4's erasure wording (or a rewording that makes no erasure claim) before the ready constant is flipped;
  - French activation additionally blocked by the consent legal translation decision.
- **Alternative:** machine-drafted French with no human review. **Not recommended** for security or legal emails.

### B2-D6: Integration with pending email and commerce PRs

| Option | Description |
|---|---|
| A | B2-A1 independent now; B2-A2's gift and invite callers after #60 settles |
| B | Stack B2 on #60 |
| C | Wait for #60 to merge before any B2 |

**Recommendation: A.**

- #66: keep it independent; byte-identical B2-A1 keeps its assertions valid.
- #75: single-constant address keeping the current value.

---

## 9. Readiness and STOP checklist

### Fail-closed activation checklist

Every item must be ✅ before any French gate is set to `'true'` in any environment.

1. ☐ B2-A1 and B2-B1 golden masters byte-identical; B2-A2 and B2-B2 changes PO-approved and listed.
2. ☐ All 8 email templates and 5 push types have fr-CA copy; parity tests green; no empty push body for any type × locale.
3. ☐ Native fr-CA reviewer sign-off recorded in GitHub (email, push, web, mobile dictionaries).
4. ☐ Legal: E-4 wording reviewed; consent French translation decided; Terms gate for payments unchanged.
5. ☐ X-1 corrected: registration (local and OAuth) stores the interface locale.
6. ☐ B2-D1, B2-D3 and B2-D4 decided and implemented; PR #60 integration settled (B2-D6).
7. ☐ Production `uiLanguage` distribution checked (read-only, PO-run).
8. ☐ Gate tests green on API, web and mobile, including the negative values (`'TRUE'`, `'1'`, `' true'`, empty, unset).
9. ☐ Merge plan for #78, #80, #81 and B2 into `main` with CI green (pre-existing coverage gates resolved or explicitly waived by PO).
10. ☐ Mobile: device check of navigation state (B1-B R-4); build or OTA separately authorized.
11. ☐ Activation order: API `FR_CA_ENABLED` and the ready constant first, then web and mobile together; rollback = unset the gates (verified safe, §4.4).
12. ☐ Staging smoke test with sends to test inboxes only. This needs separate authorization; no sends until then.

**STOP conditions for B2 execution:** §3.6 (email) and the push equivalents:

- a golden-master diff in B2-B1;
- copy that requires user content or local times without a B2-D3 decision;
- any need to change mobile notification handling or native config (app build required).

---

## 10. Estimated effort and possible expenses

| Work package | Effort (engineering) | Notes |
|---|---|---|
| B2-A1 email golden master + refactor + inert fr-CA | **M** (≈3–4 days) | About 42 snapshots; 8 templates; resolver |
| B2-A2 email corrections + DTOs (register, checkout, waitlist, invite) | **M** (≈2–3 days), plus rebase effort on #60 | OAuth option (b) about 0.5 day |
| B2-B1 push golden master + typed refactor | **S** (≈0.5–1 day) | |
| B2-B2 empty-body correction + fr-CA push | **S** (≈0.5 day) | |
| Waitlist locale column (only if approved) | **S** + migration review | Protected schema change |
| **Total** | ≈ **6–9 engineering days** | Excludes review cycles |

**Possible expenses** (none incurred; each needs separate PO approval):

- **Human fr-CA review.** Measured volume: about **480 words** of English email copy (64 strings across 8 templates and subjects), plus about **40 words** of push copy, plus the existing UI dictionaries if they are not already reviewed. Professional review at typical per-word rates is in the low hundreds of CAD for transactional copy alone. This is an estimate, not a quote.
- **Legal review** of E-4's French wording and the consent translation: cost unknown; PO and legal decide.
- **Infrastructure:** none. Resend's free tier (3,000 a month, 100 a day) and Expo push are unchanged. Staging test sends count toward the Resend daily limit.

---

## 11. Explicit implementation boundaries

**Allowed by this preparation:**

- this documentation-only Draft PR.

**Not authorized, by this document or by implication:**

- **Code and behaviour:**
  - executing B2-A or B2-B;
  - any change to application code, email templates, push handlers, DTOs, schema, infrastructure, environment flags or dependencies;
  - sending any email or push.
- **Release and environments:**
  - merging, deploying, OTA, app builds or releases;
  - enabling `FR_CA_ENABLED`, `NEXT_PUBLIC_FR_CA_ENABLED` or `EXPO_PUBLIC_FR_CA_ENABLED`.
- **Commerce and legal:**
  - payments, Stripe or CAD conversion;
  - legal-document changes;
  - expenses (reviewers, legal).
- **Other missions:**
  - fixing X-8, X-10 or X-11 (proposed for separate missions);
  - NEM-026 ingestion.

**STOP FOR INDEPENDENT PA REVIEW.**
