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
| PR #81 B1-B mobile | `c4106a2b` (on #78) | Draft, **PA review completed** (F-B2-4). Not merged. |
| PR #60 payment lifecycle | `d8e61e24` (on #59 branch) | Draft. **Touches `gifts.service.ts` (+46/−) and `subscriptions.service.ts` (+660/−).** No change to `email/` or `push/`. |
| PR #66 CI-2 EmailService tests | `9c9e4903` (on main) | Draft. Only `tests/unit/auth/email.service.spec.ts` (+405/−38). |
| PR #75 admin email addresses | `cb953607` (on main) | Draft, docs only (`docs/operations/email-addresses.md`, `TASKS.md`) |

### 1.1 Governance status

Corrected per PA F-B2-4.

- **French legal consent remains blocked.** Consent stays bilingual ES/EN, and no French legal translation is authorized.
- **No French exposure is approved** in any environment. `FR_CA_ENABLED`, `NEXT_PUBLIC_FR_CA_ENABLED` and `EXPO_PUBLIC_FR_CA_ENABLED` stay off.
- **USD remains the only transaction currency.**
- **The informational-FX policy (PR #76) does not authorize implementing currency conversion,** CAD pricing or any FX display.
- **B2-D1 through B2-D6 all remain pending PO approval.** The recommendations in §8 are not decisions.
- B2-A, B2-B and the push-token mission proposed in §6.1 are **not authorized**.

**Checkpoint A facts this design builds on (`services/api/src/users/ui-locale.ts`):**

- `SUPPORTED_UI_LOCALES = ['es','en','fr-CA']` and `DEFAULT_UI_LOCALE = 'es'`.
- `isFrenchUiEnabled()` returns true only when `FR_CA_ENABLED` is exactly `'true'`.
- `selectableUiLocales()` and `normalizeUiLocale()` are the validation helpers.
- `UpdateUserDto.uiLanguage` is `@IsIn(SUPPORTED_UI_LOCALES)`, and the controller rejects `fr-CA` while the gate is off.

**Findings beyond PR #79:**

1. **Registration doesn't record the user's language.** This applies to local registration and, by code reading, to OAuth. The registrant gets Spanish emails (X-1), and by code reading the client switches to Spanish on its next load. The language-provider mount effect on web and mobile treats the server value as authoritative (`resolveServerLanguage`), and a new account's server value is the DB default `'es'`. This hasn't been verified at runtime.
2. **The language cast is unsafe.** The cast `(user.uiLanguage as 'es'|'en')` passes any stored string through. Before Checkpoint A, `UpdateUserDto.uiLanguage` accepted any string of up to 5 characters (`@MaxLength(5)` on `main`'s old DTO), so production may hold values outside `es`/`en`. Those values get a Spanish body with the raw stored value in `<html lang="…">` (X-4).
3. **PR #79's count of affected email flows is low.** #79 §2 says "4 flows ignore the user's language". The verified count is 6 of 9 call sites that pass no language (E-1, E-5, E-6, E-7, E-8, E-9). Only E-8, the logged-in buyer, ignores a language that is actually available.
4. **Push tokens are never removed** (X-11). Logout and account deletion leave them, and the table has no foreign key. A verified path delivers a push to a deleted account's device. See the security and privacy dependency **SP-1** in §6.1. It is not a translation issue and is out of NEM-025 scope.

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
| X-1 | Registration never stores the interface locale. **(a) Local:** E-1 is always ES. **(b) OAuth**, by code reading: the account is created with `es`. In both cases the client switches to ES on its next load. | No | **Yes** | (a) **B2-A2a**; (b) **B2-A2b**, which needs separate PA review and PO authorization | B2-D2 |
| X-2 | Logged-in buyer's gift confirmation (E-8) ignores the buyer's `ui` | No | **Yes** | B2-A2 | B2-D2 |
| X-3 | Non-user flows (E-5, E-6, E-7, E-9) are always ES. A policy gap rather than a code bug. | No | Yes (EN-interface senders) | B2-A2 | B2-D1 |
| X-4 | Unsafe cast. Values outside `es`/`en` get an ES body with the raw value in `<html lang>`. Stored `fr-CA` would produce Spanish under `lang="fr-CA"`. | Edge | Edge | **N-1**, an intentional, separately tested correction (§3.3.1). Not covered by the byte-identical requirement. | B2-D4 |
| X-5 | Subjects HTML-escape names (E-7, E-9). A name containing `&` shows as `&amp;` in the subject line. | Yes | Yes | B2-A2 (listed change) | B2-D2 |
| X-6 | Spanish-only fallbacks and labels inside EN emails (`Alguien`, `Un usuario`, `lector/a`, occasion labels) | No | **Yes** | B2-A2 | B2-D2 |
| X-7 | `escape()` doesn't escape quotes. **Not a live defect**: every user value lands in a text node today. The design forbids user values in attributes. | — | — | B2-A1 constraint | — |
| X-8 | A failed send logs the recipient email address (CLAUDE.md: never log user PII) | — | — | Out of scope; separate fix proposed | PA |
| X-9 | Push P-3, P-4 and P-5 send title `Noetia` with an **empty body** and no `data` | Yes | Yes | B2-B2 | B2-D3 |
| X-10 | Expo response not checked. The push token is logged on network failure. | — | — | Out of scope; separate fix proposed | PA |
| X-11 | Push tokens are never deleted (logout, deletion; no foreign key). Verified and possible consequences are separated in §6.1. | Yes | Yes | **Out of NEM-025 scope.** Dependency SP-1; separate mission (§6.1). | PO/PA |

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
- **Scope of the byte-identical requirement** (F-B2-2): it covers **valid existing ES/EN behaviour**, meaning calls with `lang` = `es`, `en`, or omitted, and stored `uiLanguage` of `es` or `en`. Legacy or invalid stored values are excluded and handled by correction N-1 (§3.3.1).
- **Pass criterion for B2-A1:** byte-identical snapshots for every valid ES/EN case, no exceptions. Every snapshot change belongs to B2-A2 and is listed entry by entry, following the B1 precedent of IDs S-n/E-n for changed ES/EN entries.
- **PR #66 overlap.** #66 rewrites `tests/unit/auth/email.service.spec.ts`, which today sits at a non-mirrored path. B2-A adds `tests/unit/email/*` and must not edit #66's file until #66's fate is decided (§7).

### 3.3.1 Intentional correction N-1: legacy and invalid language normalization

This is an **intentional behaviour change**. It is outside the byte-identical requirement and is tested separately. It is listed in the PR as N-1 with before and after snapshots.

**Inputs:**

- a stored `uiLanguage` other than `es`/`en`, such as `'pt'`, `'EN'`, `'fr'` or `'"><'`, possible from the pre-Checkpoint-A DTO;
- a stored `fr-CA` while the gate or the ready constant is off;
- `null` (DB default protects new rows, but the case is tested anyway).

**Today** (E-2, E-3, E-4; P-1, P-2 for push): Spanish body, with `<html lang>` set to the **raw stored value**. For example, `'pt'` gives `<html lang="pt">`, `'EN'` gives `lang="EN"` (Spanish body, because the comparison is case-sensitive), and stored `fr-CA` gives `lang="fr-CA"` over Spanish text.

**After N-1:**

- Body: the B2-D4 fallback (recommended `es`, which keeps body text identical to today for these users).
- `<html lang>` comes from the constant map. Under fallback `es` it becomes **`lang="es"`**.

**Expected output diff:** under the recommended fallback, **only the `lang` attribute changes**. If the PO chooses a different fallback, the body changes too, and that is listed.

**Tests (separate from the golden master):**

- one fixture per invalid input class, asserting the new canonical `lang` and the fallback body;
- a test proving no raw stored value appears anywhere in the HTML;
- push: the fallback copy for the same inputs (push has no `lang` attribute).

**Measure first:** before implementation, the PO runs the read-only production count of `uiLanguage` values (§8, B2-D4) to size how many users N-1 affects.

### 3.4 Caller and DTO changes

Each change is listed with the decision that unlocks it.

| Change | Flows | Unlocked by | Schema? |
|---|---|---|---|
| **B2-A2a, local registration language propagation.** `RegisterDto.uiLanguage?`: `@IsIn(SUPPORTED_UI_LOCALES)` plus the controller's `selectableUiLocales()` check; persisted at `usersService.create`; used for E-1. Web and mobile register pages send their current locale. Optional field, so older clients are unaffected. | E-1 (X-1a) | B2-D2 | No |
| **B2-A2b, OAuth language initialization.** **Not part of the email-localization authorization** (F-B2-3). Options: (a) the OAuth `state` round-trip; (b) the client PATCHes its locale once after a **first** OAuth sign-in, which requires an `isNewUser` flag in the auth response; (c) leave as is. Options (a) and (b) change the OAuth response or authentication contract, so each **needs separate PA review and separate PO authorization**. Approving B2-A or B2-D2 does not authorize B2-A2b. The analysis leans to (b) as the smallest change, but that is not a recommendation for authorization. | Client language after OAuth sign-up (OAuth sends no email today) | **Separate PA review + PO authorization** | No |
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
- any change to the auth response, OAuth flow or token lifecycle becomes necessary. B2-A2b is never implied by a B2-A authorization;
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
2. **Pure refactor phases (B2-A1, B2-B1)** must keep every **valid** ES/EN snapshot byte-identical. Invalid or legacy stored languages are covered by N-1 (§3.3.1). The French dictionaries can be added, but the ready constant stays `false`, so production output can't change.
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
| Cross-account and post-deletion push | X-11; verified delivery after deletion (V-9); possible cross-account delivery (C-1) | **Not fixed by B2.** Dependency SP-1 (§6.1). |
| Deletion claim | E-4 says all data is erased, while push tokens remain (X-11). Other residues, such as Stripe customer and gift rows, are tracked elsewhere (ToS audit). | French E-4 must not repeat the claim until legal review (B2-D5). |
| Recipient lookup by email (E-7, E-9) | Uses the recipient account's language. The sender learns nothing, because the email isn't shown to them. | Lookup result never returned to the caller. |
| External services | Email goes through Resend SMTP (configured) and push through Expo's free public endpoint. No new vendor or credential. | Tests mock both. No sends during preparation or tests. |

---

### 6.1 Security and privacy dependency SP-1: push-token lifecycle (X-11)

Added per PA F-B2-1. All findings are from code inspection at `81143790`. Nothing was executed against any environment.

**Verified by code inspection:**

| # | Area | Verified fact | Location |
|---|---|---|---|
| V-1 | Registration | `POST /push/register` (JWT) upserts `(userId = caller, token, platform)` with conflict on `(userId, token)`. The token string isn't validated, and other users' rows for the same token are not checked or removed. | `push.controller.ts:9-17`, `push.service.ts` `registerToken` |
| V-2 | Ownership model | Uniqueness is per `(userId, token)`, not per `token`, so **one device token can belong to several accounts at once**. | migration `1714000000045` `UQ_push_tokens_user_token` |
| V-3 | Client registration | Mobile registers on every `MainNavigator` mount after permission is granted. There is no unregister call anywhere in mobile. | `usePushNotifications.ts:15-27` |
| V-4 | Logout | Mobile `logout` calls `POST /auth/logout`, which deletes only the refresh token. It then clears local auth storage. **Push tokens are untouched** on client and server. | `AuthContext.tsx:18-24`, `auth.controller.ts:117-128`, `token-storage.ts:29-31` |
| V-5 | Account switch | After A logs out and B logs in on the same install, B's mount registers `(B, token)`. `(A, token)` remains. | V-1 + V-4 |
| V-6 | Deletion | `deleteAccount` deletes `user_books`, `token_ledger`, `user_cause_preferences`, `courtesy_token_quotas`, `subscriptions` and `waitlist_entries`, then the user row. **It doesn't delete `push_tokens`.** | `users.service.ts:54-76` |
| V-7 | Foreign key / cascade | `push_tokens.userId` has **no foreign key** (migration 045; entity has no relation), so rows survive deletion. By contrast, `club_members.userId` has `ON DELETE CASCADE` and `subscriptions.userId` has `ON DELETE CASCADE`. | migrations `045`, `047`, `009` |
| V-8 | Send path | `sendToUser(userId)` selects tokens by `userId` only and sends even when the user row is missing. Language defaults to `es`. | `push.service.ts` `sendToUser` |
| V-9 | **Reachable delivery after deletion** | `gift_cards.buyerUserId` has **no foreign key** (migration 043) and survives the buyer's deletion. When the recipient later claims the gift, `claimGift` calls `sendToUser(gift.buyerUserId, 'gift_claimed')`. Per V-7 and V-8, the deleted buyer's orphaned tokens are found and **a push is sent to the deleted account's device(s)**. | `gifts.service.ts:128-163`, migration `043` |
| V-10 | Paths **not** reachable after deletion | Club pushes (P-3 to P-5) select recipients from `club_members` (cascade-deleted). `invite_accepted` (P-1) targets `subscriptions.userId` (deleted explicitly and cascaded). | V-7 |
| V-11 | Delivery errors | The Expo response isn't inspected, so `DeviceNotRegistered` never prunes a token (X-10). | `push.service.ts` `sendExpo` |
| V-12 | Other residue | `gift_cards.buyerEmail`, `recipientEmail`, `buyerUserId` and `claimedByUserId` are not deleted or anonymized on account deletion. | migration `043`, `users.service.ts` |

**Possible consequences.** These depend on platform behaviour or runtime conditions and were not verified in this repository.

| # | Consequence | Depends on |
|---|---|---|
| C-1 | **Account switching:** pushes meant for A are shown on the device now used by B. Today that would be P-1 (plan name), P-2 (token count) and, once B2-D3 adds copy, club notifications that could reveal A's club activity to B. | The Expo push token being the same for both accounts on one install. Expo documents it as per-installation, but that wasn't tested here. |
| C-2 | After deletion, a former user who still has the app installed receives *"¡Regalo reclamado!"* (V-9). | The app is still installed with the token valid; a gift bought before deletion is later claimed. |
| C-3 | The token keeps working after logout (no switch): the logged-out device keeps receiving that account's pushes. | Token validity; no switch needed. |
| C-4 | Token hijack: an authenticated user registers another person's Expo token string (V-1) and thereby directs their own notifications to that device. The victim's notifications are not exposed. | Knowing the victim's token. Low impact. |

**Implications for E-4's data-erasure claim.** E-4 tells the user (ES/EN) that *all your data — fragments, library and preferences — has been erased from our systems*.

- V-6, V-7 and V-12 show that push tokens (device identifiers linked to the former user ID) and gift records with email addresses remain.
- V-9 shows the system can still **act on** the deleted account.

The existing ES/EN claim is therefore **not fully accurate today** (pre-existing; not introduced by NEM-025). Consequences for B2:

- B2-A1 must reproduce E-4's ES/EN text byte for byte. It does not fix or worsen the claim.
- **French E-4 must not be released** with an equivalent erasure claim until SP-1 is fixed or legal approves wording (B2-D5).
- Rewording ES/EN E-4 is a **legal/PO decision**, not part of B2.

**Recommended separate mission:** for example *"Push-token lifecycle and deletion residue: diagnostic and remediation"*, bounded to:

- **Diagnostic (read-only):** a PO-run count of orphaned `push_tokens` (no matching user) and of tokens shared by more than one `userId`; confirm C-1 on a test device.
- **Remediation options** for that mission's PA and PO to decide:
  - delete the token on logout (new authenticated endpoint plus a mobile call, which needs an app build or OTA);
  - on register, delete other users' rows for the same token (last registrant owns the device);
  - delete `push_tokens` in `deleteAccount`, and/or add a foreign key with cascade through a corrective migration (protected schema change);
  - skip the send when the user row is missing;
  - prune on `DeviceNotRegistered`.
- **Out of scope for that mission unless separately decided:** E-4 wording, gift-record anonymization (V-12).

**Not implemented under NEM-025.** SP-1 is a dependency of B2-B2 (club copy increases C-1 exposure) and of French E-4.

## 7. Dependencies and integration order

| Dependency | Interaction with B2 | Proposed handling |
|---|---|---|
| **PR #78** (Checkpoint A) | Provides `ui-locale.ts` and the API gate | B2 branches stack on #78 (like B1-A and B1-B) |
| **PR #60** (payments) | Rewrites `fulfillGift` into a post-commit closure and changes `subscriptions.service.ts` heavily (+660). Conflicts with the E-7, E-8 and E-9 caller changes. | **B2-D6.** Recommendation: B2-A1 (template refactor, signatures unchanged) needs no change in `gifts` or `subscriptions`, so it can go ahead independently. B2-A2's caller changes for E-7, E-8 and E-9 wait for #60's final shape, or are written as a patch on top of #60. |
| **PR #66** (EmailService tests) | Its test file sits at `tests/unit/auth/email.service.spec.ts`. B2 adds `tests/unit/email/` (correct mirror). | Don't edit #66's file. If #66 merges first, its assertions must keep passing (B2-A1 is byte-identical). If B2 merges first, #66 needs a rebase only, with no semantic conflict. |
| **PR #75** (addresses) | `hola@noetia.app` is hard-coded in E-8 in both languages | Put the support address in a single constant in B2-A1, keeping the **current value**. Changing it waits for the #75 decision. |
| **SP-1** push-token lifecycle (§6.1) | Cross-account and post-deletion delivery; E-4 claim | Separate mission. Recommended before B2-B2's club copy ships and before French E-4. |
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

**Recommendation: A.** Each correction is listed with before and after snapshots. Scope of the X-1 correction:

- **B2-A2a (local registration)** falls under this decision.
- **B2-A2b (OAuth language initialization) does not.** It changes the authentication contract and needs its own PA review and PO authorization.

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
4. ☐ Legal: E-4 wording reviewed; consent French translation decided (**blocked today**); Terms gate for payments unchanged.
4a. ☐ SP-1 push-token lifecycle remediated, or the PO and PA explicitly accept the residual risk.
5. ☐ X-1 corrected:
   - local registration (B2-A2a);
   - OAuth initialization (B2-A2b, separately reviewed and authorized), or the PO explicitly accepts OAuth sign-ups starting in `es`.
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
| B2-A2a local registration + other email corrections + DTOs (register, checkout, waitlist, invite) | **M** (≈2–3 days), plus rebase effort on #60 | |
| B2-A2b OAuth language initialization (only if separately authorized) | **S** (≈0.5–1 day) + PA review | Auth-contract change |
| SP-1 push-token lifecycle mission (separate, §6.1) | **S–M** (≈1–3 days) | Not NEM-025 |
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
  - fixing X-8, X-10 or X-11 / SP-1 (proposed for separate missions);
  - B2-A2b OAuth language initialization (needs its own PA review and PO authorization);
  - currency conversion or CAD display (informational FX is a policy, not an authorization).
  - NEM-026 ingestion.

---

## 12. PA follow-up corrections (2026-11-23)

| Finding | Where addressed |
|---|---|
| F-B2-1 push-token lifecycle | §6.1 (SP-1: V-1…V-12 verified, C-1…C-4 possible, E-4 implications, separate mission); §1 item 4, X-11, §6, §7, §9 item 4a, §10 |
| F-B2-2 email compatibility exception | §3.3 scope bullet; §3.3.1 N-1; X-4 row; §5 item 2 |
| F-B2-3 local vs OAuth | §3.4 rows B2-A2a / B2-A2b; X-1 row; §3.6; B2-D2; §9 item 5; §10; §11 |
| F-B2-4 governance | §1 table (#81 PA review completed); §1.1 governance status; §11 |

Documentation only. No application code, migrations, dependencies, notification delivery, deployment, payment changes, expenses or gate activation.

**STOP FOR INDEPENDENT PA RE-REVIEW.**
