"""Identity responder (S-ALT harness, local only). Answers {"who", "path"} and records every
request's Authorization / Cookie / body, readable at GET /__log (that request is not recorded).
PORT may be a comma-separated list (one shared log). START_DELAY=<s> delays listening (models api boot time)."""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

WHO = os.environ["WHO"]
PORTS = [int(p) for p in os.environ.get("PORT", "4000").split(",")]
LOG = []


class Handler(BaseHTTPRequestHandler):
    def _any(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length).decode("utf-8", "replace") if length else ""
        if self.path == "/__log":
            out = json.dumps(LOG)
        else:
            LOG.append({
                "port": self.server.server_address[1],
                "path": self.path,
                "authorization": self.headers.get("authorization"),
                "cookie": self.headers.get("cookie"),
                "body": body,
            })
            out = json.dumps({"who": WHO, "path": self.path})
        data = out.encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("x-who", WHO)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _any

    def log_message(self, *args):
        pass


time.sleep(float(os.environ.get("START_DELAY", "0")))
for p in PORTS[1:]:
    threading.Thread(target=ThreadingHTTPServer(("", p), Handler).serve_forever, daemon=True).start()
ThreadingHTTPServer(("", PORTS[0]), Handler).serve_forever()
