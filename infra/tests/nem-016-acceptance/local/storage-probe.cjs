// LOCAL ONLY. Runs inside the API container against the compiled StorageService
// and the real AWS SDK. stall: a local server that goes quiet, to show the read
// times out and the socket closes. measure: real sizes against real MinIO.
const net = require('net');
const path = '/app/dist/storage/storage.service.js';
async function stall(mode) {
  let closedAt = null; let accepted = 0;
  const server = net.createServer((sock) => {
    accepted++;
    sock.on('error', () => {});
    sock.on('close', () => { closedAt = Date.now(); });
    sock.once('data', () => {
      if (mode === 'mid-body') sock.write('HTTP/1.1 200 OK\r\nContent-Length: 1000000\r\nContent-Type: text/plain\r\n\r\npartial');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.MINIO_ENDPOINT = '127.0.0.1';
  process.env.MINIO_PORT = String(server.address().port);
  const { StorageService } = require(path);
  const s = new StorageService();
  const started = Date.now(); let error = null;
  await s.getBuffer('books', 'x.txt', { timeoutMs: 2000 }).catch((e) => { error = e.name; });
  const tookMs = Date.now() - started;
  await new Promise((r) => setTimeout(r, 1500));
  const out = { mode, error, tookMs, accepted, socketClosedAfterMs: closedAt ? closedAt - started : null };
  server.close();
  console.log(JSON.stringify(out));
}
async function measure() {
  const { StorageService } = require(path);
  const s = new StorageService();
  const out = {};
  for (const mb of [1, 10, 50, 200]) {
    const buf = Buffer.alloc(mb * 1024 * 1024, 97);
    const key = `probe-${mb}.bin`;
    let t = Date.now(); await s.upload('books', key, buf, 'application/octet-stream'); const upMs = Date.now() - t;
    t = Date.now(); await s.getBuffer('books', key, { timeoutMs: 15000 }); const readMs = Date.now() - t;
    await s.delete('books', key);
    out[`${mb}MB`] = { uploadMs: upMs, boundedReadMs: readMs };
  }
  console.log(JSON.stringify(out));
}
const [cmd, arg] = process.argv.slice(2);
(cmd === 'stall' ? stall(arg) : measure()).then(() => process.exit(0)).catch((e) => { console.error(e.name); process.exit(1); });
