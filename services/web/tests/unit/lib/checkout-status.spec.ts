// G-1 client helpers (lib/checkout-status.ts) and the PO-2 copy contract (design §R4).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MAX_RETRY_AFTER_MS,
  MAX_STATUS_REQUESTS,
  POLL_DELAYS_MS,
  deriveFromError,
  deriveFromResponse,
  nextDelay,
  statusPath,
  successReturnPath,
} from '../../../lib/checkout-status';
import { en } from '../../../lib/i18n/en';
import { es } from '../../../lib/i18n/es';

const sub = (o: any) => ({ kind: 'subscription', checkout: 'complete', entitlement: null, ...o });
const tok = (o: any) => ({ kind: 'tokens', checkout: 'complete', payment: 'paid', delivery: null, ...o });
const book = (o: any) => ({ kind: 'book', checkout: 'complete', payment: 'paid', delivery: null, ...o });

describe('deriveFromResponse — verified state → copy key (§R4.4) and terminality (§R3.5)', () => {
  it.each([
    // checkout
    [sub({ checkout: 'open' }), 'checkoutOpen', false],
    [tok({ checkout: 'open', payment: 'unpaid' }), 'checkoutOpen', false],
    [book({ checkout: 'open', payment: 'unpaid' }), 'checkoutOpen', false],
    [sub({ checkout: 'expired' }), 'checkoutExpired', true],
    [tok({ checkout: 'expired', payment: 'unpaid' }), 'checkoutExpired', true],
    [book({ checkout: 'expired', payment: 'unpaid' }), 'checkoutExpired', true],
    // tokens (R1-B)
    [tok({ payment: 'unpaid' }), 'paymentNotConfirmed', false],
    [tok({ payment: 'no_payment_required' }), 'paymentNotConfirmed', false],
    [tok({ delivery: 'pending' }), 'paidProcessingTokens', false],
    [tok({ delivery: 'unconfirmed' }), 'tokenPaymentConfirmed', true],
    // books
    [book({ payment: 'unpaid', delivery: 'delivered' }), 'paymentNotConfirmed', false],
    [book({ delivery: 'pending' }), 'paidPendingBook', false],
    [book({ delivery: 'delivered' }), 'deliveredBook', true],
    [book({ delivery: 'unconfirmed' }), 'unconfirmedBook', true],
    // subscriptions
    [sub({ entitlement: 'active' }), 'subscriptionActive', true],
    [sub({ entitlement: 'payment_problem' }), 'subscriptionProblem', true],
    [sub({ entitlement: 'ended' }), 'subscriptionEnded', true],
    [sub({ entitlement: 'superseded' }), 'subscriptionOther', true],
    [sub({ entitlement: 'not_recorded' }), 'subscriptionPending', false],
    [sub({ entitlement: null }), 'subscriptionPending', false],
  ])('%j → %s (terminal %s)', (r, key, terminal) => {
    expect(deriveFromResponse(r)).toEqual({ key, terminal });
  });

  it.each([
    ['token `delivered` (contract violation, R1-B)', tok({ delivery: 'delivered' })],
    ['token paid with null delivery', tok({ delivery: null })],
    ['book paid with null delivery', book({ delivery: null })],
    ['book unknown delivery', book({ delivery: 'shipped' })],
    ['unknown entitlement', sub({ entitlement: 'gold' })],
    ['unknown kind (gift)', { kind: 'gift', checkout: 'complete', payment: 'paid' }],
    ['unknown checkout', tok({ checkout: 'done' })],
    ['missing payment', { kind: 'tokens', checkout: 'complete', delivery: 'unconfirmed' }],
    ['unknown payment', tok({ payment: 'maybe', delivery: 'unconfirmed' })],
    ['null', null],
    ['string', 'ok'],
    ['empty object', {}],
  ])('%s → unavailable, non-terminal (no claim)', (_l, r) => {
    expect(deriveFromResponse(r)).toEqual({ key: 'unavailable', terminal: false });
  });

  it('a token response never maps to any delivery copy, whatever it contains', () => {
    const deliveries = [null, 'pending', 'delivered', 'unconfirmed', 'added', undefined];
    const payments = ['paid', 'unpaid', 'no_payment_required'];
    for (const checkout of ['open', 'complete', 'expired']) for (const payment of payments) for (const delivery of deliveries) {
      const key = deriveFromResponse({ kind: 'tokens', checkout, payment, delivery }).key;
      expect(['deliveredBook', 'unconfirmedBook', 'paidPendingBook']).not.toContain(key);
      if (key === 'tokenPaymentConfirmed') expect({ checkout, payment, delivery }).toEqual({ checkout: 'complete', payment: 'paid', delivery: 'unconfirmed' });
    }
  });
});

describe('deriveFromError', () => {
  it.each([
    [{ status: 401 }, 'auth', true],
    [{ status: 404 }, 'notFound', true],
    [{ status: 429 }, 'unavailable', false],
    [{ status: 503 }, 'unavailable', false],
    [{ status: 500 }, 'unavailable', false],
    [new TypeError('Failed to fetch'), 'unavailable', false],
    [null, 'unavailable', false],
  ])('%j → %s', (e, key, terminal) => {
    expect(deriveFromError(e)).toEqual({ key, terminal });
  });
});

describe('polling budget and Retry-After', () => {
  it('at most 11 requests: first immediately, then 2 s × 5 and 4 s × 5 (~30 s)', () => {
    expect(MAX_STATUS_REQUESTS).toBe(11);
    expect([...POLL_DELAYS_MS]).toEqual([2000, 2000, 2000, 2000, 2000, 4000, 4000, 4000, 4000, 4000]);
    expect(POLL_DELAYS_MS.reduce((a, b) => a + b, 0)).toBe(30_000);
  });
  it('nextDelay follows the schedule; a 429 Retry-After extends it, capped', () => {
    expect(nextDelay(0)).toBe(2000);
    expect(nextDelay(7)).toBe(4000);
    expect(nextDelay(99)).toBe(4000);
    expect(nextDelay(0, { status: 429, retryAfter: 10 })).toBe(10_000);
    expect(nextDelay(6, { status: 429, retryAfter: 1 })).toBe(4000);
    expect(nextDelay(0, { status: 429, retryAfter: 3600 })).toBe(MAX_RETRY_AFTER_MS);
    expect(nextDelay(0, { status: 503, retryAfter: 10 })).toBe(2000);
    expect(nextDelay(0, { status: 429 })).toBe(2000);
  });
});

describe('paths', () => {
  it('statusPath encodes the id', () => {
    expect(statusPath('cs_test_abc')).toBe('/subscriptions/checkout-sessions/cs_test_abc/status');
    expect(statusPath('a/../b?x')).toBe('/subscriptions/checkout-sessions/a%2F..%2Fb%3Fx/status');
  });
  it('successReturnPath keeps session_id and a permitted purchase value only', () => {
    expect(successReturnPath('cs_test_1', 'tokens')).toBe('/billing/success?session_id=cs_test_1&purchase=tokens');
    expect(successReturnPath('cs_test_1', 'evil')).toBe('/billing/success?session_id=cs_test_1');
    expect(successReturnPath(null, null)).toBe('/billing/success');
    expect(successReturnPath('cs_test_1&next=//evil', null)).toBe('/billing/success?session_id=cs_test_1%26next%3D%2F%2Fevil');
  });
});

// ── PO-2 copy contract ────────────────────────────────────────────────────────────────────────────────────────
// The expected strings are parsed from the authoritative design document (§R4.3), not retyped here.
const DESIGN = join(__dirname, '../../../../../docs/reports/payment-lifecycle-20261112/g1-checkout-verification-design.md');
function approvedCopy(): Record<string, { en: string; es: string }> {
  const doc = readFileSync(DESIGN, 'utf8');
  const r43 = doc.slice(doc.indexOf('### R4.3 Approved EN/ES copy'), doc.indexOf('### R4.4'));
  const rows: Record<string, { en: string; es: string }> = {};
  for (const line of r43.split('\n')) {
    const m = /^\| (A\d|B\d|C\d|D\d|T1) \| [^|]+ \| (.+?) \| (.+?) \|$/.exec(line);
    if (m) rows[m[1]] = { en: m[2], es: m[3] };
  }
  return rows;
}

describe('§R4.3 — all 13 approved message groups, verbatim, EN and ES', () => {
  const rows = approvedCopy();
  const pick = (d: typeof en) => {
    const st = d.billing.success.status;
    return {
      A1: st.checkoutOpen, A2: st.checkoutExpired, A3: st.paymentNotConfirmed, A4: st.paidProcessing.tokens,
      B1: st.paidPending.book, B2: st.delivered.book, B3: st.unconfirmed.book,
      C1: st.subscriptionActive.body, C2: st.subscriptionEnded, C3: st.subscriptionOther,
      D1: st.notFound, D2: st.unavailable, T1: st.tokenPaymentConfirmed,
    } as Record<string, string>;
  };
  it('the design table holds exactly 13 groups', () => {
    expect(Object.keys(rows).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'T1']);
  });
  it.each(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'T1'])('%s matches exactly (EN and ES)', (code) => {
    expect(pick(en)[code]).toBe(rows[code].en);
    expect(pick(es)[code]).toBe(rows[code].es);
  });
  it('T1 is the PO-2 token message (independent literal check)', () => {
    expect(en.billing.success.status.tokenPaymentConfirmed).toBe("Your payment is confirmed. Check your token balance to see your available tokens. If they haven't appeared, please contact support.");
    expect(es.billing.success.status.tokenPaymentConfirmed).toBe('Tu pago está confirmado. Consulta tu saldo para ver tus tokens disponibles. Si aún no aparecen, comunícate con soporte.');
  });
  it('the subscription-active title is the existing one (kept by C1)', () => {
    expect(en.billing.success.title).toBe('Your subscription is active');
    expect(es.billing.success.title).toBe('Tu suscripción está activa');
  });
});

describe('§R4.5 claim restrictions on the dictionaries', () => {
  for (const [lang, d] of [['en', en], ['es', es]] as const) {
    const st = d.billing.success.status;
    const confirmed = lang === 'en' ? /payment is confirmed/i : /pago está confirmado/i;
    it(`${lang}: "payment confirmed" appears only in the token-confirmed and paid-book messages`, () => {
      const allowed = [st.tokenPaymentConfirmed, st.paidPending.book, st.delivered.book, st.unconfirmed.book];
      const others = [st.checkoutOpen, st.checkoutExpired, st.paymentNotConfirmed, st.paidProcessing.tokens, st.subscriptionActive.body, st.subscriptionEnded, st.subscriptionOther, st.notFound, st.unavailable];
      for (const a of allowed) expect(a).toMatch(confirmed);
      for (const o of others) expect(o).not.toMatch(confirmed);
    });
    it(`${lang}: subscription messages claim no tokens, payment or full access (T-R3a)`, () => {
      for (const m of [st.subscriptionActive.body, st.subscriptionEnded, st.subscriptionOther]) expect(m).not.toMatch(/token|payment|pago|full access|acceso completo/i);
    });
    it(`${lang}: open/expired make no charge or failure claim (T-R2b)`, () => {
      for (const m of [st.checkoutOpen, st.checkoutExpired]) expect(m).not.toMatch(/no charge|not charged|failed|sin cargo|fall/i);
    });
    it(`${lang}: no token message claims delivery`, () => {
      for (const m of [st.tokenPaymentConfirmed, st.paidProcessing.tokens]) expect(m).not.toMatch(/added|delivered|agregaron|entregad|se añadieron/i);
    });
    it(`${lang}: errors guarantee no payment outcome`, () => {
      for (const m of [st.notFound, st.unavailable, st.paymentNotConfirmed]) expect(m).not.toMatch(/isn't affected|no se ve afectado|refund|reembols|charged|cobr/i);
    });
  }
});

describe('existing billing.success copy outside G-1 is unchanged', () => {
  const BASE_EN = {"title":"Your subscription is active","body":"Your account has full access. Start reading right away.","cta":"Start reading","checking":"Confirming your subscription…","pendingTitle":"We're still confirming your subscription","pendingBody":"Your subscription isn't active in Noetia yet. If you completed checkout, this usually takes less than a minute.","checkAgain":"Check again","errorTitle":"We couldn't confirm your subscription","errorBody":"Your payment isn't affected. Check your connection and try again, or open your billing page.","problemTitle":"There's a problem with your payment","problemBody":"Your subscription payment could not be collected. Update your payment method from your billing page.","authTitle":"Sign in to confirm your subscription","authBody":"Your payment isn't affected. Sign in to see your subscription status.","signIn":"Sign in","viewBilling":"Go to billing","purchaseTitle":"We're confirming your purchase","purchaseBody":{"tokens":"Once your payment is confirmed, your tokens are added to your balance. This usually takes less than a minute.","book":"Once your payment is confirmed, the book is added to your library. This usually takes less than a minute.","gift":"Once your payment is confirmed, we email the gift to its recipient and send you a confirmation."},"continue":"Continue"};
  const BASE_ES = {"title":"Tu suscripción está activa","body":"Tu cuenta tiene acceso completo. Comienza a leer ahora mismo.","cta":"Comenzar a leer","checking":"Confirmando tu suscripción…","pendingTitle":"Aún estamos confirmando tu suscripción","pendingBody":"Tu suscripción aún no está activa en Noetia. Si completaste el pago, suele tardar menos de un minuto.","checkAgain":"Comprobar de nuevo","errorTitle":"No pudimos confirmar tu suscripción","errorBody":"Tu pago no se ve afectado. Revisa tu conexión e inténtalo de nuevo, o abre tu página de facturación.","problemTitle":"Hay un problema con tu pago","problemBody":"No se pudo cobrar el pago de tu suscripción. Actualiza tu método de pago desde tu página de facturación.","authTitle":"Inicia sesión para confirmar tu suscripción","authBody":"Tu pago no se ve afectado. Inicia sesión para ver el estado de tu suscripción.","signIn":"Iniciar sesión","viewBilling":"Ir a facturación","purchaseTitle":"Estamos confirmando tu compra","purchaseBody":{"tokens":"Cuando se confirme tu pago, añadiremos tus tokens a tu saldo. Suele tardar menos de un minuto.","book":"Cuando se confirme tu pago, añadiremos el libro a tu Biblioteca. Suele tardar menos de un minuto.","gift":"Cuando se confirme tu pago, enviaremos el regalo por email a su destinatario y te mandaremos una confirmación."},"continue":"Continuar"};
  it.each([['en', en, BASE_EN], ['es', es, BASE_ES]] as const)('%s: every pre-G-1 key keeps its value; only `status` was added', (_l, d, base) => {
    const { status, ...rest } = d.billing.success as any;
    expect(status).toBeDefined();
    expect(rest).toEqual(base);
  });
});
