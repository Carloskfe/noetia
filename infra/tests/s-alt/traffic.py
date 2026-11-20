"""S-ALT transition traffic generator (host side, LOCAL ONLY). Drives Traefik on 127.0.0.1:PORT with
credentialed /api POSTs, page GETs and SSR share-page GETs until STOP_FILE exists; prints a JSON summary
with per-stream status histograms and outage windows. Usage: traffic.py PORT STOP_FILE"""
import json, os, sys, threading, time, urllib.error, urllib.request
PORT, STOP = sys.argv[1], sys.argv[2]
SECRET_HDRS = {"Host": "noetia.test", "Authorization": "Bearer SALT-SECRET-TOKEN",
               "Cookie": "refresh_token=SALT-SECRET-COOKIE", "content-type": "application/json"}
streams = {"api_post": [], "page": [], "ssr": []}

def hit(method, path, headers, body=None):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status, r.headers.get("x-who") or ""
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("x-who") or ""
    except Exception as e:
        return 0, type(e).__name__

def loop(name, interval, fn):
    n = 0
    while not os.path.exists(STOP):
        n += 1; t = time.time(); code, who = fn(n)
        streams[name].append((t, code, who)); time.sleep(max(0, interval - (time.time() - t)))

threads = [
    threading.Thread(target=loop, args=("api_post", 0.1, lambda n: hit("POST", "/api/books", SECRET_HDRS, b'{"password":"SALT-SECRET-BODY"}'))),
    threading.Thread(target=loop, args=("page", 0.2, lambda n: hit("GET", "/", {"Host": "noetia.test"}))),
    threading.Thread(target=loop, args=("ssr", 0.5, lambda n: hit("GET", f"/s/salt-tr-{n}", {"Host": "noetia.test", "Authorization": "Bearer SALT-SECRET-TOKEN"}))),
]
for t in threads: t.start()
for t in threads: t.join()

def summary(rows, ok):
    hist = {}; longest = cur = 0.0; start = None; total_bad = 0.0
    for i, (t, code, who) in enumerate(rows):
        key = f"{code}{':' + who if who else ''}"; hist[key] = hist.get(key, 0) + 1
        good = ok(code, who)
        if not good and start is None: start = t
        if good and start is not None:
            d = t - start; total_bad += d; longest = max(longest, d); start = None
    if start is not None:
        d = rows[-1][0] - start; total_bad += d; longest = max(longest, d)
    return {"requests": len(rows), "statuses": hist, "longest_outage_s": round(longest, 1), "total_outage_s": round(total_bad, 1)}

print(json.dumps({
    "api_post": summary(streams["api_post"], lambda c, w: c == 200 and w == "noetia-api"),
    "page": summary(streams["page"], lambda c, w: c == 200),
    "ssr": summary(streams["ssr"], lambda c, w: c in (200, 404)),  # 404 = page rendered from a Noetia api answer (stand-in data)
}))
