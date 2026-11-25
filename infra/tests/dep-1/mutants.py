#!/usr/bin/env python3
"""Removes or weakens one guard at a time and requires the suite to notice."""
import os, pathlib, shutil, subprocess, sys, tempfile
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CD, RB = ".github/workflows/cd.yml", "docs/operations/production-rollback.md"
M = [  # (file, old, new, test class)
 (CD, '[ "$GITHUB_REF" = refs/heads/main ] ||', 'true ||', "RunnerTests"),
 (CD, '[ "$tip" = "$GITHUB_SHA" ] ||', 'true ||', "RunnerTests"),
 (CD, '[ -n "$KEY" ] ||', 'true ||', "RunnerTests"),
 (CD, 'is_fp "$WANT_KEY" ||', 'true ||', "RunnerTests"),
 (CD, 'is_fp "$WANT_HOST" ||', 'true ||', "RunnerTests"),
 (CD, '[ "$got" = "$WANT_KEY" ] ||', 'true ||', "RunnerTests"),
 (CD, "trap 'rm -f \"$f\"' EXIT", "true", "RunnerTests"),
 (CD, 'flock -n 9 || refuse', 'true || refuse', "DeployTests"),
 (CD, "grep -Eqx '[0-9a-f]{40}' || refuse \"malformed SHA\"", "cat >/dev/null", "DeployTests"),
 (CD, '[ -s .env.production ] ||', 'true ||', "DeployTests"),
 (CD, '[ -z "$dirty" ] || refuse "tracked files are modified', 'true || refuse "tracked files are modified', "DeployTests"),
 (CD, '|| refuse "git status failed"\n            [ -z "$dirty" ] || refuse "tracked files are', '|| true\n            [ -z "$dirty" ] || refuse "tracked files are', "DeployTests"),
 (CD, 'grep -q " $here " "$LOG" ||', 'true ||', "DeployTests"),
 (CD, '*) refuse "server checkout is on', '*) : "server checkout is on', "DeployTests"),
 (CD, 'origin refs/heads/main || refuse "git fetch failed"', 'origin refs/heads/main || true', "DeployTests"),
 (CD, '[ "$(g rev-parse FETCH_HEAD)" = "$SHA" ] ||', 'true ||', "DeployTests"),
 (CD, 'g merge-base --is-ancestor refs/heads/main "$SHA" ||', 'true ||', "DeployTests"),
 (CD, '[ -z "$tracked" ] ||', 'true ||', "DeployTests"),
 (CD, '[ "$(g rev-parse HEAD)" = "$SHA" ] ||', 'true ||', "DeployTests"),
 (CD, '[ -z "$dirty" ] || refuse "tracked files changed"', 'true', "DeployTests"),
 (CD, 'server.yml build\n', 'server.yml build || true\n', "DeployTests"),
 (CD, '--wait-timeout 300\n', '--wait-timeout 300 || true\n', "DeployTests"),
 (CD, 'migration:run:prod\n', 'migration:run:prod || true\n', "DeployTests"),
 (CD, 'environment:\n      name: production', 'environment:\n      name: prod', "WorkflowContract"),
 (CD, 'fingerprint: ${{ vars.DEPLOY_HOST_FINGERPRINT }}', 'debug: false', "WorkflowContract"),
 (RB, 'flock -n 9 || refuse', 'true || refuse', "RollbackTests"),
 (RB, '[ -z "$dirty" ] || refuse "tracked files are modified', 'true || refuse "tracked files are modified', "RollbackTests"),
 (RB, '[ -s .env.production ] ||', 'true ||', "RollbackTests"),
 (RB, 'grep -q " $SHA " "$LOG" ||', 'true ||', "RollbackTests"),
 (RB, 'g merge-base --is-ancestor "$SHA" refs/heads/main ||', 'true ||', "RollbackTests"),
 (RB, '[ -z "$tracked" ] ||', 'true ||', "RollbackTests"),
 (RB, 'refs/heads/main -- services/api/src/migrations ||', 'HEAD -- services/api/src/migrations ||', "RollbackTests"),
 (RB, 'g diff --quiet "$SHA" refs/heads/main -- services/api/src/migrations ||', 'true ||', "RollbackTests"),
 (RB, 'g diff --quiet "$SHA" refs/heads/main -- docker-compose.server.yml ||', 'true ||', "RollbackTests"),
 (RB, '[ "$(g rev-parse HEAD)" = "$SHA" ] ||', 'true ||', "RollbackTests"),
 (RB, '[ "$MODE" = apply ] ||', 'true ||', "RollbackTests"),
]
survived = 0
for i, (f, old, new, cls) in enumerate(M):
    with tempfile.TemporaryDirectory(prefix="dep1m-") as t:
        for p in (CD, RB):
            (pathlib.Path(t) / p).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / p, pathlib.Path(t) / p)
        s = (pathlib.Path(t) / f).read_text()
        assert s.count(old) >= 1, (i, old)
        (pathlib.Path(t) / f).write_text(s.replace(old, new, 1))
        r = subprocess.run([sys.executable, "-I", str(HERE / "test_deploy.py"), "-f", cls], env={**os.environ, "DEP1_ROOT": t}, capture_output=True, text=True)
        ok = r.returncode != 0
        why = next((l for l in r.stderr.splitlines() if l.startswith(("FAIL:", "ERROR:"))), "")
        survived += not ok
        print(f"{'KILLED  ' if ok else 'SURVIVED'} {i+1:2} {cls}: {old.strip()[:60]!r}  {why[:70]}", flush=True)
print(f"{len(M)-survived}/{len(M)} killed")
sys.exit(bool(survived))
