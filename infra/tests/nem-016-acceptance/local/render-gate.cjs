// LOCAL ONLY. Forwards POST /generate to image-gen, stores nothing itself, and can
// hold the finished response so a race test picks the moment a render "completes".
//   POST /hold, POST /release, GET /state -> { waiting, urls }
const http = require('http');
let holding = false; let waiters = []; const urls = [];
const IMAGE_GEN = process.env.IMAGE_GEN_UPSTREAM || 'http://image-gen:5000';
const read = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
http.createServer(async (req, res) => {
  const reply = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.url === '/hold') { holding = true; return reply(200, {}); }
  if (req.url === '/release') { holding = false; const w = waiters; waiters = []; w.forEach((f) => f()); return reply(200, {}); }
  if (req.url === '/state') return reply(200, { waiting: waiters.length, urls });
  if (req.url !== '/generate') return reply(404, {});
  const body = await read(req);
  try {
    const up = await fetch(`${IMAGE_GEN}/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const text = await up.text();
    if (up.ok) { const u = JSON.parse(text).url; if (u) urls.push(u); }
    if (holding) await new Promise((f) => waiters.push(f));
    res.writeHead(up.status, { 'content-type': 'application/json' }); res.end(text);
  } catch (err) { reply(502, { error: err.name }); }
}).listen(5001, '0.0.0.0');
