import { test, expect, Page, Route } from '@playwright/test';
import { en } from '../../lib/i18n/en';
import { es } from '../../lib/i18n/es';

/**
 * NEM-024 Checkpoint D — minimal research Q&A, end to end in a real browser against the local Next.js app, with the
 * knowledge API SIMULATED via route interception (the real module is dark: unbound ports, no provider). Runs once per
 * locale (mission AC-14): ask → stages → answer with citations → open the excerpt → cancel → reload recovery.
 *
 *   BASE_URL=http://localhost:3100 npx playwright test tests/e2e/research-qa.spec.ts
 */
const SID = '20000000-0000-4000-8000-000000000001';
const EXCERPT = 'Érase una vez un faro junto al mar.';
const CAPS = {
  tier: 'noetia_plus', capabilities: ['research_session'],
  features: { researchTurns: true, streaming: true, cancellation: true, history: true },
  limits: { maxBooks: 3, questionMaxCodePoints: 500, historyPageMax: 50 },
};
const SESSION = { id: SID, parentId: null, status: 'active', locked: false, turnCount: 0, forkOffer: null, books: [{ bookId: 'b1', position: 1, title: 'El faro', author: 'A' }] };
const RESULT = (turnId: string, replayed = false) => ({
  sessionId: SID, turnId, status: 'completed', settlement: 'settled', ...(replayed ? { replayed: true } : {}),
  segments: [{ origin: 'library', text: `Respuesta ${turnId} del libro.`, bookId: 'b1' }, { origin: 'synthesis', text: 'Síntesis breve.' }],
  citations: [[{ ref: 'chunk:1', kind: 'chunk', bookId: 'b1', anchor: 'h:1-2', excerpt: EXCERPT, sourceState: 'available' }], []],
  exclusions: { ineligible: [], unindexed: [], stale: [], unavailable: [], indexNotPermitted: [] },
});
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
// The app sends credentials, so CORS needs the exact origin + allow-credentials (as the real API's CORS config does).
const cors = (route: Route) => ({
  'access-control-allow-origin': route.request().headers()['origin'] ?? 'http://localhost:3100',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type, authorization, accept',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
});
const sse = (route: Route, body: string) => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', ...cors(route) }, body });
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors(route), body: JSON.stringify(body) });

interface Sim { streamBodies: { idempotencyKey: string; question: string }[]; cancels: string[]; hold: boolean; release?: () => void }

async function simulate(page: Page, lang: 'en' | 'es'): Promise<Sim> {
  const sim: Sim = { streamBodies: [], cancels: [], hold: false };
  await page.addInitScript((l) => { localStorage.setItem('access_token', 'e2e-fake-token'); localStorage.setItem('noetia_lang', l); }, lang);
  await page.route('**/knowledge/sessions/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (url.pathname.endsWith('/capabilities')) return json(route, CAPS);
    if (url.pathname.endsWith(`/${SID}`)) return json(route, SESSION);
    if (url.pathname.endsWith('/turns') && req.method() === 'GET') return json(route, []);
    if (url.pathname.endsWith('/turns/cancel')) {
      sim.cancels.push(JSON.parse(req.postData() ?? '{}').idempotencyKey);
      sim.release?.();
      return json(route, { status: 'cancel_requested' });
    }
    if (url.pathname.endsWith('/turns/stream')) {
      const body = JSON.parse(req.postData() ?? '{}');
      sim.streamBodies.push(body);
      const n = sim.streamBodies.length;
      const stages = frame('stage', { stage: 'checking' }) + frame('stage', { stage: 'searching' }) + frame('stage', { stage: 'composing' });
      if (sim.hold) {
        // Held until cancel (or the page goes away): the browser sees an in-flight turn.
        await new Promise<void>((resolve) => { sim.release = resolve; });
        if (sim.cancels.includes(body.idempotencyKey)) return sse(route, stages + frame('terminal', { outcome: 'cancelled', statusCode: 502, code: 'turn_failed', status: 'cancelled', turnId: `t${n}`, reservationRelease: 'released' })).catch(() => undefined);
        return route.abort().catch(() => undefined);
      }
      const replay = sim.streamBodies.filter((b) => b.idempotencyKey === body.idempotencyKey).length > 1;
      return sse(route, stages + frame('delta', { segment: 0, text: 'x' }) + frame('terminal', { outcome: 'completed', statusCode: 200, persisted: true, turnId: `t${n}`, settlement: 'settled', ...(replay ? { replayed: true } : {}), result: RESULT(`t${n}`, replay) }));
    }
    return route.fulfill({ status: 404 });
  });
  return sim;
}

for (const lang of ['en', 'es'] as const) {
  const T = lang === 'en' ? en.research : es.research;
  test.describe(`research Q&A (${lang})`, () => {
    test('ask → answer with citations → excerpt dialog → cancel → reload recovery with the same key', async ({ page }) => {
      const sim = await simulate(page, lang);
      await page.goto(`/research/${SID}`);
      await expect(page.getByRole('heading', { name: T.title })).toBeVisible();
      await expect(page.getByText(T.conversation.empty)).toBeVisible();

      // Ask
      const input = page.getByLabel(T.ask.label);
      await input.fill('¿Qué papel tiene el faro?');
      await input.press('Enter');
      await expect(page.getByText('Respuesta t1 del libro.')).toBeVisible();
      await expect(page.getByText(T.origin.library, { exact: true })).toBeVisible();
      await expect(page.getByText(T.origin.synthesis, { exact: true })).toBeVisible();
      await expect(page.getByRole('log')).toHaveText(T.status.answerReady);
      expect(sim.streamBodies[0].idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,64}$/);

      // Citation → dialog (keyboard)
      const cite = page.getByRole('button', { name: T.citation.button(1, 'El faro') });
      await cite.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: T.citation.dialogTitle(1) });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(EXCERPT)).toBeVisible();
      await expect(dialog.getByRole('link', { name: T.citation.openBook })).toHaveAttribute('href', '/reader/b1');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(cite).toBeFocused();

      // Cancel an in-flight question (explicit endpoint, same key)
      sim.hold = true;
      await input.fill('Otra pregunta');
      await input.press('Enter');
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
      await page.getByRole('button', { name: T.cancel }).click();
      await expect(page.getByTestId('turn-status').last()).toContainText(T.status.cancelled);
      expect(sim.cancels).toEqual([sim.streamBodies[1].idempotencyKey]);

      // Disconnect by reload while in flight → NOT a cancel; the same key is replayed on load
      sim.hold = true;
      await input.fill('Pregunta recuperable');
      await input.press('Enter');
      await expect(page.getByRole('button', { name: T.cancel })).toBeVisible();
      const heldKey = sim.streamBodies[2].idempotencyKey;
      sim.hold = false;
      const released = sim.release;
      await page.reload();
      released?.();
      await expect(page.getByText(`Respuesta t4 del libro.`)).toBeVisible();
      expect(sim.streamBodies[3]).toEqual({ idempotencyKey: heldKey, question: 'Pregunta recuperable' });
      expect(sim.cancels).toHaveLength(1); // the reload did not cancel
    });
  });
}
