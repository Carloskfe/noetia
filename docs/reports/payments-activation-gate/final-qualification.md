# PR #63 — Payment activation gate: final qualification

| | |
|---|---|
| PR | #63 `fix/payments-enabled-fail-closed`, **Draft, DO NOT MERGE** |
| Implementation inspected | `f7e239e` (PA: core implementation accepted for release preparation) |
| This update | Documentation only. No application code, other PR, production or payment state changed |
| Merge / deploy / activation | **None authorized.** Merging to `main` is a production deploy (`cd.yml`) |
| Date | 2026-11-17 (§2 and §5 verification procedure revised after PA correction of `add6c73`) |

---

## 1. Final CI status (run `44205729325`, head `f7e239e`)

Baseline: PR #62 run `43780254233` (head `ecddd52`), which is based on the same `main` commit `3b35cb1` and changes no file under `services/`. It is therefore the cleanest available picture of `main` CI.

| Job | PR #63 | Baseline (`main` 3b35cb1 via PR #62) | Classification |
|---|---|---|---|
| api — lint / typecheck / build | pass | pass | — |
| worker — lint / typecheck / build | pass | pass | — |
| web — lint / typecheck / build | pass | pass | — |
| worker — unit tests | pass | pass | — |
| image-gen — unit tests | pass | pass | — |
| **api — unit tests** | fail: 73/73 suites, **1257/1257 tests pass**; branch coverage **69.08%** < 80% | fail: 71/71 suites, 1028/1028 pass; branches **68.83%** | **Baseline.** Coverage-only failure; PR #63 *raises* branch coverage (+0.25 pt) and adds 229 tests, 0 failures |
| **mobile — unit tests** | fail: 179/179 pass; stmts 29.61 / br 14.17 / lines 31.28 / fn 20.86 | identical numbers | **Baseline.** PR #63 touches no mobile file |
| **web — unit tests** | fail: 298/298 pass; stmts 72.8 / br 72.44 / lines 71.61 / fn 51.74 | identical numbers | **Baseline.** PR #63 touches no web file |
| **web — E2E (Playwright)** | fail: `Playwright does not support chromium on ubuntu26.04-x64` at `playwright install` | identical error | **Baseline / runner environment.** No test executed; unrelated to the PR |

**Regressions introduced by PR #63: none.** Every failing job fails identically on the baseline; no test fails anywhere; the only changed metric (API branch coverage) moved up. The coverage gates have never passed on `main` (pre-existing, tracked separately); this PR neither fixes nor worsens that.

## 2. Production requirement: `PAYMENTS_ENABLED` absent or disabled

> **Revised after PA review of `add6c73`.** The earlier `grep -c` / `sh -c` checks printed a passing result when the file was missing, Docker failed or Compose could not parse, and missed duplicates. They are replaced by the checks below.

Until a separately authorized financial release, production must have `PAYMENTS_ENABLED` **absent, empty or `false`** at **every** layer: the env file, the effective Compose configuration and the running API container. In `docker-compose.server.yml` the `api` service reads `env_file: .env.production`, and its `environment:` block does **not** set `PAYMENTS_ENABLED` (verified at `f7e239e`; nothing under `.github/` sets it either). An edited `.env.production` reaches the process only when the API is recreated, so the layers can disagree. Each layer is checked separately, and the layers must agree with each other.

### 2.1 Which API is running decides what the flag means

| | **Pre-#63 API** (today: `main` `3b35cb1`) | **Post-#63 API** (after an authorized deploy) |
|---|---|---|
| Is the flag enforced? | **No.** The code never reads `PAYMENTS_ENABLED`. Any non-empty `STRIPE_SECRET_KEY` builds a Stripe client | **Yes.** No client exists unless the flag is exactly `true` **and** the key is a real `sk_`/`rk_` key |
| Safety rests on | `STRIPE_SECRET_KEY` **absent or empty** (D6 state; PR #59 G-X1 as written) | `PAYMENTS_ENABLED` not `true`, at all layers, **plus** the boot log proving the gated code is what's running |
| `[payments]` boot line | **Absent** (pre-#63 code has none). Its absence is expected here and proves nothing | **Required:** `[payments] disabled (…)`. If it is missing, the post-#63 code path is unproven: **STOP** |
| Why check the flag at all | Readiness: a `true` already set would turn payments on **the moment #63 deploys** if a key is present | Enforcement |

**Pre-deploy gate:** run checks A–C for **both** variables (`PAYMENTS_ENABLED` and `STRIPE_SECRET_KEY`). **Post-deploy gate:** run A–C for `PAYMENTS_ENABLED`, plus D. Record each output line in the deploy record.

### 2.2 Checks (read-only; values never printed)

Run on the server as root. **Each command is one line.** Paste it as a single line, or type it into a file with `nano` (CLAUDE.md: never paste multi-line content over SSH). Each check prints **exactly one line**: a classification (`ABSENT`, `EMPTY`, `FALSE`, `TRUE`, `OTHER-NONEMPTY`) or a line beginning with `STOP`. Values are never printed, and neither is `docker compose config` or `docker inspect` output (both contain secrets). For `STRIPE_SECRET_KEY`, replace `V=PAYMENTS_ENABLED` with `V=STRIPE_SECRET_KEY`.

**A. Env file.** Fails if the file is missing or unreadable. Counts every definition, including `export` forms, and ignores comments.

```bash
V=PAYMENTS_ENABLED python3 -c 'import os,re;v=os.environ["V"];p="/opt/noetia/.env.production";ok=os.path.isfile(p) and os.access(p,os.R_OK);L=open(p).read().splitlines() if ok else [];d=[l.split("=",1)[1].split(" #")[0].strip().strip(chr(34)+chr(39)).strip() for l in L if re.match(r"\s*(export\s+)?"+v+r"\s*=",l)];print("STOP file-missing-or-unreadable" if not ok else "STOP duplicate-definitions=%d"%len(d) if len(d)>1 else "FILE ABSENT" if not d else "FILE EMPTY" if d[0]=="" else "FILE TRUE" if d[0]=="true" else "FILE FALSE" if d[0]=="false" else "FILE OTHER-NONEMPTY")'
```

**B. Effective Compose configuration** (`env_file` + `environment:` + interpolation, as Compose resolves them for `api`). Fails if Compose returns non-zero, prints nothing, emits invalid JSON (traceback, so no pass line), has no `api` service, or uses an unexpected `environment` shape.

```bash
cd /opt/noetia && V=PAYMENTS_ENABLED python3 -c 'import os,json,subprocess as s;v=os.environ["V"];r=s.run(["docker","compose","--env-file",".env.production","-f","docker-compose.server.yml","config","--format","json"],capture_output=True,text=True);c=json.loads(r.stdout) if r.returncode==0 and r.stdout.strip() else None;a=(c or {}).get("services",{}).get("api");e=(a or {}).get("environment") or {};x=str(e.get(v) if isinstance(e,dict) and e.get(v) is not None else "").strip();print("STOP compose-config-failed rc=%d"%r.returncode if c is None else "STOP no-api-service" if a is None else "STOP environment-not-a-map" if not isinstance(e,dict) else "COMPOSE ABSENT" if v not in e else "COMPOSE EMPTY" if x=="" else "COMPOSE TRUE" if x=="true" else "COMPOSE FALSE" if x=="false" else "COMPOSE OTHER-NONEMPTY")'
```

**C. Running API container** (the environment the process was started with). Fails if `compose ps` fails, if there is not **exactly one** `api` container, if `inspect` fails, if the container is not running, or if the variable appears more than once.

```bash
cd /opt/noetia && V=PAYMENTS_ENABLED python3 -c 'import os,json,subprocess as s;v=os.environ["V"];q=s.run(["docker","compose","--env-file",".env.production","-f","docker-compose.server.yml","ps","-q","api"],capture_output=True,text=True);ids=q.stdout.split() if q.returncode==0 else [];i=s.run(["docker","inspect",ids[0]],capture_output=True,text=True) if len(ids)==1 else None;c=json.loads(i.stdout)[0] if i is not None and i.returncode==0 else None;run=bool(c) and bool(c.get("State",{}).get("Running"));d=[e.split("=",1)[1].strip() if "=" in e else "" for e in ((c or {}).get("Config") or {}).get("Env") or [] if e.split("=",1)[0]==v];print("STOP compose-ps-failed" if q.returncode!=0 else "STOP api-containers=%d"%len(ids) if len(ids)!=1 else "STOP inspect-failed" if c is None else "STOP api-not-running" if not run else "STOP duplicate-definitions=%d"%len(d) if len(d)>1 else "CONTAINER ABSENT" if not d else "CONTAINER EMPTY" if d[0]=="" else "CONTAINER TRUE" if d[0]=="true" else "CONTAINER FALSE" if d[0]=="false" else "CONTAINER OTHER-NONEMPTY")'
```

**D. Startup log: post-#63 only.** Shows which code path the running process took. Reads the current `api` container's log, strips colour codes and looks only at `[payments]` lines, which never contain the key. Fails if there is no `[payments]` line, if any `[payments] ENABLED` line appears in this container's log, or if the last line is not `[payments] disabled (…)`.

```bash
cd /opt/noetia && python3 -c 'import re,subprocess as s;q=s.run(["docker","compose","--env-file",".env.production","-f","docker-compose.server.yml","ps","-q","api"],capture_output=True,text=True);ids=q.stdout.split() if q.returncode==0 else [];r=s.run(["docker","logs",ids[0]],capture_output=True,text=True) if len(ids)==1 else None;t=re.sub(r"\x1b\[[0-9;]*m","",(r.stdout+r.stderr) if r is not None and r.returncode==0 else "");L=[l[l.index("[payments]"):].strip() for l in t.splitlines() if "[payments]" in l];print("STOP compose-ps-failed" if q.returncode!=0 else "STOP api-containers=%d"%len(ids) if len(ids)!=1 else "STOP docker-logs-failed" if r is None or r.returncode!=0 else "STOP no-payments-boot-line" if not L else "STOP enabled-line-present" if any(x.startswith("[payments] ENABLED") for x in L) else "LOG OK "+L[-1] if L[-1].startswith("[payments] disabled (") else "STOP unexpected-payments-line")'
```

### 2.3 Interpretation: only the listed pass results pass

| Check | `PAYMENTS_ENABLED`: pass | `STRIPE_SECRET_KEY`: pass (pre-#63 gate) |
|---|---|---|
| A / B / C | `ABSENT`, `EMPTY` or `FALSE` | `ABSENT` or `EMPTY` |
| D (post-#63) | `LOG OK [payments] disabled (…)` | n/a |

These all mean **STOP. Do not deploy, or, after a deploy, escalate to the PO immediately**:

- any line starting with `STOP`, a Python traceback, no output, or more than one line;
- `TRUE`;
- `OTHER-NONEMPTY` for `PAYMENTS_ENABLED` (e.g. `TRUE`, `1`, `yes`: the post-#63 code reads these as off, but they show intent that hasn't been reconciled);
- for `STRIPE_SECRET_KEY` before the #63 deploy, `OTHER-NONEMPTY` (a key is set and the pre-#63 code would activate on it);
- **layers disagreeing.** A, B and C must give the same classification. If A ≠ B, a definition in Compose (`environment:` or interpolation) conflicts with the file. If B ≠ C, the running container predates the file or Compose state. Either way, the deployed state is not the one you reviewed;
- **post-#63, check D missing or failing**, even when A–C pass. If the boot line has rotated out of the log, STOP and escalate. Recreating the API to regenerate it is a production change that needs its own authorization.

None of these checks changes anything. A STOP is resolved by the PO and operator, never by editing `.env.production` or recreating containers as part of the verification.

## 3. A restored Stripe key alone cannot activate payments (after PR #63 is deployed)

Confirmed against `f7e239e`:

- The only `new Stripe(` in `services/api/src` is in `common/payments-activation.ts` (`createStripeClient`). `SubscriptionsService`, `GiftsService` and `WebhooksController` obtain their client only from it.
- `resolvePaymentsActivation` checks the flag **first**: unless `PAYMENTS_ENABLED` is exactly `true`, it returns disabled without reading the key.
- With no client, every pathway keeps its existing error: checkout (subscription, token package, book, anonymous gift), portal, cancel, resume, sync → `400 payments_not_configured`; `POST /webhooks/stripe` → `400 Stripe is not configured` before signature verification.
- Executed matrix (PR body): flag missing/empty/`false`/`TRUE`/`1`/`yes`/typo × key `sk_test_`/`sk_live_`/`rk_live_` → **OFF** on every pathway, including HTTP tests of the unauthenticated gift and webhook routes. Negative control (parser accepts anything) fails 118 tests.

**Scope of this guarantee:** it holds for the code on `main` + PR #63. It does **not** hold for code that constructs Stripe itself — see §4.

## 4. Integration requirement: PR #60 `CheckoutStatusService`

PR #60 (`fix/payment-lifecycle-stabilization-20261112`) still constructs Stripe from the key alone in **four** classes:

| File on PR #60 | Construction |
|---|---|
| `subscriptions/subscriptions.service.ts:72-73` | `stripeKey ? new Stripe(stripeKey) : null` |
| `gifts/gifts.service.ts:41-42` | same |
| `subscriptions/webhooks.controller.ts:27-28` | same |
| **`subscriptions/checkout-status.service.ts:69-70`** (new in PR #60, G-1) | same |

**Requirement (blocking for financial release):** when PR #60 is integrated, all four, **including `CheckoutStatusService`**, must obtain their client only through `createStripeClient`. Resolution of the three existing conflicts: keep `createStripeClient`. PR #60's test suites need the one-line `PAYMENTS_ENABLED=true` opt-in. Acceptance check at integration:

```bash
git grep -n "new Stripe(" -- services/api/src   # must list ONLY common/payments-activation.ts
```

Until then, PR #60 merged on its own would reintroduce key-only activation for the read-only `checkout.sessions.retrieve` path and, if merged over PR #63 without resolution, for the other three. This is a recorded gate, not changed here.

## 5. Rollback consequence

Reverting PR #63 (a revert on `main`, i.e. a production deploy) restores the **previous key-only activation**: any non-empty `STRIPE_SECRET_KEY` in production again builds a Stripe client and opens checkout, the anonymous gift path and webhook processing.

Therefore, **before any revert of PR #63 is deployed**, the Stripe-key safety verification must be repeated and recorded: run §2.2 checks A, B and C with `V=STRIPE_SECRET_KEY`. All three must return `ABSENT` or `EMPTY` and agree. Any other result, any `STOP`, or a disagreement between layers = **do not revert**. After the revert, check D will (correctly) find no `[payments]` line, because the gate code is gone; from then on, safety rests on the key alone again, as in the pre-#63 column of §2.1.

and PR #59's G-X1 reverts to its original form ("`STRIPE_SECRET_KEY` absent or empty"). A revert with a key present = unauthorized payment activation. Kill switch after a future authorized activation is unchanged: `PAYMENTS_ENABLED=false` + recreate the API (not a revert).

## 6. Recommended release ordering (recommendation only; nothing merged)

Pairwise merge checks (`git merge-tree`): #63+#59 clean, #63+#62 clean, #59+#62 clean. The three are independent; the order is about risk, not conflicts.

| Step | PR | Why here |
|---|---|---|
| 1 | **#63** payment gate | Smallest blast radius (API only, fail-closed, no behaviour change with flag unset, matching today's state). Strictly reduces risk for every later step: once deployed, a restored key can no longer open payments. §2 pre-deploy gate before, post-deploy gate (incl. check D) after |
| 2 | **#59** public site | Its blocking condition G-X1 can then be stated as "`PAYMENTS_ENABLED` not `true`" (robust to a restored key) instead of relying solely on the key being absent. Web-facing, independent of network topology |
| 3 | **#62** API edge network (Stage B-2) | Infrastructure change with an operator runbook and a known failure mode (504 on every `/api` while CD reports green if Traefik is not attached). Do it last, in its own window, after #63 and #59 are verified, so any `/api` failure is unambiguously attributable to the network change and rollback does not have to untangle application deploys |

Conditions for every step: separate PO merge authorization per PR; one deploy at a time, with no merge while a CD run is in progress (`gh run list` first; CD cancel-in-progress); post-deploy verification per `CLAUDE.md` before the next step. PR #60 is **not** in this sequence: it belongs to the financial release and must satisfy §4 first.

## 7. Status and recommendation

- PR #63 remains **Draft, DO NOT MERGE**.
- Remaining financial-release gates are unchanged and closed (G-1, G-4, G-5, W-1/W1-PO, W-2/SG-PM, USD-1, D4 portal, production webhook and key, gift-email recovery, Terms/legal, NEM-024 separation, PR #60 integration incl. §4). Setting `PAYMENTS_ENABLED=true` in production **is** the financial release and needs its own PO authorization.

**Recommendation: GO for a future, separately PO-authorized merge of PR #63 alone, as step 1 of §6**, subject to: (a) the §2 pre-deploy gate (A–C for both variables) passing before the deploy, and the post-deploy gate (A–C for `PAYMENTS_ENABLED` + D `LOG OK [payments] disabled (…)`) passing after it; (b) no CD run in progress at merge; (c) PA acceptance of this qualification.
**NO-GO** for: activating payments; merging PR #60 without §4; reverting PR #63 without §5.
