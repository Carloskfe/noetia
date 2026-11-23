import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import LanguagePicker from '@/components/LanguagePicker';
import { LanguageProvider } from '@/lib/i18n';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const ENV = 'NEXT_PUBLIC_FR_CA_ENABLED';
let container: HTMLDivElement;
let root: Root;

async function render() {
  await act(async () => {
    root.render(React.createElement(LanguageProvider, null, React.createElement(LanguagePicker)));
  });
}

const labels = () => Array.from(container.querySelectorAll('button')).map((b) => b.textContent);

describe('LanguagePicker (NEM-025 Checkpoint A)', () => {
  const prev = process.env[ENV];
  beforeEach(() => {
    localStorage.clear();
    delete process.env[ENV];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  });

  it('shows only the existing ES/EN options by default (French hidden)', async () => {
    await render();
    expect(labels()).toEqual(['🌎 ES Latam', '🇺🇸 English']);
    expect(container.textContent).not.toContain('Français');
  });

  it('keeps French hidden for any gate value other than exactly "true"', async () => {
    process.env[ENV] = 'TRUE';
    await render();
    expect(labels()).toHaveLength(2);
  });

  it('offers "Français (Canada)" without a flag when the readiness gate is enabled', async () => {
    process.env[ENV] = 'true';
    await render();
    expect(labels()).toEqual(['🌎 ES Latam', '🇺🇸 English', 'Français (Canada)']);
  });

  it('switches language when an option is clicked', async () => {
    await render();
    const en = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('English'));
    act(() => { en?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(localStorage.getItem('noetia_lang')).toBe('en');
  });
});
