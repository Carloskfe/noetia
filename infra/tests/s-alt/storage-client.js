// S-ALT: exercise the REAL api StorageService (compiled into the candidate api image) against a real MinIO
// reached through the unique alias. Run inside the saltbuild-api image by storage-client.sh. LOCAL ONLY.
// argv[2] = phase: setup | roundtrip | presign-compare | down
const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { StorageService } = require('/app/dist/storage/storage.service');
const phase = process.argv[2];
const out = (o) => console.log(JSON.stringify(o));

async function main() {
  if (phase === 'setup') {
    const c = new S3Client({ endpoint: `http://${process.env.MINIO_ENDPOINT}:9000`, region: 'us-east-1', forcePathStyle: true,
      credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY } });
    await c.send(new CreateBucketCommand({ Bucket: 'books' })).catch((e) => { if (e.name !== 'BucketAlreadyOwnedByYou') throw e; });
    return out({ ok: true });
  }
  if (phase === 'roundtrip') {
    const s = new StorageService();
    await s.upload('books', 's-alt/probe.txt', Buffer.from('S-ALT round trip'), 'text/plain');
    const text = await s.getText('s-alt/probe.txt', 'books');
    const presigned = new URL(await s.presign('books', 's-alt/probe.txt', 60));
    return out({ text, presignedHost: presigned.host, presignedPath: presigned.pathname, publicUrl: s.publicUrl('images', 'a.png') });
  }
  if (phase === 'presign-compare') {
    // Freeze the clock so two signatures are comparable byte for byte; only MINIO_ENDPOINT differs.
    const T = Date.UTC(2026, 0, 1); const Real = Date;
    global.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
    process.env.MINIO_ENDPOINT = 'storage';
    const before = await new StorageService().presign('books', 'x/y.mp3', 3600);
    process.env.MINIO_ENDPOINT = process.argv[3];
    const after = await new StorageService().presign('books', 'x/y.mp3', 3600);
    return out({ identical: before === after, host: new URL(after).host, before, after });
  }
  if (phase === 'down') {
    const s = new StorageService();
    try { await s.getText('s-alt/probe.txt', 'books'); return out({ error: null }); }
    catch (e) { return out({ error: e.code || e.cause?.code || e.name }); }
  }
}
main().catch((e) => { out({ fatal: e.name, code: e.code, message: String(e.message).slice(0, 200) }); process.exit(1); });
