/**
 * PR #60 payment-safety verification against REAL PostgreSQL (not a unit test; never run against a shared,
 * staging or production database — it inserts synthetic users, subscriptions, tokens and gifts).
 *
 * Runs the REAL WebhooksService / SubscriptionsService / GiftsService on a real TypeORM DataSource. Only the
 * Stripe client, e-mail and push are faked (no network). Concurrency is real: parallel calls use separate pool
 * connections, so row locks, the primary key on stripe_processed_events and advisory locks are PostgreSQL's.
 *
 * Usage (disposable database with all migrations applied):
 *   PGH_PORT=55432 PGH_PASS=… npx ts-node --transpile-only -P tsconfig.json scripts/payment-safety-pg-check.ts
 * Negative control: PGH_SRC=<path to another checkout's services/api/src> runs the same scenarios against that
 * code (the constructors and public entry points are unchanged between the versions compared).
 *
 * Exit code 0 = every scenario passed.
 */
import 'reflect-metadata';
import { fork } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { DataSource } from 'typeorm';

const SRC = path.resolve(process.env.PGH_SRC ?? path.join(__dirname, '..', 'src'));
const load = (p: string) => require(path.join(SRC, p));

const { SubscriptionsService } = load('subscriptions/subscriptions.service');
const { WebhooksService } = load('subscriptions/webhooks.service');
const { GiftsService } = load('gifts/gifts.service');
const { PlansService } = load('subscriptions/plans.service');
const { Subscription } = load('subscriptions/subscription.entity');
const { User } = load('users/user.entity');
const { Plan } = load('subscriptions/plan.entity');
const { TokenPackage } = load('subscriptions/token-package.entity');
const { TokenLedger } = load('subscriptions/token-ledger.entity');
const { StripeProcessedEvent } = load('subscriptions/stripe-processed-event.entity');
const { GiftCard } = load('gifts/gift-card.entity');
const { Book } = load('books/book.entity');
const { UserBook } = load('library/user-book.entity');
const { SubscriptionInvite } = load('subscriptions/subscription-invite.entity');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.PGH_HOST ?? '127.0.0.1',
  port: parseInt(process.env.PGH_PORT ?? '55432', 10),
  username: process.env.PGH_USER ?? 'noetia',
  password: process.env.PGH_PASS ?? 'harness',
  database: process.env.PGH_DB ?? 'noetia',
  entities: [path.join(SRC, '**/*.entity.{ts,js}')],
  synchronize: false,
  extra: { max: 20 },
});

// ── fakes (Stripe, e-mail, push) ────────────────────────────────────────────
type StripeSub = { id: string; customer: string; status: string; priceId: string };
const stripeSubs = new Map<string, StripeSub>();
const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8)));
const fakeStripe = {
  subscriptions: {
    retrieve: async (id: string) => {
      await jitter(); // network latency → real interleaving of concurrent webhook transactions
      const s = stripeSubs.get(id);
      if (!s) throw new Error(`No such subscription ${id}`);
      return {
        id: s.id, customer: s.customer, status: s.status, cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        trial_end: s.status === 'trialing' ? Math.floor(Date.now() / 1000) + 14 * 86400 : null,
        items: { data: [{ price: { id: s.priceId } }] },
      };
    },
  },
};
const emails: Array<{ kind: string; to: string; claimToken?: string }> = [];
const logs: string[] = [];
const quietLogger = { log: () => undefined, warn: (m: string) => logs.push(String(m)), error: (m: string) => logs.push(String(m)) };

function build() {
  const config = { get: (k: string, d?: string) => (k === 'STRIPE_SECRET_KEY' ? 'sk_test_harness_synthetic' : d ?? '') };
  const emailService = {
    sendGiftCard: async (to: string, _b: string, _c: number, _m: string, _o: string, claimToken: string) => { emails.push({ kind: 'gift', to, claimToken }); },
    sendGiftConfirmation: async (to: string) => { emails.push({ kind: 'confirm', to }); },
  };
  const pushService = { sendToUser: async () => undefined };
  const plans = new PlansService(ds.getRepository(Plan), ds.getRepository(TokenPackage));
  const users = { findById: (id: string) => ds.getRepository(User).findOneBy({ id }) };
  const subs = new SubscriptionsService(
    config, users, plans, emailService, pushService,
    ds.getRepository(Subscription), ds.getRepository(User), ds.getRepository(Book), ds.getRepository(UserBook),
    ds.getRepository(TokenLedger), ds.getRepository(SubscriptionInvite),
  );
  const gifts = new GiftsService(config, emailService, pushService, ds.getRepository(GiftCard), ds.getRepository(TokenLedger), ds.getRepository(User));
  const webhooks = new WebhooksService(subs, gifts, ds.getRepository(StripeProcessedEvent));
  for (const svc of [subs, gifts, webhooks]) (svc as any).logger = quietLogger;
  (subs as any).stripe = fakeStripe;
  (gifts as any).stripe = fakeStripe;
  return { subs, gifts, webhooks };
}

// ── helpers ─────────────────────────────────────────────────────────────────
const q = async (sql: string, params: unknown[] = []) => ds.query(sql, params);
const one = async (sql: string, params: unknown[] = []) => Number((await q(sql, params))[0].n);
const PRICE = 'price_harness_individual_monthly';
const PRICE_ANNUAL = 'price_harness_individual_annual';
let PLAN_ID = '';
let PACKAGE: { id: string; tokenCount: number } = { id: '', tokenCount: 0 };

async function newUser(tag: string) {
  const id = randomUUID();
  const cus = `cus_h_${tag}_${id.slice(0, 8)}`;
  await q(`INSERT INTO users (id, email, name, "stripeCustomerId") VALUES ($1, $2, $3, $4)`, [id, `${tag}-${id.slice(0, 8)}@harness.invalid`, 'Synthetic', cus]);
  return { id, cus };
}
const ev = (id: string, type: string, object: unknown) => ({ id, type, data: { object } });
const tokensOf = (userId: string) => one(`SELECT count(*) n FROM token_ledger WHERE "userId" = $1`, [userId]);
const processed = (key: string) => one(`SELECT count(*) n FROM stripe_processed_events WHERE "eventId" = $1`, [key]);

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];
function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`);
}
async function settle<T>(ps: Promise<T>[]) {
  const r = await Promise.allSettled(ps);
  return { ok: r.filter((x) => x.status === 'fulfilled').length, failed: r.filter((x) => x.status === 'rejected').map((x: any) => String(x.reason?.message ?? x.reason)) };
}

/** A user with an active subscription whose row already has the plan (so invoice.paid grants tokens). */
async function activeSubscriber(webhooks: any, tag: string) {
  const u = await newUser(tag);
  const sub = `sub_h_${tag}_${u.id.slice(0, 8)}`;
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'active', priceId: PRICE });
  await webhooks.handleEvent(ev(`evt_${tag}_upd_${u.id.slice(0, 8)}`, 'customer.subscription.updated', { id: sub, customer: u.cus }));
  return { ...u, sub };
}

// ── scenarios ───────────────────────────────────────────────────────────────
async function s1SameEventConcurrent(webhooks: any) {
  const u = await activeSubscriber(webhooks, 's1');
  const e = ev(`evt_s1_inv_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s1_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899 });
  const t0 = Date.now();
  const r = await settle(Array.from({ length: 8 }, () => webhooks.handleEvent(e)));
  const n = await tokensOf(u.id);
  record('S1 eight CONCURRENT deliveries of the same invoice.paid event', n === 1 && r.failed.length === 0,
    `tokens=${n} (expected 1); deliveries ok=${r.ok}, failed=${r.failed.length}; ${Date.now() - t0} ms`);
}

async function s2DistinctEventsSameInvoice(webhooks: any) {
  const u = await activeSubscriber(webhooks, 's2');
  const inv = `in_s2_${u.id.slice(0, 8)}`;
  const r = await settle(Array.from({ length: 6 }, (_, i) =>
    webhooks.handleEvent(ev(`evt_s2_${i}_${u.id.slice(0, 8)}`, 'invoice.paid', { id: inv, subscription: u.sub, customer: u.cus, amount_paid: 899 }))));
  const n = await tokensOf(u.id);
  record('S2 six CONCURRENT events with DIFFERENT ids for the same invoice', n === 1 && r.failed.length === 0,
    `tokens=${n} (expected 1); ok=${r.ok}, failed=${r.failed.length}`);
}

async function s3TokenPackageConcurrent(webhooks: any) {
  const u = await newUser('s3');
  const cs = `cs_s3_${u.id.slice(0, 8)}`;
  const obj = { id: cs, mode: 'payment', metadata: { tokenPackageId: PACKAGE.id, userId: u.id } };
  const same = ev(`evt_s3_same_${u.id.slice(0, 8)}`, 'checkout.session.completed', obj);
  const r = await settle([
    ...Array.from({ length: 4 }, () => webhooks.handleEvent(same)),
    ...Array.from({ length: 4 }, (_, i) => webhooks.handleEvent(ev(`evt_s3_${i}_${u.id.slice(0, 8)}`, 'checkout.session.completed', obj))),
  ]);
  const n = await tokensOf(u.id);
  record('S3 token-package purchase: 4 duplicate + 4 distinct-id CONCURRENT deliveries of one session', n === PACKAGE.tokenCount && r.failed.length === 0,
    `tokens=${n} (expected ${PACKAGE.tokenCount}); ok=${r.ok}, failed=${r.failed.length}`);
}

async function s4GiftConcurrent(webhooks: any) {
  const tag = randomUUID().slice(0, 8);
  const cs = `cs_s4_${tag}`;
  const recipient = `recipient-${tag}@harness.invalid`;
  const obj = { id: cs, mode: 'payment', metadata: { type: 'gift', recipientEmail: recipient, tokenCount: '3', buyerUserId: '' }, customer_details: { email: `buyer-${tag}@harness.invalid`, name: 'Buyer' } };
  const r = await settle(Array.from({ length: 6 }, (_, i) => webhooks.handleEvent(ev(`evt_s4_${i % 3}_${tag}`, 'checkout.session.completed', obj))));
  const gifts = await q(`SELECT "claimToken" FROM gift_cards WHERE "stripeSessionId" = $1`, [cs]);
  const giftMails = emails.filter((m) => m.kind === 'gift' && m.to === recipient);
  const linkValid = giftMails.length === 1 && gifts.length === 1 && giftMails[0].claimToken === gifts[0].claimToken;
  record('S4 gift: 6 CONCURRENT deliveries (3 event ids) of one session', gifts.length === 1 && giftMails.length === 1 && linkValid && r.failed.length === 0,
    `gift rows=${gifts.length} (expected 1); recipient e-mails=${giftMails.length} (expected 1); e-mailed link matches stored gift=${linkValid}; failed=${r.failed.length}`);
}

async function s5Identity(webhooks: any, rounds: number, existingEnded: boolean) {
  let silentReplacements = 0;
  let wrongRow = 0;
  let neitherApplied = 0;
  for (let i = 0; i < rounds; i++) {
    const u = await newUser(existingEnded ? 's5b' : 's5');
    if (existingEnded) {
      await q(`INSERT INTO subscriptions ("userId", "stripeCustomerId", "stripeSubscriptionId", status) VALUES ($1, $2, $3, 'canceled')`, [u.id, u.cus, `sub_old_${u.id.slice(0, 8)}`]);
    }
    const a = `sub_A_${u.id.slice(0, 8)}`;
    const b = `sub_B_${u.id.slice(0, 8)}`;
    stripeSubs.set(a, { id: a, customer: u.cus, status: 'trialing', priceId: PRICE });
    stripeSubs.set(b, { id: b, customer: u.cus, status: 'trialing', priceId: PRICE });
    const logStart = logs.length;
    await Promise.allSettled([
      webhooks.handleEvent(ev(`evt_s5a_${u.id.slice(0, 8)}`, 'customer.subscription.created', { id: a })),
      webhooks.handleEvent(ev(`evt_s5b_${u.id.slice(0, 8)}`, 'customer.subscription.created', { id: b })),
    ]);
    const row = (await q(`SELECT "stripeSubscriptionId" s, "stripeEventId" e FROM subscriptions WHERE "userId" = $1`, [u.id]))[0];
    const dupLogged = logs.slice(logStart).some((m) => m.includes('DUPLICATE_LIVE_SUBSCRIPTION'));
    // Silent replacement = the row ended on one subscription while the other was ALSO applied, and no
    // duplicate was flagged (both upserts passed the identity check).
    if (!row || (row.s !== a && row.s !== b)) neitherApplied++;
    else if (!dupLogged) silentReplacements++;
    if (row && row.e && !row.e.includes(row.s === a ? 's5a' : 's5b')) wrongRow++;
  }
  const label = existingEnded ? 'S5b re-subscription race (previous row ended)' : 'S5 first-subscription race (no row yet)';
  record(`${label}: ${rounds} rounds of two CONCURRENT live subscriptions for one user`,
    silentReplacements === 0 && neitherApplied === 0 && wrongRow === 0,
    `silent replacements=${silentReplacements} (expected 0); rounds with no subscription applied=${neitherApplied} (expected 0); row/event mismatch=${wrongRow}`);
}

async function s5cLegitResubscribe(webhooks: any) {
  const u = await newUser('s5c');
  const old = `sub_old_${u.id.slice(0, 8)}`;
  const neu = `sub_new_${u.id.slice(0, 8)}`;
  stripeSubs.set(old, { id: old, customer: u.cus, status: 'active', priceId: PRICE });
  await webhooks.handleEvent(ev(`evt_s5c_1_${u.id.slice(0, 8)}`, 'customer.subscription.updated', { id: old }));
  stripeSubs.get(old)!.status = 'canceled';
  await webhooks.handleEvent(ev(`evt_s5c_2_${u.id.slice(0, 8)}`, 'customer.subscription.deleted', { id: old }));
  stripeSubs.set(neu, { id: neu, customer: u.cus, status: 'trialing', priceId: PRICE });
  await webhooks.handleEvent(ev(`evt_s5c_3_${u.id.slice(0, 8)}`, 'customer.subscription.created', { id: neu }));
  const row = (await q(`SELECT "stripeSubscriptionId" s, status FROM subscriptions WHERE "userId" = $1`, [u.id]))[0];
  record('S5c legitimate re-subscription after the old subscription ended still works', row?.s === neu && row?.status === 'trialing',
    `row=${row?.s}(${row?.status}) (expected ${neu}(trialing))`);
}

async function s6Crash(webhooks: any) {
  const u = await activeSubscriber(webhooks, 's6');
  const eventId = `evt_s6_inv_${u.id.slice(0, 8)}`;
  const invoiceId = `in_s6_${u.id.slice(0, 8)}`;
  const child = fork(__filename, ['--crash-child', u.cus, u.sub, eventId, invoiceId], { execArgv: process.execArgv, env: process.env, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  let out = '';
  child.stdout!.on('data', (d) => { out += d; });
  const signal: string | null = await new Promise((r) => child.on('exit', (_c, s) => r(s)));
  // PostgreSQL rolls back the dead client's transaction when it notices the closed socket.
  for (let i = 0; i < 50 && (await one(`SELECT count(*) n FROM pg_stat_activity WHERE application_name = 'pgh-crash-child'`)) > 0; i++) await new Promise((r) => setTimeout(r, 100));
  const afterCrash = { tokens: await tokensOf(u.id), event: await processed(eventId), invoice: await processed(`fulfillment:invoice-tokens:${invoiceId}`) };
  const e = ev(eventId, 'invoice.paid', { id: invoiceId, subscription: u.sub, customer: u.cus, amount_paid: 899 });
  await webhooks.handleEvent(e); // Stripe retry
  await webhooks.handleEvent(e); // and a duplicate redelivery
  const afterRetry = await tokensOf(u.id);
  const pass = signal === 'SIGKILL' && out.includes('TOKENS_INSERTED') && afterCrash.tokens === 0 && afterCrash.event === 0 && afterRetry === 1;
  record('S6 process killed (SIGKILL) after granting tokens, before the event is recorded; then Stripe retries', pass,
    `child: ${out.includes('TOKENS_INSERTED') ? 'tokens inserted' : 'did not reach token insert'}, exit signal=${signal}; ` +
    `after crash: tokens=${afterCrash.tokens}, event rows=${afterCrash.event}, invoice-claim rows=${afterCrash.invoice} (expected 0/0/0 — legacy code shows tokens=1, event rows=0); ` +
    `after retry + redelivery: tokens=${afterRetry} (expected 1)`);
}

async function s7FailedThenRetry(webhooks: any, subs: any) {
  const u = await activeSubscriber(webhooks, 's7');
  const e = ev(`evt_s7_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s7_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899 });
  const real = subs.issueTokens.bind(subs);
  subs.issueTokens = async (...args: unknown[]) => { await real(...args); throw new Error('injected failure after token insert'); };
  let firstFailed = false;
  try { await webhooks.handleEvent(e); } catch { firstFailed = true; }
  subs.issueTokens = real;
  const afterFail = await tokensOf(u.id);
  await webhooks.handleEvent(e);
  const afterRetry = await tokensOf(u.id);
  record('S7 transaction fails after the token insert; the legitimate retry grants exactly once', firstFailed && afterFail === 0 && afterRetry === 1,
    `first delivery threw=${firstFailed}; tokens after failure=${afterFail} (expected 0); after retry=${afterRetry} (expected 1)`);
}

async function s8LockWait(webhooks: any) {
  // Evidence that a duplicate delivery WAITS for the first transaction instead of reading "not processed".
  const u = await activeSubscriber(webhooks, 's8');
  const sub = stripeSubs.get(u.sub)!;
  const e = ev(`evt_s8_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s8_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899 });
  const realRetrieve = fakeStripe.subscriptions.retrieve;
  let calls = 0;
  fakeStripe.subscriptions.retrieve = async (id: string) => { calls++; if (calls === 1) await new Promise((r) => setTimeout(r, 400)); return realRetrieve(id); };
  const t0 = Date.now();
  const timings: number[] = [];
  await Promise.all([
    webhooks.handleEvent(e).then(() => timings.push(Date.now() - t0)),
    new Promise((r) => setTimeout(r, 50)).then(() => webhooks.handleEvent(e)).then(() => timings.push(Date.now() - t0)),
  ]);
  fakeStripe.subscriptions.retrieve = realRetrieve;
  const n = await tokensOf(u.id);
  void sub;
  record('S8 a duplicate arriving mid-transaction blocks until the first commits, then skips', n === 1 && calls === 1,
    `tokens=${n}; Stripe reads=${calls} (expected 1: the duplicate never ran the handler); completion times ms=${timings.join(', ')}`);
}

// ── T-1 scenarios (initial cycle when the trial begins) ────────────────────
const TPC = 1; // tokensPerCycle of the Individual plans (seeded)
function trialSignup(u: { id: string; cus: string }, sub: string) {
  const t = u.id.slice(0, 8);
  return {
    created: (n = 0) => ev(`evt_t_cr${n}_${t}`, 'customer.subscription.created', { id: sub, customer: u.cus }),
    completed: (n = 0) => ev(`evt_t_co${n}_${t}`, 'checkout.session.completed', { mode: 'subscription', subscription: sub, customer: u.cus }),
    updated: (n = 0) => ev(`evt_t_up${n}_${t}`, 'customer.subscription.updated', { id: sub, customer: u.cus }),
    trialInvoice: (n = 0) => ev(`evt_t_in${n}_${t}`, 'invoice.paid', { id: `in_trial_${t}`, subscription: sub, customer: u.cus, amount_paid: 0, billing_reason: 'subscription_create' }),
  };
}

async function t1ConcurrentSignup(webhooks: any, rounds: number) {
  let wrong = 0; let failed = 0;
  for (let i = 0; i < rounds; i++) {
    const u = await newUser('t1');
    const sub = `sub_t1_${u.id.slice(0, 8)}`;
    stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE });
    const e = trialSignup(u, sub);
    // every signup event, each delivered twice with the same id and once more with a new id, all at once
    const all = [e.created(), e.created(), e.created(1), e.completed(), e.completed(), e.completed(1), e.updated(), e.updated(1), e.trialInvoice(), e.trialInvoice(), e.trialInvoice(1)];
    const r = await settle(all.map((x) => webhooks.handleEvent(x)));
    failed += r.failed.length;
    if ((await tokensOf(u.id)) !== TPC) wrong++;
  }
  record(`T1 T-1: ${rounds} rounds × 11 CONCURRENT signup deliveries (created/completed/updated/$0 invoice, duplicates + new ids)`, wrong === 0 && failed === 0,
    `rounds with a token count other than ${TPC}: ${wrong} (expected 0); failed deliveries: ${failed}`);
}

async function t2AllOrders(webhooks: any) {
  const names = ['created', 'completed', 'updated', 'trialInvoice'] as const;
  const perms = (xs: readonly string[]): string[][] => (xs.length <= 1 ? [xs.slice()] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  const bad: string[] = [];
  for (const order of perms(names)) {
    const u = await newUser('t2');
    const sub = `sub_t2_${u.id.slice(0, 8)}`;
    stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE });
    const e = trialSignup(u, sub) as any;
    for (const n of order) await webhooks.handleEvent(e[n]());
    const n = await tokensOf(u.id);
    if (n !== TPC) bad.push(`${order.join('→')}=${n}`);
  }
  record('T2 T-1: all 24 delivery orders of the four signup events', bad.length === 0,
    `orders with a token count other than ${TPC}: ${bad.length} (expected 0)${bad.length ? ' — ' + bad.slice(0, 4).join(', ') : ''}`);
}

async function t3TrialCrash(webhooks: any) {
  const u = await newUser('t3');
  const sub = `sub_t3_${u.id.slice(0, 8)}`;
  const eventId = `evt_t3_${u.id.slice(0, 8)}`;
  const child = fork(__filename, ['--trial-crash-child', u.cus, sub, eventId], { execArgv: process.execArgv, env: process.env, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  let out = '';
  child.stdout!.on('data', (d) => { out += d; });
  const signal: string | null = await new Promise((r) => child.on('exit', (_c, sg) => r(sg)));
  for (let i = 0; i < 50 && (await one(`SELECT count(*) n FROM pg_stat_activity WHERE application_name = 'pgh-crash-child'`)) > 0; i++) await new Promise((r) => setTimeout(r, 100));
  const after = { tokens: await tokensOf(u.id), claim: await processed(`fulfillment:trial-start-tokens:${sub}`), row: await one(`SELECT count(*) n FROM subscriptions WHERE "userId" = $1`, [u.id]) };
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE });
  await webhooks.handleEvent(ev(eventId, 'customer.subscription.created', { id: sub, customer: u.cus })); // Stripe retry
  const e = trialSignup(u, sub);
  await webhooks.handleEvent(e.completed());
  await webhooks.handleEvent(e.trialInvoice());
  const final = await tokensOf(u.id);
  record('T3 T-1: SIGKILL after the trial grant inserted tokens, before COMMIT; then retry + other signup events',
    signal === 'SIGKILL' && out.includes('TOKENS_INSERTED') && after.tokens === 0 && after.claim === 0 && after.row === 0 && final === TPC,
    `exit signal=${signal}; after crash: tokens=${after.tokens}, trial claim rows=${after.claim}, subscription rows=${after.row} (expected 0/0/0); after retry: tokens=${final} (expected ${TPC})`);
}

async function t4TrialCancelled(webhooks: any) {
  const u = await newUser('t4');
  const sub = `sub_t4_${u.id.slice(0, 8)}`;
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE });
  const e = trialSignup(u, sub);
  await webhooks.handleEvent(e.created());
  stripeSubs.get(sub)!.status = 'canceled';
  await webhooks.handleEvent(ev(`evt_t4_del_${u.id.slice(0, 8)}`, 'customer.subscription.deleted', { id: sub }));
  await webhooks.handleEvent(e.updated());
  await webhooks.handleEvent(e.completed());
  await webhooks.handleEvent(e.trialInvoice());
  const n = await tokensOf(u.id);
  const st = (await q(`SELECT status FROM subscriptions WHERE "userId" = $1`, [u.id]))[0]?.status;
  const active = await one(`SELECT count(*) n FROM token_ledger WHERE "userId" = $1 AND status = 'active'`, [u.id]);
  record('T4 T-1: trial cancelled before paying, then late events', n === TPC && active === TPC && st === 'canceled',
    `tokens=${n}, still active=${active} (expected ${TPC}, no claw-back); row status=${st}`);
}

async function t5FirstPaidInvoice(webhooks: any) {
  const u = await newUser('t5');
  const sub = `sub_t5_${u.id.slice(0, 8)}`;
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE });
  const e = trialSignup(u, sub);
  await webhooks.handleEvent(e.created());
  stripeSubs.get(sub)!.status = 'active';
  const inv = (id: string, invoiceId: string) => ev(id, 'invoice.paid', { id: invoiceId, subscription: sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' });
  const t = u.id.slice(0, 8);
  const r = await settle([inv(`evt_t5_a_${t}`, `in_first_${t}`), inv(`evt_t5_a_${t}`, `in_first_${t}`), inv(`evt_t5_b_${t}`, `in_first_${t}`), inv(`evt_t5_c_${t}`, `in_first_${t}`)].map((x) => webhooks.handleEvent(x)));
  const afterFirst = await tokensOf(u.id);
  await webhooks.handleEvent(inv(`evt_t5_m2_${t}`, `in_second_${t}`));
  const afterSecond = await tokensOf(u.id);
  record('T5 T-1: first paid invoice (4 concurrent deliveries, 3 ids) then the next monthly invoice',
    afterFirst === 2 * TPC && afterSecond === 3 * TPC && r.failed.length === 0,
    `after trial + first paid: ${afterFirst} (expected ${2 * TPC}); after second invoice: ${afterSecond} (expected ${3 * TPC})`);
}

async function t6Annual(webhooks: any, subs: any) {
  const u = await newUser('t6');
  const sub = `sub_t6_${u.id.slice(0, 8)}`;
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'trialing', priceId: PRICE_ANNUAL });
  const e = trialSignup(u, sub);
  await Promise.all([webhooks.handleEvent(e.created()), webhooks.handleEvent(e.trialInvoice())]);
  const steps: string[] = [];
  const snap = async (label: string) => {
    const row = (await q(`SELECT status, "nextTokenIssuanceAt" n FROM subscriptions WHERE "userId" = $1`, [u.id]))[0];
    steps.push(`${label}: tokens=${await tokensOf(u.id)} status=${row.status} next=${row.n ? 'set' : 'null'}`);
    return { tokens: await tokensOf(u.id), next: row.n as Date | null };
  };
  const a = await snap('trial start');
  // Cron during the trial — even with an overdue pointer forced, a trialing row is never issued.
  await subs.issueMonthlyTokensForAnnualPlans();
  await q(`UPDATE subscriptions SET "nextTokenIssuanceAt" = now() - interval '1 day' WHERE "userId" = $1`, [u.id]);
  await subs.issueMonthlyTokensForAnnualPlans();
  await q(`UPDATE subscriptions SET "nextTokenIssuanceAt" = NULL WHERE "userId" = $1`, [u.id]);
  const b = await snap('cron during trial (incl. forced overdue pointer)');
  stripeSubs.get(sub)!.status = 'active';
  await webhooks.handleEvent(ev(`evt_t6_y1_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_t6_y1_${u.id.slice(0, 8)}`, subscription: sub, customer: u.cus, amount_paid: 8399, billing_reason: 'subscription_cycle' }));
  const c = await snap('first paid annual invoice');
  const daysAhead = c.next ? (new Date(c.next).getTime() - Date.now()) / 86_400_000 : -1;
  await subs.issueMonthlyTokensForAnnualPlans();
  const d = await snap('cron right after (not due)');
  await q(`UPDATE subscriptions SET "nextTokenIssuanceAt" = now() - interval '1 minute' WHERE "userId" = $1`, [u.id]);
  await subs.issueMonthlyTokensForAnnualPlans();
  const f = await snap('cron when due (simulated day 45)');
  await subs.issueMonthlyTokensForAnnualPlans();
  const g = await snap('cron again same day');
  const pass = a.tokens === 1 && a.next === null && b.tokens === 1 && c.tokens === 2 && daysAhead > 29.9 && daysAhead < 30.1 && d.tokens === 2 && f.tokens === 3 && g.tokens === 3;
  record('T6 T-1 annual plan: trial grant, cron during trial, first paid annual invoice, scheduled monthly issuance', pass,
    `${steps.join(' | ')} | schedule after first paid invoice = +${daysAhead.toFixed(2)} days (expected 30)`);
}

// ── crash child ─────────────────────────────────────────────────────────────
async function crashChild(cus: string, sub: string, eventId: string, invoiceId: string) {
  (ds.options as any).applicationName = 'pgh-crash-child';
  await ds.initialize();
  const { subs, webhooks } = build();
  stripeSubs.set(sub, { id: sub, customer: cus, status: 'active', priceId: PRICE });
  const real = subs.issueTokens.bind(subs);
  subs.issueTokens = async (...args: unknown[]) => {
    await real(...args);
    process.stdout.write('TOKENS_INSERTED\n', () => process.kill(process.pid, 'SIGKILL'));
    await new Promise(() => undefined); // never continue to COMMIT
  };
  await webhooks.handleEvent(ev(eventId, 'invoice.paid', { id: invoiceId, subscription: sub, customer: cus, amount_paid: 899 }));
}

/** Child for T3: killed right after the TRIAL grant inserted its tokens, before COMMIT. */
async function trialCrashChild(cus: string, sub: string, eventId: string) {
  (ds.options as any).applicationName = 'pgh-crash-child';
  await ds.initialize();
  const { subs, webhooks } = build();
  stripeSubs.set(sub, { id: sub, customer: cus, status: 'trialing', priceId: PRICE });
  const real = subs.issueTokens.bind(subs);
  subs.issueTokens = async (...args: unknown[]) => {
    await real(...args);
    process.stdout.write('TOKENS_INSERTED\n', () => process.kill(process.pid, 'SIGKILL'));
    await new Promise(() => undefined);
  };
  await webhooks.handleEvent(ev(eventId, 'customer.subscription.created', { id: sub, customer: cus }));
}

async function main() {
  if (process.argv[2] === '--crash-child') return crashChild(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
  if (process.argv[2] === '--trial-crash-child') return trialCrashChild(process.argv[3], process.argv[4], process.argv[5]);
  await ds.initialize();
  console.log(`payment-safety-pg-check — code under test: ${SRC}`);
  console.log(`PostgreSQL: ${(await q('SELECT version() v'))[0].v}\n`);
  await q(`UPDATE plans SET "stripePriceId" = $1 WHERE name = 'Individual Monthly'`, [PRICE]);
  await q(`UPDATE plans SET "stripePriceId" = $1 WHERE name = 'Individual Annual'`, [PRICE_ANNUAL]);
  PLAN_ID = (await q(`SELECT id FROM plans WHERE "stripePriceId" = $1`, [PRICE]))[0].id;
  PACKAGE = (await q(`SELECT id, "tokenCount" FROM token_packages ORDER BY "tokenCount" DESC LIMIT 1`))[0];
  void PLAN_ID;

  const { subs, webhooks } = build();
  await s1SameEventConcurrent(webhooks);
  await s2DistinctEventsSameInvoice(webhooks);
  await s3TokenPackageConcurrent(webhooks);
  await s4GiftConcurrent(webhooks);
  await s5Identity(webhooks, 25, false);
  await s5Identity(webhooks, 25, true);
  await s5cLegitResubscribe(webhooks);
  await s6Crash(webhooks);
  await s7FailedThenRetry(webhooks, subs);
  await s8LockWait(webhooks);
  await t1ConcurrentSignup(webhooks, 15);
  await t2AllOrders(webhooks);
  await t3TrialCrash(webhooks);
  await t4TrialCancelled(webhooks);
  await t5FirstPaidInvoice(webhooks);
  await t6Annual(webhooks, subs);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  await ds.destroy();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(2);
});
