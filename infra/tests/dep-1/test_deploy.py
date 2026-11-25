#!/usr/bin/env python3
"""Offline tests for DEP-1: the shipped text of cd.yml and of the rollback runbook.

Scripts are extracted from the files that ship, never copied. Only two literal
paths are replaced (each must be present). Git, flock and ssh-keygen are real, on
throwaway repositories and keys. `docker` and `gh` are stubs. There is no network.
Run:  python3 -I infra/tests/dep-1/test_deploy.py            (needs PyYAML)
      python3 -I infra/tests/dep-1/mutants.py                (guard-removal proof)
"""
import hashlib, os, pathlib, re, shutil, stat, subprocess, sys, tempfile, unittest
import yaml

ROOT = pathlib.Path(os.environ.get("DEP1_ROOT") or pathlib.Path(__file__).resolve().parents[3])
CD = (ROOT / ".github/workflows/cd.yml").read_text()
RUNBOOK = (ROOT / "docs/operations/production-rollback.md").read_text()
SHELLS = [s for s in ("dash", "bash") if shutil.which(s)]
WF = yaml.load(CD, Loader=yaml.BaseLoader)  # BaseLoader: keeps `on` a string
STEPS = WF["jobs"]["deploy"]["steps"]
DEPLOY = STEPS[2]["with"]["script"]
ROLLBACK = re.search(r"^# BEGIN ROLLBACK SCRIPT$.*?^# END ROLLBACK SCRIPT$", RUNBOOK, re.S | re.M).group(0)
FP = "SHA256:" + "A" * 43
ENVFILE = "SECRET=do-not-touch\n"

DOCKER = r'''#!/bin/sh
echo "$*" >> "$STUB/docker.log"
stage=other
case "$*" in *" build") stage=build;; *" up -d "*) stage=up;; *migration:run:prod*) stage=migrate;; "image prune"*) stage=prune;; esac
if [ "$stage" = build ] && [ -f "$STUB/on_build" ]; then sh "$STUB/on_build"; fi
[ "${FAIL_AT:-}" = "$stage" ] && { echo "stub: $stage failed"; exit 17; }
exit 0
'''
GH = r'''#!/bin/sh
[ "${GH_FAIL:-}" = 1 ] && exit 1
case "$*" in "api repos/o/r/git/ref/heads/main --jq .object.sha") echo "$GH_TIP";; *) echo "unexpected gh: $*" >&2; exit 9;; esac
'''


class Base(unittest.TestCase):
    def setUp(self):
        self.d = pathlib.Path(tempfile.mkdtemp(prefix="dep1-"))
        self.addCleanup(shutil.rmtree, self.d, True)
        (self.d / "bin").mkdir()
        for n, t in (("docker", DOCKER), ("gh", GH)):
            p = self.d / "bin" / n
            p.write_text(t)
            p.chmod(0o755)
        # A contact attempt must fail loudly, not leave the machine.
        for n in ("ssh", "curl", "ssh-keyscan", "scp"):
            p = self.d / "bin" / n
            p.write_text('#!/bin/sh\necho "NETWORK TOOL CALLED" >> "$STUB/network.log"\nexit 99\n')
            p.chmod(0o755)
        self.env = {"PATH": f"{self.d}/bin:/usr/bin:/bin", "HOME": str(self.d), "STUB": str(self.d),
                    "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_NOSYSTEM": "1",
                    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
                    "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid", "LC_ALL": "C.UTF-8"}

    def tearDown(self):
        self.assertFalse((self.d / "network.log").exists(), "a network tool was called")

    def git(self, *a, cwd=None, ok=True):
        r = subprocess.run(["git", *a], cwd=cwd or self.srv, env=self.env, text=True, capture_output=True)
        if ok and r.returncode:
            raise AssertionError(r.stderr)
        return r.stdout.strip()


class Server(Base):
    """A fake /opt/noetia cloned from a fake origin."""
    def setUp(self):
        super().setUp()
        self.origin, self.dev, self.srv = (self.d / n for n in ("origin.git", "dev", "noetia"))
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(self.origin)], env=self.env, check=True)
        subprocess.run(["git", "clone", "-q", str(self.origin), str(self.dev)], env=self.env, check=True, capture_output=True)
        self.git("checkout", "-q", "-B", "main", cwd=self.dev)
        for p, t in (("docker-compose.server.yml", "services: {}\n"), ("services/api/src/migrations/001.ts", "1\n"), ("app.txt", "1\n")):
            (self.dev / p).parent.mkdir(parents=True, exist_ok=True)
            (self.dev / p).write_text(t)
        self.A = self.commit()
        subprocess.run(["git", "clone", "-q", str(self.origin), str(self.srv)], env=self.env, check=True)
        (self.srv / ".env.production").write_text(ENVFILE)
        self.log = self.srv / ".git/noetia-deployed.log"
        self.lock = self.d / "deploy.lock"

    def commit(self, path="app.txt", text=None, push=True):
        p = self.dev / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text if text is not None else os.urandom(8).hex())
        self.git("add", "-f", path, cwd=self.dev)
        self.git("commit", "-q", "-m", "c", cwd=self.dev)
        if push:
            self.git("push", "-q", "origin", "main", cwd=self.dev)
        return self.git("rev-parse", "HEAD", cwd=self.dev)

    def _paths(self, script):
        for old, new in (("/opt/noetia", str(self.srv)), ("/var/lock/noetia-deploy.lock", str(self.lock))):
            self.assertEqual(script.count(old), 1, f"{old} must appear exactly once")
            script = script.replace(old, new)
        return script

    def _run(self, argv, **env):
        return subprocess.run(argv, env={**self.env, **env}, cwd=self.d, text=True, capture_output=True, timeout=60)

    def deploy(self, sha, shell=SHELLS[0], **env):
        self.assertEqual(DEPLOY.count("${{"), 1)
        # drone-ssh sends the trimmed script as one command string to the login shell
        r = self._run([shell, "-c", self._paths(DEPLOY).replace("${{ github.sha }}", sha).strip()], **env)
        self.env_intact()
        return r

    def rollback(self, *args, **env):
        f = self.d / "rollback.sh"
        f.write_text(self._paths(ROLLBACK))
        r = self._run([SHELLS[0], str(f), *args], **env)
        self.env_intact()
        return r

    def env_intact(self):
        self.assertEqual((self.srv / ".env.production").read_text(), ENVFILE)

    def docker(self):
        p = self.d / "docker.log"
        return p.read_text().splitlines() if p.exists() else []

    def logged(self):
        return [l.split()[1:] for l in self.log.read_text().splitlines()] if self.log.exists() else []

    def head(self):
        return self.git("rev-parse", "HEAD")

    def refused(self, r, text, untouched=True):
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn(text, r.stdout)
        if untouched:
            self.assertEqual(self.docker(), [])
            self.assertEqual(self.logged(), [])

    def stage(self, n):
        return [("build" if l.endswith(" build") else "up" if " up -d " in l else "migrate" if "migration:run" in l else "prune") for l in self.docker()][n:]


class DeployTests(Server):
    def test_success_records_exact_sha_in_both_shells(self):
        for sh in SHELLS:
            b = self.commit()
            r = self.deploy(b, sh)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertEqual(self.head(), b)
            self.assertEqual(self.git("symbolic-ref", "--short", "HEAD"), "main")
            self.assertEqual(self.logged()[-1], [b, "deploy"])
            self.assertEqual(self.stage(-4), ["build", "up", "migrate", "prune"])

    def test_docker_commands_are_the_existing_ones(self):
        self.deploy(self.commit())
        dc = "compose --env-file .env.production -f docker-compose.server.yml "
        self.assertEqual(self.docker(), [dc + "build", dc + "up -d --remove-orphans --wait --wait-timeout 300",
                         dc + "exec -T -e DB_HOST=db api npm run migration:run:prod", "image prune -f"])

    def test_malformed_sha(self):
        for bad in ("", "abc", "A" * 40, "a" * 41, "a" * 39 + "g", self.A + " x", "abc; touch pwned"):
            self.refused(self.deploy(bad), "malformed SHA")
        self.assertFalse(any(self.d.rglob("pwned")))

    def test_superseded_sha(self):
        b = self.commit()
        self.commit()
        self.refused(self.deploy(b), "not the tip of main")
        self.assertEqual(self.head(), self.A)

    def test_unknown_sha(self):
        self.refused(self.deploy("d" * 40), "not the tip of main")

    def test_branch_commit_not_main(self):
        self.git("checkout", "-q", "-b", "feature", cwd=self.dev)
        c = self.commit(push=False)
        self.git("push", "-q", "origin", "feature", cwd=self.dev)
        self.refused(self.deploy(c), "not the tip of main")

    def test_dirty_tracked(self):
        (self.srv / "app.txt").write_text("edited")
        self.refused(self.deploy(self.commit()), "tracked files are modified")
        self.assertEqual((self.srv / "app.txt").read_text(), "edited")

    def test_dirty_staged(self):
        (self.srv / "app.txt").write_text("edited")
        self.git("add", "app.txt")
        self.refused(self.deploy(self.commit()), "tracked files are modified")

    def test_git_status_failure_is_not_clean(self):
        b = self.commit()
        (self.srv / ".git/index").write_bytes(b"corrupt")
        self.refused(self.deploy(b), "git status failed")

    def test_fetch_failure(self):
        b = self.commit()
        self.origin.rename(self.d / "gone.git")
        self.refused(self.deploy(b), "git fetch failed")
        self.assertEqual(self.head(), self.A)

    def test_stale_fetch_head_is_not_used(self):
        b = self.commit()
        self.git("fetch", "-q", "origin", "main")
        self.origin.rename(self.d / "gone.git")
        self.refused(self.deploy(b), "git fetch failed")

    def test_non_fast_forward_remote_rewritten(self):
        self.deploy(self.commit())
        n, logs = len(self.docker()), self.logged()
        self.git("reset", "-q", "--hard", self.A, cwd=self.dev)
        c = self.commit(push=False)
        self.git("push", "-q", "-f", "origin", "main", cwd=self.dev)
        h = self.head()
        r = self.deploy(c)
        self.refused(r, "not a fast-forward", untouched=False)
        self.assertEqual((len(self.docker()), self.logged(), self.head()), (n, logs, h))

    def test_local_commit_on_server(self):
        self.git("commit", "-q", "--allow-empty", "-m", "local")
        self.refused(self.deploy(self.commit()), "not a fast-forward")

    def test_server_on_other_branch(self):
        self.git("checkout", "-q", "-b", "hotfix")
        self.refused(self.deploy(self.commit()), "unexpected branch")

    def test_detached_unrecorded(self):
        self.git("checkout", "-q", "--detach")
        self.refused(self.deploy(self.commit()), "detached HEAD")

    def test_concurrent_deploy(self):
        b = self.commit()
        self.lock.touch()
        holder = subprocess.Popen(["flock", "-n", str(self.lock), "sh", "-c", "echo held; exec sleep 30"], stdout=subprocess.PIPE, text=True)
        self.addCleanup(lambda: subprocess.run(["pkill", "-P", str(holder.pid)]) and holder.wait())
        self.assertEqual(holder.stdout.readline().strip(), "held")
        self.refused(self.deploy(b), "another deploy or rollback")
        holder.stdout.close()

    def test_second_deploy_while_first_builds(self):
        """The lock is really held during the build."""
        b = self.commit()
        (self.d / "on_build").write_text(f'flock -n "{self.lock}" true && echo FREE > "$STUB/free" || echo HELD > "$STUB/held"\n')
        self.assertEqual(self.deploy(b).returncode, 0)
        self.assertTrue((self.d / "held").exists())
        self.assertFalse((self.d / "free").exists())
        self.assertEqual(subprocess.run(["flock", "-n", str(self.lock), "true"]).returncode, 0, "lock released after")

    def test_no_background_git_maintenance(self):
        body = [l for l in DEPLOY.splitlines() + ROLLBACK.splitlines() if not l.strip().startswith("#")]
        for l in body:
            if "g() {" not in l:
                self.assertNotRegex(l, r"(^|[\s($])git [a-z]")
        self.assertEqual(sum("gc.auto=0" in l and "maintenance.auto=false" in l for l in body), 2)

    def test_build_failure(self):
        b = self.commit()
        r = self.deploy(b, FAIL_AT="build")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((self.stage(0), self.logged()), (["build"], []))

    def test_health_failure(self):
        r = self.deploy(self.commit(), FAIL_AT="up")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((self.stage(0), self.logged()), (["build", "up"], []))

    def test_migration_failure_then_retry(self):
        b = self.commit()
        r = self.deploy(b, FAIL_AT="migrate")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((self.stage(0), self.logged()), (["build", "up", "migrate"], []))
        self.assertEqual(self.deploy(b).returncode, 0)
        self.assertEqual(self.logged(), [[b, "deploy"]])

    def test_prune_failure_does_not_unrecord(self):
        b = self.commit()
        r = self.deploy(b, FAIL_AT="prune")
        self.assertEqual(r.returncode, 0)
        self.assertIn("WARNING", r.stdout)
        self.assertEqual(self.logged(), [[b, "deploy"]])

    def test_log_write_failure_fails_the_run(self):
        b = self.commit()
        self.log.mkdir()
        self.assertNotEqual(self.deploy(b).returncode, 0)

    def test_main_advances_during_build(self):
        b = self.commit()
        c = self.commit(push=False)
        (self.d / "on_build").write_text(f'git -C "{self.dev}" push -q origin main\n')
        self.assertEqual(self.deploy(b).returncode, 0)
        self.assertEqual((self.head(), self.logged()), (b, [[b, "deploy"]]))
        self.assertEqual(self.git("rev-parse", "main", cwd=self.origin), c)

    def test_checkout_moved_during_build(self):
        b = self.commit()
        (self.d / "on_build").write_text(f'git -C "{self.srv}" checkout -q --detach {self.A}\n')
        r = self.deploy(b)
        self.refused(r, "checkout is not the approved commit", untouched=False)
        self.assertEqual((self.stage(0), self.logged()), (["build"], []))

    def test_tracked_file_changed_during_build(self):
        b = self.commit()
        (self.d / "on_build").write_text(f'echo x > "{self.srv}/app.txt"\n')
        self.refused(self.deploy(b), "tracked files changed", untouched=False)
        self.assertEqual((self.stage(0), self.logged()), (["build"], []))

    def test_env_production_missing_or_empty(self):
        b = self.commit()
        f = self.srv / ".env.production"
        self.env_intact = lambda: None
        f.write_text("")
        self.refused(self.deploy(b), ".env.production missing or empty")
        f.unlink()
        self.refused(self.deploy(b), ".env.production missing or empty")

    def test_commit_tracking_env_production(self):
        b = self.commit(".env.production", "PLANTED=1\n")
        self.refused(self.deploy(b), "commit tracks .env.production")

    def test_commit_tracking_env_production_when_ignored(self):
        """Git silently overwrites IGNORED files on merge; the guard must come first."""
        (self.srv / ".git/info/exclude").write_text(".env.production\n")
        b = self.commit(".env.production", "PLANTED=1\n")
        self.refused(self.deploy(b), "commit tracks .env.production")
        # control: without the guard the overwrite is real
        c = self.d / "control"
        shutil.copytree(self.srv, c)
        self.git("merge", "-q", "--ff-only", b, cwd=c)
        self.assertEqual((c / ".env.production").read_text(), "PLANTED=1\n")

    def test_untracked_collision_stops(self):
        (self.srv / "new.txt").write_text("server copy")
        b = self.commit("new.txt")
        r = self.deploy(b)
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((self.docker(), self.logged()), ([], []))
        self.assertEqual((self.srv / "new.txt").read_text(), "server copy")

    def test_idempotent_redeploy(self):
        b = self.commit()
        self.deploy(b)
        self.assertEqual(self.deploy(b).returncode, 0)
        self.assertEqual(self.logged(), [[b, "deploy"]] * 2)


class RollbackTests(Server):
    def setUp(self):
        super().setUp()
        self.log.write_text(f"2026-01-01T00:00:00Z {self.A} baseline\n")
        self.B = self.commit()
        self.assertEqual(self.deploy(self.B).returncode, 0)
        (self.d / "docker.log").unlink()

    def no(self, r, text):
        self.assertNotEqual(r.returncode, 0, r.stdout)
        self.assertIn(text, r.stdout)
        self.assertEqual((self.docker(), self.logged()), ([], [[self.A, "baseline"], [self.B, "deploy"]]))

    def test_check_changes_nothing(self):
        r = self.rollback(self.A)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual((self.head(), self.docker()), (self.B, []))

    def test_rollback_and_return(self):
        self.assertEqual(self.rollback(self.A, "apply").returncode, 0)
        self.assertEqual(self.head(), self.A)
        self.assertEqual(self.git("symbolic-ref", "-q", "HEAD", ok=False), "")
        self.assertEqual(self.logged()[-1], [self.A, "rollback"])
        self.assertEqual(self.stage(0), ["build", "up"])  # no migration, no prune
        self.git("revert", "--no-edit", self.B, cwd=self.dev)
        self.git("push", "-q", "origin", "main", cwd=self.dev)
        c = self.git("rev-parse", "HEAD", cwd=self.dev)
        self.assertEqual(self.deploy(c).returncode, 0)
        self.assertEqual((self.head(), self.git("symbolic-ref", "--short", "HEAD"), self.logged()[-1]), (c, "main", [c, "deploy"]))

    def test_bad_input(self):
        self.no(self.rollback("abc"), "malformed SHA")
        self.no(self.rollback(), "malformed SHA")
        self.no(self.rollback(self.A, "now"), "mode must be")

    def test_unrecorded_target(self):
        self.no(self.rollback("e" * 40, "apply"), "never recorded")

    def test_recorded_but_not_in_main_history(self):
        t = self.git("commit-tree", "HEAD^{tree}", "-m", "orphan")
        before = self.log.read_text()
        self.log.write_text(before + f"2026-01-02T00:00:00Z {t} deploy\n")
        r = self.rollback(t, "apply")
        self.assertIn("not in the history of main", r.stdout)
        self.assertEqual(self.docker(), [])

    def test_migrations_differ(self):
        for path in ("services/api/src/migrations/002.ts", "services/api/src/migrations/001.ts"):
            with self.subTest(path):
                c = self.commit(path)
                # even a FAILED deploy may have migrated: nothing was logged for c
                self.deploy(c, FAIL_AT="migrate")
                (self.d / "docker.log").unlink()
                self.no(self.rollback(self.A, "apply"), "migrations differ")

    def test_migration_check_uses_main_not_head(self):
        self.assertEqual(self.rollback(self.A, "apply").returncode, 0)
        c = self.commit("services/api/src/migrations/002.ts")
        self.deploy(c, FAIL_AT="migrate")
        self.git("checkout", "-q", "--detach", self.B)
        r = self.rollback(self.A, "apply")
        self.assertIn("migrations differ", r.stdout)

    def test_compose_differs(self):
        self.deploy(self.commit("docker-compose.server.yml"), FAIL_AT="build")
        (self.d / "docker.log").unlink()
        self.no(self.rollback(self.A, "apply"), "docker-compose.server.yml differs")

    def test_dirty_lock_env(self):
        (self.srv / "app.txt").write_text("x")
        self.no(self.rollback(self.A, "apply"), "tracked files are modified")
        self.git("checkout", "-q", "app.txt")
        h = subprocess.Popen(["flock", "-n", str(self.lock), "sh", "-c", "echo held; exec sleep 30"], stdout=subprocess.PIPE, text=True)
        h.stdout.readline()
        self.no(self.rollback(self.A, "apply"), "another deploy or rollback")
        subprocess.run(["pkill", "-P", str(h.pid)])
        h.wait()
        h.stdout.close()
        self.env_intact = lambda: None
        (self.srv / ".env.production").unlink()
        self.no(self.rollback(self.A, "apply"), ".env.production missing")

    def test_target_tracking_env_production(self):
        c = self.commit(".env.production", "PLANTED=1\n")
        self.git("rm", "-q", "--cached", ".env.production", cwd=self.dev)
        self.git("commit", "-q", "-m", "untrack", cwd=self.dev)
        self.git("push", "-q", "origin", "main", cwd=self.dev)
        d = self.git("rev-parse", "HEAD", cwd=self.dev)
        self.assertEqual(self.deploy(d).returncode, 0)
        (self.d / "docker.log").unlink()
        self.log.write_text(self.log.read_text() + f"2026-01-02T00:00:00Z {c} deploy\n")
        r = self.rollback(c, "apply")
        self.assertIn("target tracks .env.production", r.stdout)
        self.assertEqual(self.docker(), [])

    def test_failures_by_stage(self):
        for at, stages in (("build", ["build"]), ("up", ["build", "up"])):
            with self.subTest(at):
                r = self.rollback(self.A, "apply", FAIL_AT=at)
                self.assertNotEqual(r.returncode, 0)
                self.assertEqual(self.stage(0), stages)
                self.assertEqual(self.logged()[-1], [self.B, "deploy"])
                (self.d / "docker.log").unlink()
        self.assertEqual(self.rollback(self.A, "apply").returncode, 0)  # retry

    def test_checkout_moved_during_build(self):
        (self.d / "on_build").write_text(f'git -C "{self.srv}" checkout -q main\n')
        r = self.rollback(self.A, "apply")
        self.assertIn("checkout is not the target", r.stdout)
        self.assertEqual(self.stage(0), ["build"])

    def test_git_pull_hazard_documented(self):
        """Why the runbook forbids it: pull moves a detached rollback forward."""
        self.rollback(self.A, "apply")
        self.git("pull", "-q", "origin", "main")
        self.assertEqual(self.head(), self.B)

    def test_runbook_install_line_extracts_the_tested_script(self):
        f = self.d / "r.md"
        f.write_text(RUNBOOK)
        out = subprocess.run(["sed", "-n", r"/^# BEGIN ROLLBACK SCRIPT$/,/^# END ROLLBACK SCRIPT$/p", str(f)], text=True, capture_output=True).stdout
        self.assertEqual(out.strip(), ROLLBACK)
        self.assertIn(r"/^# BEGIN ROLLBACK SCRIPT$/,/^# END ROLLBACK SCRIPT$/p", RUNBOOK)

    def test_manual_deploy_line_extracts_the_workflow_script(self):
        line = next(l for l in RUNBOOK.splitlines() if "noetia-deploy.sh" in l and l.startswith("cd /opt"))
        c = self.commit(".github/workflows/cd.yml", CD)
        line = line.replace("/opt/noetia", str(self.srv)).replace("/root/", f"{self.d}/").replace("<SHA>", c)
        line = line.replace("&& sh ", f"&& sed -i -e 's#/opt/noetia#{self.srv}#' -e 's#/var/lock/noetia-deploy.lock#{self.lock}#' {self.d}/noetia-deploy.sh && sh ")
        r = self._run(["bash", "-c", line])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.logged()[-1], [c, "deploy"])
        self.env_intact()


class RunnerTests(Base):
    @classmethod
    def setUpClass(cls):
        cls.keys = pathlib.Path(tempfile.mkdtemp(prefix="dep1k-"))
        cls.K, cls.F = {}, {}
        for n, extra in (("good", ["-N", ""]), ("other", ["-N", ""]), ("locked", ["-N", "passphrase"])):
            subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-f", str(cls.keys / n), *extra], check=True)
            cls.K[n] = (cls.keys / n).read_text()
            cls.F[n] = subprocess.run(["ssh-keygen", "-lf", str(cls.keys / n) + ".pub"], text=True, capture_output=True).stdout.split()[1]
        cls.pub = (cls.keys / "good.pub").read_text()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.keys)

    def step(self, i, **env):
        # GitHub runs `run:` with bash -e
        return subprocess.run(["bash", "-e", "-c", STEPS[i]["run"]], env={**self.env, "TMPDIR": str(self.d), **env}, text=True, capture_output=True)

    def ref(self, **kw):
        s = "a" * 40
        return self.step(0, **{"GITHUB_REF": "refs/heads/main", "GITHUB_SHA": s, "GITHUB_REPOSITORY": "o/r", "GH_TOKEN": "x", "GH_TIP": s, **kw})

    def test_expected(self):
        self.assertEqual(self.ref().returncode, 0)

    def test_refused(self):
        for kw, msg in (({"GITHUB_REF": "refs/heads/staging"}, "not refs/heads/main"), ({"GITHUB_REF": "refs/tags/main"}, "not refs/heads/main"),
                        ({"GITHUB_REF": "refs/pull/1/merge"}, "not refs/heads/main"), ({"GITHUB_REF": "main"}, "not refs/heads/main"),
                        ({"GITHUB_SHA": "abc", "GH_TIP": "abc"}, "malformed"), ({"GITHUB_SHA": "", "GH_TIP": ""}, "malformed"),
                        ({"GH_TIP": "b" * 40}, "not the tip"), ({"GH_TIP": ""}, "not the tip"), ({"GH_FAIL": "1"}, "cannot read")):
            with self.subTest(kw):
                r = self.ref(**kw)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn(msg, r.stdout)

    def key(self, **kw):
        r = self.step(1, **{"KEY": self.K["good"], "WANT_KEY": self.F["good"], "WANT_HOST": FP, **kw})
        out = r.stdout + r.stderr
        for k in self.K.values():
            for l in k.splitlines()[1:-1]:
                self.assertNotIn(l, out)
        self.assertEqual([p.name for p in self.d.iterdir() if p.name.startswith("tmp.")], [], "key file left behind")
        return r

    def test_key_accepted(self):
        for k in (self.K["good"], self.K["good"].rstrip("\n")):  # secrets are often pasted without the final newline
            self.assertEqual(self.key(KEY=k).returncode, 0)

    def test_key_refused(self):
        for kw, msg in (({"KEY": ""}, "deploy key missing"), ({"KEY": "garbage"}, "unreadable"), ({"KEY": self.pub}, "unreadable"),
                        ({"KEY": self.K["locked"], "WANT_KEY": self.F["locked"]}, "unreadable"),
                        ({"KEY": self.K["other"]}, "not the expected"), ({"WANT_KEY": FP}, "not the expected"),
                        ({"WANT_KEY": ""}, "DEPLOY_KEY_FINGERPRINT"), ({"WANT_HOST": ""}, "DEPLOY_HOST_FINGERPRINT")):
            with self.subTest(msg):
                r = self.key(**kw)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn(msg, r.stdout)

    def test_malformed_fingerprints(self):
        for v in (" ", "MD5:aa:bb", "SHA256:", FP + "=", FP + "A", FP[:-1], " " + FP, FP + " ", FP + "\n" + FP, "x\n" + FP, "SHA256:" + "." * 43):
            for name in ("WANT_KEY", "WANT_HOST"):
                with self.subTest((name, v)):
                    r = self.key(**{name: v})
                    self.assertNotEqual(r.returncode, 0)
                    self.assertIn("missing or malformed", r.stdout)


class WorkflowContract(unittest.TestCase):
    def test_only_trigger_is_push_to_main(self):
        self.assertEqual(WF["on"], {"push": {"branches": ["main"]}})

    def test_permissions_and_concurrency(self):
        self.assertEqual(WF["permissions"], {"contents": "read"})
        self.assertEqual(WF["concurrency"], {"group": "deploy-production", "cancel-in-progress": "false"})

    def test_job(self):
        self.assertEqual(list(WF["jobs"]), ["deploy"])
        j = WF["jobs"]["deploy"]
        self.assertEqual(j["environment"]["name"], "production")
        self.assertEqual(j["timeout-minutes"], "45")
        for k in ("if", "continue-on-error", "permissions"):
            self.assertNotIn(k, j)
        self.assertEqual(len(STEPS), 3)
        for s in STEPS:
            for k in ("if", "continue-on-error"):
                self.assertNotIn(k, s)

    def test_ssh_step(self):
        s = STEPS[2]
        self.assertRegex(s["uses"], r"^appleboy/ssh-action@[0-9a-f]{40}$")
        w = s["with"]
        self.assertEqual({k: w[k] for k in w if k != "script"}, {
            "host": "84.247.140.175", "username": "root", "port": "222", "key": "${{ secrets.DEPLOY_SSH_KEY }}",
            "fingerprint": "${{ vars.DEPLOY_HOST_FINGERPRINT }}", "timeout": "30s", "command_timeout": "30m"})

    def test_validated_values_are_the_used_values(self):
        e = STEPS[1]["env"]
        self.assertEqual(e, {"KEY": "${{ secrets.DEPLOY_SSH_KEY }}", "WANT_KEY": "${{ vars.DEPLOY_KEY_FINGERPRINT }}", "WANT_HOST": "${{ vars.DEPLOY_HOST_FINGERPRINT }}"})

    def test_nothing_destructive(self):
        for name, text in (("deploy", DEPLOY), ("rollback", ROLLBACK)):
            code = "\n".join(l for l in text.splitlines() if not l.strip().startswith("#"))
            for bad in (r"\breset\b", r"\bclean\b", r"--force\b", r"\bstash\b", r"checkout\s+(-\S+\s+)*-f\b", r"\bdown\b", r"\brm\b", r"git pull", r"--volumes", r"system prune", r"migration:revert", r"-B\b"):
                self.assertNotRegex(code, bad, name)

    def test_only_expression_in_server_script(self):
        self.assertEqual(re.findall(r"\$\{\{.*?\}\}", DEPLOY), ["${{ github.sha }}"])


if __name__ == "__main__":
    unittest.main()
