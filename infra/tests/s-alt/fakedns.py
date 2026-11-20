"""Fake upstream resolver (S-ALT harness, LOCAL ONLY). Stands in for the host resolver that Docker's
embedded DNS forwards unknown names to (production: tailnet search domain tail52ba4d.ts.net). Models a Tailscale-MagicDNS-like upstream that is
hostile: it answers names in ANSWER (bare or under the tailnet search domain) with SINK_IP, logs every
query, NXDOMAIN otherwise. MODE=all answers EVERY A query (worst case: a resolver that overrides anything)."""
import os, socket, struct
SINK = os.environ["SINK_IP"]; MODE = os.environ.get("MODE", "magic")
SUFFIX = os.environ.get("TAILNET", "tail-test.ts.net").lower()
NAMES = set(os.environ.get("ANSWER", "noetia-api,noetia-storage,api,storage").split(","))
LOG = "/tmp/queries.log"
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.bind(("0.0.0.0", 53))
def qname(d, o):
    labels = []
    while d[o]:
        n = d[o]; labels.append(d[o+1:o+1+n].decode("ascii", "replace")); o += n + 1
    return ".".join(labels).lower(), o + 1
while True:
    d, a = s.recvfrom(4096)
    try:
        name, end = qname(d, 12); qtype = struct.unpack("!H", d[end:end+2])[0]
    except Exception:
        continue
    first, _, rest = name.partition(".")
    hit = MODE == "all" or (first in NAMES and rest in ("", SUFFIX))
    with open(LOG, "a") as f: f.write(f"{name} type={qtype} {'ANSWER' if hit and qtype == 1 else 'NX/empty'}\n")
    flags = 0x8180 if hit else 0x8183
    ans = b""; an = 0
    if hit and qtype == 1:
        ans = b"\xc0\x0c" + struct.pack("!HHIH", 1, 1, 30, 4) + socket.inet_aton(SINK); an = 1
    s.sendto(d[:2] + struct.pack("!HHHHH", flags, 1, an, 0, 0) + d[12:end+4] + ans, a)
