// A8b, inside the API container: stores a FAKE LinkedIn token for one user, using
// the app's own format. It reaches no external service and prints no secret.
// Usage: node - <userId> (REDIS_URL and SOCIAL_TOKEN_SECRET come from the container)
const { createCipheriv, randomBytes, scryptSync } = require('crypto');
const Redis = require('/app/node_modules/ioredis');
const userId = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(userId || '')) { console.error('bad user id'); process.exit(2); }
const key = scryptSync(process.env.SOCIAL_TOKEN_SECRET, 'salt', 32);
const iv = randomBytes(16);
const c = createCipheriv('aes-256-cbc', key, iv);
const plain = JSON.stringify({ accessToken: 'fake-nem016-token', expiresAt: Date.now() + 3600e3 });
const value = `${iv.toString('hex')}:${Buffer.concat([c.update(plain, 'utf8'), c.final()]).toString('hex')}`;
const redis = new Redis(process.env.REDIS_URL);
redis.set(`social:tokens:${userId}:linkedin`, value, 'EX', 3600)
  .then(() => { console.log('seeded'); return redis.quit(); })
  .catch((e) => { console.error(e.name); process.exit(1); });
