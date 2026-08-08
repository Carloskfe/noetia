# Mission Review Checklist

Used by **Product Architecture** after every mission, before it can move to COMPLETED. A mission is not complete on commit, passing tests, or deployment alone — it is complete only after this review **and** Product Owner acceptance (see `DEFINITION-OF-DONE.md`).

Mark each: ✅ pass · ⚠️ follow-up · ❌ fail · N/A.

## Scope
- [ ] Implementation stayed **inside** the mission's In-scope list.
- [ ] No unrelated changes were introduced.
- [ ] No protected system was modified except where the mission explicitly authorized it.
- [ ] Authorization level (NONE / DOCUMENTATION ONLY / LIMITED / FULL-WITHIN-SCOPE) was respected.

## Product
- [ ] Behavior matches Product Owner decisions and the Product Bible / ADRs.
- [ ] Permanent book ownership preserved (ownership ≠ subscription).
- [ ] Personal-library privacy preserved (Duo/Family isolation).
- [ ] Business rules unchanged unless explicitly authorized (pricing, tokens, expiration, royalties, Causas %, entitlements, publisher rights).

## Architecture
- [ ] Fits the existing architecture; no unnecessary technologies introduced.
- [ ] Dependencies are reasonable and justified.
- [ ] Reader / Escucha Activa isolation preserved (no coupling, no degradation).
- [ ] Any ADR-worthy decision was flagged (see `ADR candidates`).

## Database
- [ ] Migrations are **additive** (or explicitly authorized otherwise).
- [ ] No previously deployed migration was edited.
- [ ] Rollback behavior is understood and stated.
- [ ] Production data preserved; no destructive change without explicit authorization + snapshot.

## Security
- [ ] Authentication correct.
- [ ] Authorization correct (centralized guards/capabilities, not scattered checks).
- [ ] Privacy preserved (data isolation, deletion, no cross-user leakage).
- [ ] No secrets, credentials, or PII committed.

## Financial (when applicable)
- [ ] Stripe behavior correct (signature verification, event handling).
- [ ] Token issuance correct.
- [ ] Idempotency preserved (webhooks / retried side effects).
- [ ] AI cost controls respected (routing, caps, budget guard) where relevant.
- [ ] No unauthorized pricing or economic changes.

## Tests
- [ ] Required tests present.
- [ ] Regression tests present.
- [ ] All tests pass.
- [ ] Important negative/failure cases tested.

## Documentation
- [ ] Docs updated where required.
- [ ] ADR created/proposed if a significant decision was made.
- [ ] Product Bible impact assessed.
- [ ] Implementation deviations from the mission recorded.

## Deployment
- [ ] Deployment matched its authorization level.
- [ ] Deployment verified (not assumed from commit success).
- [ ] Rollback path understood.

## Repository hygiene
- [ ] Focused commit(s); no unrelated files.
- [ ] `settings.local.json` not staged (unless explicitly authorized).
- [ ] No accidental local configuration or artifacts.

---

## Verdict
```
APPROVE
APPROVE WITH FOLLOW-UP   (list follow-ups)
REJECT / REMEDIATE       (list required remediations)
```
Record the verdict, reviewer, and date. On APPROVE (or after follow-ups/remediations are accepted), the Product Owner accepts closure and the mission moves to COMPLETED.
