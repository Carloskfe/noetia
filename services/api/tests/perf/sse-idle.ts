/**
 * NEM-024 Checkpoint E — SSE behaviour through a proxy with an idle (read) timeout. Test tooling only.
 *
 * Opens POST /knowledge/sessions/:id/turns/stream through BASE (e.g. a disposable nginx with a short
 * proxy_read_timeout), timestamps every frame, reports whether the terminal arrived or the connection was cut, then
 * replays the SAME key directly against the API to show the turn's recorded outcome (a cut never cancels; D-9 a).
 *
 * Usage: node sse-idle.js <proxyBase> <apiBase> <controlBase> <label> [silent]
 */
const [proxyBase, apiBase, control, label, silent] = process.argv.slice(2);

async function streamFrames(url: string, token: string, key: string, question: string) {
  const t0 = Date.now();
  const out: { t: number; event: string; data?: unknown }[] = [];
  let ended: string = 'eof-without-terminal';
  let status = 0;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, accept: 'text/event-stream' }, body: JSON.stringify({ idempotencyKey: key, question }) });
    status = res.status;
    out.push({ t: Date.now() - t0, event: `http-${res.status} buffering=${res.headers.get('x-accel-buffering')} type=${res.headers.get('content-type')}` });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const [ev, da] = buf.slice(0, i).split('\n');
        buf = buf.slice(i + 2);
        const event = ev.replace('event: ', '');
        const data = da ? JSON.parse(da.replace('data: ', '')) : undefined;
        out.push({ t: Date.now() - t0, event, data: event === 'terminal' ? { outcome: (data as { outcome: string }).outcome, statusCode: (data as { statusCode: number }).statusCode } : data });
        if (event === 'terminal') ended = 'terminal';
      }
    }
  } catch (e) {
    ended = `error: ${(e as Error).message}`;
  }
  return { status, ended, totalMs: Date.now() - t0, frames: out };
}

async function main() {
  const s = await (await fetch(`${control}/research-session`)).json() as { sessionId: string; token: string };
  if (silent) await fetch(`${control}/sim-silent`);
  const key = `sse-${label}-${Date.now()}`;
  const q = 'ramo';
  const viaProxy = await streamFrames(`${proxyBase}/knowledge/sessions/${s.sessionId}/turns/stream`, s.token, key, q);
  await new Promise((r) => setTimeout(r, Number(process.env.SSE_SETTLE_MS ?? 12000))); // let the server finish the turn
  const replay = await streamFrames(`${apiBase}/knowledge/sessions/${s.sessionId}/turns/stream`, s.token, key, q);
  process.stdout.write(`SSE_IDLE ${JSON.stringify({ label, silent: Boolean(silent), viaProxy, replay: { ended: replay.ended, terminal: replay.frames.find((f) => f.event === 'terminal')?.data, stages: replay.frames.filter((f) => f.event === 'stage').length } })}\n`);
}
main().catch((e) => { process.stderr.write(`${(e as Error).stack}\n`); process.exit(1); });

export {};
