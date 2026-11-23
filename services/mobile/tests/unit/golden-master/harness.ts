// Shallow render harness for mobile golden-master tests (NEM-025 B1-B).
//
// The mobile package has no React renderer (react-test-renderer is not a dependency; see PR #69), so
// components are rendered the way the existing screen specs do it: React hooks are stubbed and each
// function component is called directly. The returned element tree is walked recursively (function
// components are called in turn) and the visible text plus accessibility attributes are collected.
//
// This captures the FIRST render of a component for a given state. Hook state is injected per
// component through `mockHarness.overrides[componentName][useStateCallIndex]`.

import type { MobileTranslations } from '../../../src/i18n/en';

export interface HarnessState {
  lang: { language: string; t: MobileTranslations; setLanguage: () => Promise<void>; isLoaded: boolean } | null;
  overrides: Record<string, Record<number, unknown>>;
  current: string;
  index: number;
  route: { params: Record<string, unknown> };
}

export const mockHarness: HarnessState = {
  lang: null,
  overrides: {},
  current: '',
  index: 0,
  route: { params: {} },
};

export function resetHarness(): void {
  mockHarness.overrides = {};
  mockHarness.current = '';
  mockHarness.index = 0;
  mockHarness.route = { params: {} };
}

/** Replacement hooks installed by `jest.mock('react', …)` in the golden-master spec. */
export function stubHooks(actual: Record<string, unknown>) {
  const hooks = {
    useState: (init: unknown) => {
      const o = mockHarness.overrides[mockHarness.current];
      const i = mockHarness.index++;
      const value = o && i in o ? o[i] : typeof init === 'function' ? (init as () => unknown)() : init;
      return [value, () => {}];
    },
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useRef: (v: unknown) => ({ current: v }),
    useContext: () => mockHarness.lang,
  };
  return { ...actual, ...hooks, default: { ...(actual as object), ...hooks } };
}

export interface Rendered {
  text: string[];
  attrs: string[];
}

const ATTRS = ['accessibilityLabel', 'accessibilityHint', 'placeholder', 'title'];

function isElement(v: unknown): v is { type: unknown; props: Record<string, unknown> } {
  return !!v && typeof v === 'object' && 'type' in (v as object) && 'props' in (v as object);
}

function renderFn(type: (p: unknown) => unknown, props: unknown): unknown {
  mockHarness.current = type.name;
  mockHarness.index = 0;
  return type(props);
}

function flatText(node: unknown, out: Rendered): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((n) => flatText(n, out)).join('');
  if (isElement(node)) {
    if (typeof node.type === 'function') return flatText(renderFn(node.type as never, node.props), out);
    collectAttrs(node, out);
    return flatText(node.props.children, out);
  }
  return '';
}

function hostName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (typeof type === 'symbol') return 'Fragment';
  return 'Host';
}

function collectAttrs(node: { type: unknown; props: Record<string, unknown> }, out: Rendered) {
  for (const a of ATTRS) {
    if (typeof node.props[a] === 'string') out.attrs.push(`${hostName(node.type)}[${a}]=${node.props[a]}`);
  }
}

function walk(node: unknown, out: Rendered): void {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') { out.text.push(String(node)); return; }
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return; }
  if (!isElement(node)) return;
  const { type, props } = node;
  if (typeof type === 'function') { walk(renderFn(type as never, props), out); return; }
  if (type === 'Text') {
    collectAttrs(node, out);
    const s = flatText(props.children, out);
    if (s) out.text.push(s);
    return;
  }
  collectAttrs(node, out);
  // Element-valued props (e.g. ListEmptyComponent) and list renderers.
  for (const [k, v] of Object.entries(props)) {
    if (k !== 'children' && isElement(v)) walk(v, out);
  }
  if (Array.isArray(props.sections) && typeof props.renderSectionHeader === 'function') {
    for (const section of props.sections as Array<{ data: unknown[] }>) {
      walk((props.renderSectionHeader as (a: unknown) => unknown)({ section }), out);
      if (typeof props.renderItem === 'function') {
        section.data.forEach((item, index) => walk((props.renderItem as (a: unknown) => unknown)({ item, index, section }), out));
      }
    }
  } else if (Array.isArray(props.data) && typeof props.renderItem === 'function') {
    (props.data as unknown[]).forEach((item, index) => walk((props.renderItem as (a: unknown) => unknown)({ item, index }), out));
  }
  walk(props.children, out);
}

export function shallowRender(element: unknown): Rendered {
  const out: Rendered = { text: [], attrs: [] };
  walk(element, out);
  return out;
}
