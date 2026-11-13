// PO-053 CauseSelector: one cause or none; save success/failure/retry; skip never calls the API.
const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
const mockLang = { current: 'es' as 'es' | 'en' };
jest.mock('@/lib/i18n', () => {
  const { es } = require('../../../lib/i18n/es');
  const { en } = require('../../../lib/i18n/en');
  return { useTranslation: () => ({ t: mockLang.current === 'es' ? es : en, language: mockLang.current, setLanguage: jest.fn() }) };
});

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import CauseSelector from '@/components/CauseSelector';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const CAUSES = [
  { id: 'c-animal', slug: 'bienestar-animal', name: 'Bienestar Animal', description: 'd1' },
  { id: 'c-kids', slug: 'ninez-y-juventud', name: 'Niñez y Juventud', description: 'd2' },
  { id: 'c-env', slug: 'medio-ambiente', name: 'Medio Ambiente', description: 'd3' },
];

let container: HTMLDivElement;
let root: Root;
let onSave: jest.Mock;
let onSkip: jest.Mock;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const radios = () => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const button = (label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const click = (el: HTMLElement) => act(() => { el.click(); });

async function render() {
  act(() => { root.render(React.createElement(CauseSelector, { onSave, onSkip })); });
  await flush();
}

beforeEach(() => {
  mockLang.current = 'es';
  mockApiFetch.mockReset();
  onSave = jest.fn();
  onSkip = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function causesThen(...saveResults: Array<'ok' | 'fail'>) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === '/causes') return Promise.resolve(CAUSES);
    const r = saveResults.shift();
    return r === 'ok' ? Promise.resolve({}) : Promise.reject(new Error('500'));
  });
}

describe('CauseSelector (PO-053)', () => {
  it('renders an accessible dialog with three single-choice causes and the equal-split note', async () => {
    causesThen();
    await render();
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(radios()).toHaveLength(3);
    expect(new Set(radios().map((r) => r.name)).size).toBe(1);
    expect(container.querySelector('legend')?.textContent).toBe(es.causeSelector.groupLabel);
    expect(container.querySelector('[data-testid="default-note"]')?.textContent).toBe(es.causeSelector.defaultNote);
    expect(container.textContent).toContain('Bienestar animal');
    expect(container.textContent).not.toMatch(/aleator|random|hasta dos|hasta 2|up to two/i);
  });

  it('shows a loading state, then a load error with retry', async () => {
    let reject!: (e: Error) => void;
    mockApiFetch.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
    act(() => { root.render(React.createElement(CauseSelector, { onSave, onSkip })); });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(es.causeSelector.loading);
    await act(async () => { reject(new Error('down')); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(es.causeSelector.loadError);
    mockApiFetch.mockResolvedValueOnce(CAUSES);
    click(button(es.causeSelector.retryLoad));
    await flush();
    expect(radios()).toHaveLength(3);
  });

  it('confirm is disabled until a cause is chosen', async () => {
    causesThen();
    await render();
    expect(button(es.causeSelector.confirm).disabled).toBe(true);
    click(radios()[0]);
    expect(button(es.causeSelector.confirm).disabled).toBe(false);
  });

  it('allows only one cause: choosing another replaces the previous one', async () => {
    causesThen();
    await render();
    click(radios()[0]);
    click(radios()[2]);
    expect(radios().filter((r) => r.checked).map((r) => r.value)).toEqual(['c-env']);
  });

  it('saves the single cause with cause2Id null and randomDistribution false, then calls onSave', async () => {
    causesThen('ok');
    await render();
    click(radios()[1]);
    click(button(es.causeSelector.confirm));
    await flush();
    expect(mockApiFetch).toHaveBeenLastCalledWith('/causes/preferences', {
      method: 'POST',
      body: JSON.stringify({ cause1Id: 'c-kids', cause2Id: null, randomDistribution: false }),
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(es.causeSelector.saved);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('on save failure: shows an error, keeps the selection, does NOT proceed; retry then succeeds', async () => {
    causesThen('fail', 'ok');
    await render();
    click(radios()[2]);
    click(button(es.causeSelector.confirm));
    await flush();

    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(es.causeSelector.saveError);
    expect(container.textContent).not.toContain(es.causeSelector.saved);
    expect(radios().find((r) => r.checked)?.value).toBe('c-env');

    click(button(es.causeSelector.retrySave));
    await flush();
    expect(mockApiFetch).toHaveBeenCalledTimes(3);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('skip continues without any preference request (existing preference untouched)', async () => {
    causesThen();
    await render();
    click(radios()[0]);
    click(button(es.causeSelector.skip));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/causes');
  });

  it('skip remains available after a failed save', async () => {
    causesThen('fail');
    await render();
    click(radios()[0]);
    click(button(es.causeSelector.confirm));
    await flush();
    click(button(es.causeSelector.skip));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders in English with localized cause names', async () => {
    mockLang.current = 'en';
    causesThen();
    await render();
    expect(container.textContent).toContain(en.causeSelector.title);
    expect(container.textContent).toContain('Animal welfare');
    expect(container.textContent).toContain('Children and youth');
    expect(container.textContent).toContain('Environment');
    expect(button(en.causeSelector.skip)).toBeDefined();
  });

  it('falls back to the API name for an unknown slug', async () => {
    mockApiFetch.mockResolvedValueOnce([{ id: 'x', slug: 'otra', name: 'Otra causa', description: 'dx' }]);
    await render();
    expect(container.textContent).toContain('Otra causa');
  });
});

describe('causeSelector copy (PO-053 wording)', () => {
  it('ES/EN match the approved policy sentences', () => {
    expect(es.causeSelector.body).toContain('Destinamos el 2,22% de cada pago a Causas Noetia.');
    expect(es.causeSelector.defaultNote).toBe('Si no eliges ninguna, se distribuye por igual entre las tres.');
    expect(en.causeSelector.body).toContain('We commit 2.22% of every payment to Causas Noetia.');
    expect(en.causeSelector.defaultNote).toBe("If you don't choose one, it is distributed equally among all three.");
  });

  it('has the same cause keys in ES and EN', () => {
    expect(Object.keys(es.causeSelector.causes).sort()).toEqual(Object.keys(en.causeSelector.causes).sort());
  });
});
