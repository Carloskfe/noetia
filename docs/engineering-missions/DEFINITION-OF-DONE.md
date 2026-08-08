# Definition of Done

A Noetia Engineering Mission is **engineering-complete** only when all *applicable* conditions below are satisfied. Not every condition applies to every mission type (e.g. a DOCUMENTATION-ONLY mission has no migrations or deployment) — apply what is relevant, and state N/A for the rest.

## Conditions
- [ ] **Approved scope delivered** — the mission's Objective and In-scope items are done; nothing out of scope was changed.
- [ ] **Acceptance criteria satisfied** — every criterion in the mission is met and checkable.
- [ ] **Tests pass** — required unit/integration/regression/negative tests exist and pass.
- [ ] **Migrations verified** — additive, old migrations untouched, up/down validated, rollback understood (or N/A).
- [ ] **Lint / typecheck / build pass** for the changed services.
- [ ] **Security implications reviewed** — auth, authz, privacy, secrets, data isolation.
- [ ] **Observability added** where the mission required it (metrics/logs/events/dashboards).
- [ ] **Documentation updated** — technical docs, ADRs, Product Bible impact, baseline reconciliation as applicable.
- [ ] **Deviations documented** — any difference from the approved mission is recorded and justified.
- [ ] **Changed files reported** — full list with purpose.
- [ ] **Commit SHA reported.**
- [ ] **No unrelated changes** included (and `settings.local.json` excluded unless authorized).
- [ ] **Product Architecture review completed** (`REVIEW-CHECKLIST.md`) with a verdict.
- [ ] **Product Owner accepts closure.**

## A mission is NOT automatically done because:
- the code compiles;
- Claude says it is complete;
- tests pass;
- the code was committed;
- production was deployed.

**Governance completion requires review and Product Owner acceptance.** Only then does the mission move to `COMPLETED/`.

## Exceptional endings
- **BLOCKED** — safe execution needs a decision outside Claude's authorized judgment; Claude explains what/why/options/consequences and waits. Not "done".
- **CANCELLED** — the Product Owner withdraws the mission. Recorded, not "done".
