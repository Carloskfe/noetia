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
type StripeSub = {
  id: string; customer: string; status: string; priceId: string;
  trialStart?: number | null; periodStart?: number; periodEnd?: number; anchor?: number; cancelAtPeriodEnd?: boolean;
};
const stripeSubs = new Map<string, StripeSub>();
const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8)));
const fakeStripe = {
  subscriptions: {
    retrieve: async (id: string) => {
      await jitter(); // network latency → real interleaving of concurrent webhook transactions
      const s = stripeSubs.get(id);
      if (!s) throw new Error(`No such subscription ${id}`);
      return {
        id: s.id, customer: s.customer, status: s.status, cancel_at_period_end: !!s.cancelAtPeriodEnd,
        current_period_start: s.periodStart, billing_cycle_anchor: s.anchor ?? s.periodStart,
        current_period_end: s.periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400,
        trial_end: s.status === 'trialing' ? Math.floor(Date.now() / 1000) + 14 * 86400 : null,
        trial_start: s.trialStart ?? (s.status === 'trialing' ? Math.floor(Date.now() / 1000) : null),
        items: { data: [{ price: { id: s.priceId } }] },
      };
    },
    list: async ({ customer, status }: { customer: string; status?: string }) => {
      await jitter();
      const data = [...stripeSubs.values()]
        .filter((s) => s.customer === customer && (status === 'all' || s.status !== 'canceled'))
        .map((s) => ({ id: s.id, status: s.status, trial_start: s.trialStart ?? null, cancel_at_period_end: !!s.cancelAtPeriodEnd }));
      return { data, has_more: false };
    },
  },
  customers: {
    create: async () => ({ id: `cus_new_${randomUUID().slice(0, 8)}` }),
    list: async () => { if (stripeFailCustomers) throw new Error('stripe unavailable'); return { data: [], has_more: false }; },
  },
  checkout: {
    sessions: {
      list: async ({ customer }: { customer: string }) => {
        await jitter();
        return { data: checkoutSessions.filter((c) => c.customer === customer && c.status === 'open'), has_more: false };
      },
      expire: async (id: string) => { const c = checkoutSessions.find((x) => x.id === id); if (c) c.status = 'expired'; },
      create: async (params: any) => {
        await jitter();
        const cs = { id: `cs_${randomUUID().slice(0, 8)}`, customer: params.customer, status: 'open', mode: params.mode, url: `https://checkout.test/${randomUUID().slice(0, 8)}`, metadata: params.metadata, trial: params.subscription_data?.trial_period_days ?? null };
        checkoutSessions.push(cs);
        return cs;
      },
    },
  },
};
let stripeFailCustomers = false;
const checkoutSessions: any[] = [];
const emails: Array<{ kind: string; to: string; claimToken?: string }> = [];
const logs: string[] = [];
const quietLogger = { log: () => undefined, warn: (m: string) => logs.push(String(m)), error: (m: string) => logs.push(String(m)) };

function build(dsArg: DataSource = ds) {
  const ds = dsArg; // eslint-disable-line @typescript-eslint/no-shadow
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
  const e = ev(`evt_s1_inv_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s1_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' });
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
    webhooks.handleEvent(ev(`evt_s2_${i}_${u.id.slice(0, 8)}`, 'invoice.paid', { id: inv, subscription: u.sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' }))));
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
  const e = ev(eventId, 'invoice.paid', { id: invoiceId, subscription: u.sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' });
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
  const e = ev(`evt_s7_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s7_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' });
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
  const e = ev(`evt_s8_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_s8_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 899, billing_reason: 'subscription_cycle' });
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
  // First paid annual invoice when the trial ends: paid cycle 0 of the period [now, now + 365 d). D2: the scheduler then
  // grants on calendar-month anniversaries of that period (A1 runs a whole year); right after payment nothing is due.
  const ps = Math.floor(Date.now() / 1000);
  Object.assign(stripeSubs.get(sub)!, { status: 'active', periodStart: ps, periodEnd: ps + 365 * 86400, anchor: ps });
  await webhooks.handleEvent(ev(`evt_t6_y1_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_t6_y1_${u.id.slice(0, 8)}`, subscription: sub, customer: u.cus, amount_paid: 8399, billing_reason: 'subscription_cycle', lines: { data: [{ type: 'subscription', period: { start: ps } }] } }));
  const c = await snap('first paid annual invoice');
  await subs.issueMonthlyTokensForAnnualPlans();
  await subs.issueMonthlyTokensForAnnualPlans();
  const d = await snap('scheduler right after (nothing due before the first anniversary)');
  const pass = a.tokens === 1 && a.next === null && b.tokens === 1 && c.tokens === 2 && d.tokens === 2 && d.next !== null;
  record('T6 T-1 annual plan: trial grant, scheduler during trial, first paid annual invoice (cycle 0), nothing extra', pass,
    `${steps.join(' | ')}`);
}

// ── PO D1–D6 scenarios (round 4) ────────────────────────────────────────────
const sec = (iso: string) => Math.floor(new Date(`${iso}Z`).getTime() / 1000);

async function annualRow(tag: string, periodStartIso: string, periodEndIso: string, opts: { status?: string; hintPast?: boolean } = {}) {
  const u = await newUser(tag);
  const sub = `sub_${tag}_${u.id.slice(0, 8)}`;
  const planId = (await q(`SELECT id FROM plans WHERE "stripePriceId" = $1`, [PRICE_ANNUAL]))[0].id;
  await q(`INSERT INTO subscriptions ("userId", "stripeCustomerId", "stripeSubscriptionId", status, "planId", "currentPeriodEnd", "nextTokenIssuanceAt")
           VALUES ($1, $2, $3, $4, $5, $6, ${opts.hintPast ? `now() - interval '1 hour'` : 'NULL'})`,
    [u.id, u.cus, sub, opts.status ?? 'active', planId, new Date(`${periodEndIso}Z`)]);
  stripeSubs.set(sub, { id: sub, customer: u.cus, status: 'active', priceId: PRICE_ANNUAL, periodStart: sec(periodStartIso), periodEnd: sec(periodEndIso), anchor: sec(periodStartIso), cancelAtPeriodEnd: opts.status === 'canceling' });
  return { ...u, sub };
}
const annualClaims = (sub: string) => q(`SELECT "eventId" FROM stripe_processed_events WHERE "eventId" LIKE $1 ORDER BY "eventId"`, [`fulfillment:annual-cycle:${sub}:%`]);

async function a1AnnualYear(webhooks: any, subs: any) {
  // Paid period 2027-01-15 12:00 → 2028-01-15 12:00 UTC; the annual invoice is paid cycle 0; the daily scheduler
  // runs at 01:00 UTC on every simulated day for 400 days (the code under test takes `now` as a parameter).
  const u = await annualRow('a1', '2027-01-15T12:00:00', '2028-01-15T12:00:00');
  await webhooks.handleEvent(ev(`evt_a1_${u.id.slice(0, 8)}`, 'invoice.paid', { id: `in_a1_${u.id.slice(0, 8)}`, subscription: u.sub, customer: u.cus, amount_paid: 8399, billing_reason: 'subscription_cycle', lines: { data: [{ type: 'subscription', period: { start: sec('2027-01-15T12:00:00') } }] } }));
  for (let d = 0; d <= 400; d++) await subs.issueMonthlyTokensForAnnualPlans(new Date(Date.UTC(2027, 0, 15 + d, 1, 0, 0)));
  const n = await tokensOf(u.id);
  const claims = (await annualClaims(u.sub)).map((r: any) => Number(r.eventId.split(':').pop())).sort((a: number, b: number) => a - b);
  record('A1 D2: one annual period on PostgreSQL — invoice + daily scheduler for 400 simulated days', n === 12 && claims.join(',') === '1,2,3,4,5,6,7,8,9,10,11',
    `paid allocations=${n} (expected 12); scheduled cycles claimed k=[${claims.join(',')}] (expected 1…11); none after the period end`);
}

async function a2ParallelSchedulers(subs: any, subs2: any, rounds: number) {
  let wrong = 0; let total = 0;
  const now = new Date(Date.UTC(2027, 3, 20, 1, 0, 0)); // 3 cycles due (Feb, Mar, Apr 15)
  for (let i = 0; i < rounds; i++) {
    const u = await annualRow('a2', '2027-01-15T12:00:00', '2028-01-15T12:00:00', { hintPast: true });
    await Promise.all([subs.issueMonthlyTokensForAnnualPlans(now), subs2.issueMonthlyTokensForAnnualPlans(now)]);
    const n = await tokensOf(u.id);
    total += n; if (n !== 3) wrong++;
    await q(`UPDATE subscriptions SET status = 'canceled' WHERE "userId" = $1`, [u.id]); // isolate later rounds
  }
  record(`A2 two scheduler instances (separate pools) run together, ${rounds} rounds × 3 due cycles`, wrong === 0,
    `rounds with a count other than 3: ${wrong} (expected 0); total ${total} (expected ${3 * rounds})`);
}

async function a3SchedulerCrash(subs: any) {
  if (typeof subs.issueDueAnnualCycles !== 'function') {
    record('A3 scheduler process killed (SIGKILL) after granting a cycle, before COMMIT; then the next run', false,
      'not applicable: this code has no per-cycle annual scheduler (issueDueAnnualCycles)');
    return;
  }
  const u = await annualRow('a3', '2027-01-15T12:00:00', '2028-01-15T12:00:00');
  const child = fork(__filename, ['--annual-crash-child', u.cus, u.sub], { execArgv: process.execArgv, env: process.env, stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  let out = '';
  child.stdout!.on('data', (d) => { out += d; });
  const signal: string | null = await new Promise((r) => child.on('exit', (_c, sg) => r(sg)));
  for (let i = 0; i < 50 && (await one(`SELECT count(*) n FROM pg_stat_activity WHERE application_name = 'pgh-crash-child'`)) > 0; i++) await new Promise((r) => setTimeout(r, 100));
  const after = { tokens: await tokensOf(u.id), claims: (await annualClaims(u.sub)).length };
  const now = new Date(Date.UTC(2027, 3, 20, 1, 0, 0));
  await subs.issueDueAnnualCycles(u.sub, now);
  await subs.issueDueAnnualCycles(u.sub, now);
  const final = await tokensOf(u.id);
  record('A3 scheduler process killed (SIGKILL) after granting a cycle, before COMMIT; then the next run',
    signal === 'SIGKILL' && out.includes('TOKENS_INSERTED') && after.tokens === 0 && after.claims === 0 && final === 3,
    `exit signal=${signal}; after crash: tokens=${after.tokens}, cycle claims=${after.claims} (expected 0/0); after two runs: tokens=${final} (expected 3)`);
}

async function a4CancelAtPeriodEnd(subs: any) {
  const u = await annualRow('a4', '2027-01-15T12:00:00', '2028-01-15T12:00:00', { status: 'canceling' });
  for (let d = 0; d <= 400; d++) {
    const now = new Date(Date.UTC(2027, 0, 15 + d, 1, 0, 0));
    if (now.getTime() >= Date.UTC(2028, 0, 15, 12)) { stripeSubs.get(u.sub)!.status = 'canceled'; await q(`UPDATE subscriptions SET status = 'canceled' WHERE "userId" = $1`, [u.id]); }
    await subs.issueMonthlyTokensForAnnualPlans(now);
  }
  const n = await tokensOf(u.id);
  record('A4 D3: annual subscription cancelled at period end (canceling) keeps its scheduled allocations, none after expiry', n === 11,
    `scheduled allocations=${n} (expected 11; cycle 0 came with the paid invoice before the cancellation)`);
}

async function newBooks(count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) ids.push((await q(`INSERT INTO books (title, author, category, "isPublished") VALUES ($1, 'Synthetic', 'leadership', true) RETURNING id`, [`Harness book ${randomUUID().slice(0, 6)}`]))[0].id);
  return ids;
}
async function giveTokens(userId: string, n: number) {
  for (let i = 0; i < n; i++) await q(`INSERT INTO token_ledger ("userId", type, status, "issuedAt", "expiresAt") VALUES ($1, 'paid', 'active', now() - ($2 || ' seconds')::interval, now() + interval '90 days')`, [userId, String(100 - i)]);
}
const ownedBooks = (userId: string) => one(`SELECT count(*) n FROM user_books WHERE "userId" = $1`, [userId]);
const activeTokens = (userId: string) => one(`SELECT count(*) n FROM token_ledger WHERE "userId" = $1 AND status = 'active'`, [userId]);
const redeemedTokens = (userId: string) => one(`SELECT count(*) n FROM token_ledger WHERE "userId" = $1 AND status = 'redeemed'`, [userId]);

async function r1ParallelRedemption(subs: any) {
  const u = await newUser('r1');
  await giveTokens(u.id, 1);
  const books = await newBooks(5);
  const r = await settle(books.map((b) => subs.redeemToken(u.id, b)));
  const owned = await ownedBooks(u.id); const redeemed = await redeemedTokens(u.id);
  record('R1 one token, five books redeemed at the same moment', r.ok === 1 && owned === 1 && redeemed === 1,
    `succeeded=${r.ok} (expected 1); books owned=${owned}; tokens redeemed=${redeemed} (expected 1/1); others: ${[...new Set(r.failed)].join(' | ')}`);
}

async function r2SharedPool(subs: any, rounds: number) {
  let wrong1 = 0; let wrong2 = 0;
  const planId = (await q(`SELECT id FROM plans WHERE name = 'Dual Reader Monthly'`))[0].id;
  for (let i = 0; i < rounds; i++) {
    for (const poolSize of [1, 2]) {
      const owner = await newUser('r2o'); const member = await newUser('r2m');
      await q(`INSERT INTO subscriptions ("userId", "stripeCustomerId", "stripeSubscriptionId", status, "planId", "linkedUserIds") VALUES ($1, $2, $3, 'active', $4, ARRAY[$5]::uuid[])`,
        [owner.id, owner.cus, `sub_r2_${owner.id.slice(0, 8)}`, planId, member.id]);
      await giveTokens(owner.id, poolSize);
      const [bA, bB] = await newBooks(2);
      const r = await settle([subs.redeemToken(owner.id, bA), subs.redeemToken(member.id, bB)]);
      const redeemed = await redeemedTokens(owner.id);
      const owned = (await ownedBooks(owner.id)) + (await ownedBooks(member.id));
      if (poolSize === 1 && !(r.ok === 1 && redeemed === 1 && owned === 1)) wrong1++;
      if (poolSize === 2 && !(r.ok === 2 && redeemed === 2 && owned === 2)) wrong2++;
    }
  }
  record(`R2 Duo shared pool: plan owner and linked member redeem at the same moment (${rounds} rounds each with 1 and 2 pool tokens)`, wrong1 === 0 && wrong2 === 0,
    `1-token rounds wrong: ${wrong1}; 2-token rounds wrong: ${wrong2} (expected 0/0 — one token never serves two books; two tokens serve both)`);
}

async function r3SameBookTwice(subs: any) {
  const u = await newUser('r3');
  await giveTokens(u.id, 3);
  const [b] = await newBooks(1);
  const r = await settle(Array.from({ length: 4 }, () => subs.redeemToken(u.id, b)));
  const owned = await ownedBooks(u.id); const redeemed = await redeemedTokens(u.id); const active = await activeTokens(u.id);
  record('R3 the same book redeemed four times at once (3 tokens available)', r.ok === 1 && owned === 1 && redeemed === 1 && active === 2,
    `succeeded=${r.ok}; owned=${owned}; tokens redeemed=${redeemed}, still active=${active} (expected 1/1/1/2 — losers' tokens rolled back)`);
}

async function i1InvoiceClasses(webhooks: any) {
  const u = await activeSubscriber(webhooks, 'i1');
  const t = u.id.slice(0, 8);
  const line = (start: number) => ({ lines: { data: [{ type: 'subscription', period: { start } }] } });
  const inv = (id: string, extra: object) => ev(`evt_${id}_${t}`, 'invoice.paid', { id: `in_${id}_${t}`, subscription: u.sub, customer: u.cus, ...extra });
  await settle([
    webhooks.handleEvent(inv('upd', { billing_reason: 'subscription_update', amount_paid: 450 })),
    webhooks.handleEvent(inv('man', { billing_reason: 'manual', amount_paid: 899 })),
  ]);
  const afterNonCycle = await tokensOf(u.id);
  await settle([
    webhooks.handleEvent(inv('zero', { billing_reason: 'subscription_cycle', amount_paid: 0, ...line(1_820_000_000) })),
    webhooks.handleEvent(inv('reis1', { billing_reason: 'subscription_cycle', amount_paid: 0, ...line(1_820_000_000) })),
    webhooks.handleEvent(inv('reis2', { billing_reason: 'subscription_cycle', amount_paid: 0, ...line(1_820_000_000) })),
  ]);
  const afterRenewal = await tokensOf(u.id);
  record('I1 invoice classes on PostgreSQL: paid upgrade + manual (none); a valid $0 renewal and two reissues of it, concurrently (once)',
    afterNonCycle === 0 && afterRenewal === 1, `after upgrade/manual: ${afterNonCycle} (expected 0); after $0 renewal ×3 invoices, same period: ${afterRenewal} (expected 1)`);
}

async function d1TrialEligibility(subs: any) {
  const planId = (await q(`SELECT id FROM plans WHERE "stripePriceId" = $1`, [PRICE]))[0].id;
  const lastFor = (cus: string) => checkoutSessions.filter((c) => c.customer === cus).at(-1);
  const first = await newUser('d1a');
  await subs.createCheckoutSession(first.id, planId);
  const returning = await newUser('d1b');
  await q(`INSERT INTO subscriptions ("userId", "stripeCustomerId", "stripeSubscriptionId", status) VALUES ($1, $2, $3, 'canceled')`, [returning.id, returning.cus, `sub_old_${returning.id.slice(0, 8)}`]);
  await subs.createCheckoutSession(returning.id, planId);
  const stripeOnly = await newUser('d1c');
  stripeSubs.set(`sub_hist_${stripeOnly.id.slice(0, 8)}`, { id: `sub_hist_${stripeOnly.id.slice(0, 8)}`, customer: stripeOnly.cus, status: 'canceled', priceId: PRICE, trialStart: 1_790_000_000 });
  await subs.createCheckoutSession(stripeOnly.id, planId);
  const racer = await newUser('d1d');
  const race = await settle(Array.from({ length: 4 }, () => subs.createCheckoutSession(racer.id, planId)));
  const racerSessions = checkoutSessions.filter((c) => c.customer === racer.cus).length;
  const unverifiable = await newUser('d1e');
  stripeFailCustomers = true;
  const fail = await settle([subs.createCheckoutSession(unverifiable.id, planId)]);
  stripeFailCustomers = false;
  const pass = lastFor(first.cus)?.trial === 14 && lastFor(first.cus)?.metadata?.noetiaTrial === 'yes'
    && lastFor(returning.cus)?.trial === null && lastFor(returning.cus)?.metadata?.noetiaTrial === 'no'
    && lastFor(stripeOnly.cus)?.trial === null && race.ok === 4 && racerSessions === 1
    && fail.ok === 0 && checkoutSessions.filter((c) => c.customer === unverifiable.cus).length === 0;
  record('D1 checkout trial eligibility (real advisory lock, real rows; fake Stripe)', pass,
    `first-time → trial ${lastFor(first.cus)?.trial}; returning (Noetia row) → trial ${lastFor(returning.cus)?.trial}; Stripe-only history → trial ${lastFor(stripeOnly.cus)?.trial}; ` +
    `4 concurrent checkouts → ${race.ok} answers, ${racerSessions} session (expected 1); history unverifiable → ${fail.failed[0] ?? 'no error'} and no session`);
}

/** Child for A3: killed right after the scheduler granted a cycle's tokens, before COMMIT. */
async function annualCrashChild(cus: string, sub: string) {
  (ds.options as any).applicationName = 'pgh-crash-child';
  await ds.initialize();
  const { subs } = build();
  stripeSubs.set(sub, { id: sub, customer: cus, status: 'active', priceId: PRICE_ANNUAL, periodStart: sec('2027-01-15T12:00:00'), periodEnd: sec('2028-01-15T12:00:00'), anchor: sec('2027-01-15T12:00:00') });
  const real = subs.issueTokens.bind(subs);
  subs.issueTokens = async (...args: unknown[]) => {
    await real(...args);
    process.stdout.write('TOKENS_INSERTED\n', () => process.kill(process.pid, 'SIGKILL'));
    await new Promise(() => undefined);
  };
  await subs.issueDueAnnualCycles(sub, new Date(Date.UTC(2027, 3, 20, 1, 0, 0)));
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
  await webhooks.handleEvent(ev(eventId, 'invoice.paid', { id: invoiceId, subscription: sub, customer: cus, amount_paid: 899, billing_reason: 'subscription_cycle' }));
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
  if (process.argv[2] === '--annual-crash-child') return annualCrashChild(process.argv[3], process.argv[4]);
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
  // Round 4 — PO D1–D6 + atomic redemption + scheduler concurrency
  const ds2 = new DataSource({ ...(ds.options as any) });
  await ds2.initialize();
  const { subs: subs2 } = build(ds2);
  await d1TrialEligibility(subs);
  await a1AnnualYear(webhooks, subs);
  await a2ParallelSchedulers(subs, subs2, 20);
  await a3SchedulerCrash(subs);
  await a4CancelAtPeriodEnd(subs);
  await i1InvoiceClasses(webhooks);
  await r1ParallelRedemption(subs);
  await r2SharedPool(subs, 10);
  await r3SameBookTwice(subs);
  await ds2.destroy();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  await ds.destroy();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(2);
});
