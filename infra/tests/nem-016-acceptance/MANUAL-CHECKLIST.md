# NEM-016 manual acceptance checklist

These checks can't be automated, or need access the harness deliberately doesn't have. Record each result in the file from `acceptance.mjs manual-template`, then run `merge-manual`. Every PASS, FAIL or BLOCKED needs an evidence note saying what was seen, on what, and when. Don't put credentials or personal data in a note.

Use the synthetic accounts from the harness run and the existing staging fixture. **Don't start until the Product Owner has authorized staging execution.**

## Web (browser, behind the staging basic auth)

| Check | Steps | Expected |
|---|---|---|
| A2.card | Open the Q1, Q2 and Q3 card images | Each card shows the quoted text |
| A3.web | In the share modal, edit the text to `leyó rápido cada línea` and share | Shows "doesn't match the book's wording"; no card is produced |
| A4.card | Open the Q5 card image | Shows `[…]`, not `[...]` |
| A5.client (web part) | In the modal, try N4 (bare `…`) and N5 (omission dropping a negation) | The omission-specific messages appear, not a generic error |
| A6.card | Open the `A6-data` and `A6-preset` cards | The chosen background is used, not the navy fallback; the watermark is unchanged |
| A9.client | On one card: Download, Copy link, Publish dialog | The same `/s/<id>` every time |
| A14b.web | Local only. BLOCKED on staging, where the fixture must not be deleted | — |

## Mobile (A16, A5 mobile part)

Use a dev or Expo build with `EXPO_PUBLIC_API_URL=https://staging.noetia.app/api`. Sharing itself runs against staging; no store build or OTA update is needed or authorized.

| Check | Device | Expected |
|---|---|---|
| A16.android | Android | "Open image" opens the PNG; the share message has the text and the `/s/` link; refusal messages appear |
| A16.ios | iOS | "Open image" opens the PNG; the share sheet receives `url`; refusal messages appear |
| A5.client (mobile part) | Either | The omission-specific messages appear in Spanish and English |

## Protected reader (A17, A20)

Use a seeded book that passes the gate, on web. **A20 is the runtime check that the reader wasn't affected, so a failure here stops acceptance whatever else passed.**

| Check | Steps | Expected |
|---|---|---|
| A17.smoke | Open a book, scroll, save a fragment, add a note | All of it works and persists after a reload |
| A20.audio | Play a seeded book in Escucha Activa for several phrases; seek once | Audio plays; the highlight follows it and recovers after the seek |
| A20.progress | Note your position, leave the book, come back | The position is restored |
| A20.fragments | Save a fragment during playback and open it from the drawer | It's saved and listed; playback isn't disturbed |

Before A20, confirm the chosen book really has audio on staging. If none does, mark A20.audio BLOCKED; don't mark it PASS from the text view.

## Operator checks on the staging host (read-only)

Run from `/opt/noetia-staging`, one line at a time. Never paste multi-line commands into the SSH terminal.

| Check | Command | Expected |
|---|---|---|
| A1.log, A7.log | `dcs logs --since 15m image-gen \| grep -c 'POST /generate'` before and after running only that test | The count doesn't change |
| A12.mail | `grep -c '^SMTP_HOST=$' .env.staging` | `1`. API logs may show a failed send to the `@staging.invalid` address, which is expected |
| A13.sequence | Look for evidence captured during the deploy | See below |
| A17.deploy | Compare the A17 digest with the same query on a restored copy of the pre-deploy dump, if one exists | Same. Without a dump, mark it BLOCKED |
| A18.audit | `dcs exec -T api node dist/sharing/audit-legacy-shares.js` | Exits 0; prints JSON with ids and counts only |

### A13.sequence

The original test needed the old app serving on the 068 schema, before new code started. Staging has already been upgraded, so this can't be replayed, and rolling staging back to replay it isn't worth the risk.

- If the deploy log shows the old app serving successfully between P3 and P5, record PASS and cite it.
- Otherwise record BLOCKED: `sequence not replayable; see X7 and the local rehearsal`.

While it's BLOCKED the verdict stays INCOMPLETE. **Accepting that gap is a Product Owner decision**, and the harness won't make it. X7 records the local evidence but doesn't count toward staging acceptance.

## A11: storage interruption

**Needs explicit Product Owner approval naming A11.** Book text and card images stop working on staging for the length of the test. See the README for the procedure and the measured behaviour.

## Clean-up

The Product Owner decides whether to clean up and when (integrated report §10, decision 4). After it runs, check these by hand:

- [ ] `evidence-sql --label post-cleanup` shows `testAccounts` 0
- [ ] `fixtureBooks` is still 1 and `adminIds` still lists only `4219d326-b9fc-4aa9-8d35-6ce8b9e6e787`
- [ ] `reports/staging-content/` is unchanged

The existing fixture and administrator must stay in place. The harness has no way to remove them.

## F1 and F2 on staging

These need a deployment containing the corrections, which isn't authorized yet. **X8 pauses staging storage and needs approval naming it.** X9 needs a disposable book approved by the Product Owner.
