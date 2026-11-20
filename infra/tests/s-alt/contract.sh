#!/usr/bin/env bash
# S-ALT static configuration contract for docker-compose.server.yml + services/web/Dockerfile.
# Evaluates the EFFECTIVE compose model (`docker compose config`) exactly as CD invokes it
# (`--env-file .env.production -f docker-compose.server.yml`), using a throwaway
# .env.production that deliberately sets the OLD generic values (INTERNAL_API_URL=http://api:4000,
# MINIO_ENDPOINT=storage) to prove the compose literals win over the env file.
# No containers, networks or images are created. Needs: docker compose v2, python3, git.
#
# Usage: infra/tests/s-alt/contract.sh [BASE_REF]      (S_ALT_EMIT=<file> also writes the effective values)
#   BASE_REF (optional): also diff the effective model against that ref and fail if anything
#   other than the five S-ALT keys changed (i.e. no unintended change to other services).
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
BASE_REF="${1:-}"
API_ALIAS="noetia-api.internal"; STO_ALIAS="noetia-storage.internal"; API_URL="http://$API_ALIAS:4000"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/s-alt-contract.XXXXXX")"
cleanup() { case "$WORK" in "${TMPDIR:-/tmp}"/s-alt-contract.??????) rm -rf -- "$WORK" ;; esac; }
trap cleanup EXIT

effective() { # stdin = compose file content, $1 = output json
  local d="$WORK/model"   # same path for base and head, so resolved absolute paths compare equal
  mkdir -p "$d"
  cat > "$d/docker-compose.server.yml"
  cat > "$d/.env.production" <<'ENV'
DB_PASS=contract-dummy
MINIO_ACCESS_KEY=contract-dummy
MINIO_SECRET_KEY=contract-dummy
MEILI_MASTER_KEY=contract-dummy
GRAFANA_ADMIN_PASSWORD=contract-dummy
RESEND_API_KEY=contract-dummy
MINIO_PUBLIC_URL=https://storage.contract.invalid
INTERNAL_API_URL=http://api:4000
MINIO_ENDPOINT=storage
ENV
  (cd "$d" && docker compose -p s-alt-contract --env-file .env.production -f docker-compose.server.yml config --format json) > "$1"
}

effective "$WORK/head.json" < "$ROOT/docker-compose.server.yml"
[[ -n "$BASE_REF" ]] && git -C "$ROOT" show "$BASE_REF:docker-compose.server.yml" | effective "$WORK/base.json"

python3 -I - "$WORK/head.json" "$ROOT/services/web/Dockerfile" "${BASE_REF:+$WORK/base.json}" "$API_ALIAS" "$STO_ALIAS" "$API_URL" <<'PY'
import json, re, sys
head = json.load(open(sys.argv[1])); dockerfile = open(sys.argv[2]).read()
base = json.load(open(sys.argv[3])) if sys.argv[3] else None
API_ALIAS, STO_ALIAS, API_URL = sys.argv[4:7]
S = head["services"]; fails = 0; n = 0
def check(cid, desc, ok, got=""):
    global fails, n
    n += 1
    print(f"{'PASS' if ok else 'FAIL'} {cid:<4} {desc}" + ("" if ok else f"   got={got!r}"))
    fails += 0 if ok else 1
def aliases(svc, net):
    return sorted(((S[svc].get("networks") or {}).get(net) or {}).get("aliases") or [])
proxy_name = head["networks"]["proxy"].get("name", "proxy")

check("C1", f"api declares exactly [{API_ALIAS}] on noetia_net", aliases("api", "noetia_net") == [API_ALIAS], aliases("api", "noetia_net"))
check("C2", "api declares NO extra alias on proxy", aliases("api", "proxy") == [], aliases("api", "proxy"))
check("C3", f"storage declares exactly [{STO_ALIAS}] on noetia_net", aliases("storage", "noetia_net") == [STO_ALIAS], aliases("storage", "noetia_net"))
check("C4", "storage declares NO extra alias on proxy", aliases("storage", "proxy") == [], aliases("storage", "proxy"))
check("C5", "api/web/storage still on noetia_net + proxy (Traefik reachability unchanged)",
      all(set((S[s].get("networks") or {}).keys()) == {"noetia_net", "proxy"} for s in ("api", "web", "storage")))
check("C6", f"proxy network still external `{proxy_name}`", head["networks"]["proxy"].get("external") is True and proxy_name == "proxy")
wb = (S["web"].get("build") or {}).get("args") or {}
check("C7", "web build arg INTERNAL_API_URL = unique alias (baked /api rewrite)", wb.get("INTERNAL_API_URL") == API_URL, wb)
check("C8", "web runtime INTERNAL_API_URL = unique alias, wins over .env.production (SSR /s/[id])",
      S["web"]["environment"].get("INTERNAL_API_URL") == API_URL, S["web"]["environment"].get("INTERNAL_API_URL"))
check("C9", "api MINIO_ENDPOINT = unique storage alias, wins over .env.production",
      S["api"]["environment"].get("MINIO_ENDPOINT") == STO_ALIAS, S["api"]["environment"].get("MINIO_ENDPOINT"))
check("C10", "api MINIO_PUBLIC_URL still comes from .env.production (public presigned host unchanged)",
      S["api"]["environment"].get("MINIO_PUBLIC_URL") == "https://storage.contract.invalid", S["api"]["environment"].get("MINIO_PUBLIC_URL"))
m = re.search(r"^ARG INTERNAL_API_URL=(\S+)\s*$", dockerfile, re.M)
check("C11", "Dockerfile ARG INTERNAL_API_URL default = unique alias", bool(m) and m.group(1) == API_URL, m and m.group(1))
check("C12", "Dockerfile ENV INTERNAL_API_URL derives from the ARG (no hard-coded generic name)",
      re.search(r"^ENV INTERNAL_API_URL=\$\{?INTERNAL_API_URL\}?\s*$", dockerfile, re.M) is not None
      and re.search(r"^ENV INTERNAL_API_URL=http://api:", dockerfile, re.M) is None)
owners = {a: s for s, d in S.items() for net, nd in (d.get("networks") or {}).items() for a in ((nd or {}).get("aliases") or [])}
check("C13", "unique aliases owned only by api/storage, and no service sets an alias on proxy",
      {k: v for k, v in owners.items() if k in (API_ALIAS, STO_ALIAS)} == {API_ALIAS: "api", STO_ALIAS: "storage"}
      and all(not ((d.get("networks") or {}).get("proxy") or {}).get("aliases") for d in S.values()), owners)
check("C14", "aliases use the reserved .internal suffix (never resolvable in public DNS)",
      API_ALIAS.endswith(".internal") and STO_ALIAS.endswith(".internal"))
# Consumers: web reads INTERNAL_API_URL (next.config.js rewrite, app/s/[id]); api reads MINIO_ENDPOINT
# (storage + ingestion S3 clients). C18 pins that mapping in source so a new consumer cannot slip in.
consumed = {("web", "INTERNAL_API_URL"), ("api", "MINIO_ENDPOINT")}
gen = [f"{s}.{k}={S[s]['environment'].get(k)}" for s, k in consumed
       if re.search(r"(^|//)(api|storage)(:\d+|$)", str(S[s]["environment"].get(k)))]
check("C15", "the consumed internal endpoints carry no generic `api`/`storage` name after override", gen == [], gen)

if base is not None:
    allowed = {("api", "environment", "MINIO_ENDPOINT"), ("api", "networks", "noetia_net"),
               ("web", "build", "args"), ("web", "environment", "INTERNAL_API_URL"), ("storage", "networks", "noetia_net")}
    diffs = []
    def walk(a, b, path):
        a = {} if a is None and isinstance(b, dict) else a   # `- proxy` (null) == `proxy: {}`
        b = {} if b is None and isinstance(a, dict) else b
        if isinstance(a, dict) and isinstance(b, dict):
            for k in sorted(set(a) | set(b)): walk(a.get(k), b.get(k), path + (k,))
        elif a != b: diffs.append(path)
    walk(base, head, ())
    unexpected = [p for p in diffs if not (p[:1] == ("services",) and p[1:4] in allowed)]
    changed = sorted({p[1] for p in diffs if p[:1] == ("services",)})
    print("     changed paths vs base: " + ", ".join(".".join(p) for p in diffs))
    check("C16", "vs BASE: only the five S-ALT keys changed; every other service/key identical (incl. Traefik labels)",
          unexpected == [], unexpected)
    check("C17", "vs BASE: only services api, storage, web touched", set(changed) <= {"api", "storage", "web"}, changed)
import os, subprocess
root = sys.argv[2].rsplit("/services/web/Dockerfile", 1)[0]
def refs(var):
    out = subprocess.run(["git", "-C", root, "grep", "-l", var, "--", "services/api/src", "services/web/app",
                          "services/web/lib", "services/web/components", "services/web/next.config.js",
                          "services/worker/src"], capture_output=True, text=True).stdout.split()
    return sorted(out)
ia, me = refs("INTERNAL_API_URL"), refs("MINIO_ENDPOINT")
check("C18", "source: INTERNAL_API_URL read only by web, MINIO_ENDPOINT only by api (aliases cover every consumer)",
      ia and all(f.startswith("services/web/") for f in ia) and me and all(f.startswith("services/api/") for f in me),
      {"INTERNAL_API_URL": ia, "MINIO_ENDPOINT": me})
emit = os.environ.get("S_ALT_EMIT")
if emit:  # consumed by run.sh / storage-client.sh so the harness tests the real compose values, not copies
    with open(emit, "w") as f:
        f.write(f"API_ALIAS={aliases('api', 'noetia_net')[0] if aliases('api', 'noetia_net') else ''}\n")
        f.write(f"STO_ALIAS={aliases('storage', 'noetia_net')[0] if aliases('storage', 'noetia_net') else ''}\n")
        f.write(f"WEB_RUNTIME_API={S['web']['environment'].get('INTERNAL_API_URL', '')}\n")
        f.write(f"WEB_BUILD_API={wb.get('INTERNAL_API_URL', '')}\n")
        f.write(f"API_MINIO_ENDPOINT={S['api']['environment'].get('MINIO_ENDPOINT', '')}\n")
print(f"CONTRACT checks={n} failed={fails}")
sys.exit(1 if fails else 0)
PY
