import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// Minimal component-testing helpers on top of react-test-renderer (CI-4.0).
// Components render through React's real reconciler; React Native host components come from
// tests/__mocks__/react-native.ts as string hosts, so queries work on host type, props and text.

// Tell React 18 this is a test environment so act() batching applies without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mounts `element` inside act(), running its initial effects. */
export function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

/** Lets pending promises (mocked network responses, async effects) settle and re-render. */
export async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** True when `node` is a host node of the given type (string hosts from the react-native mock). */
export function isHost(node: ReactTestInstance, type: string): boolean {
  return (node.type as unknown) === type;
}

/** Concatenated text of one host node and its descendants. */
export function textOf(node: ReactTestInstance): string {
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}

/** Text of every rendered <Text> host node, in render order. */
export function texts(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAll((n) => isHost(n, 'Text'), { deep: true })
    .filter((n) => !n.children.some((c) => typeof c !== 'string' && isHost(c, 'Text')))
    .map(textOf);
}

/** Host nodes of the given type, e.g. 'ActivityIndicator'. */
export function hosts(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((n) => isHost(n, type));
}

/** The pressable host (TouchableOpacity) whose content includes `text`. Throws unless exactly one matches. */
export function pressableWithText(renderer: ReactTestRenderer, text: string): ReactTestInstance {
  const matches = hosts(renderer, 'TouchableOpacity').filter((n) => textOf(n).includes(text));
  if (matches.length !== 1) throw new Error(`Expected one pressable containing "${text}", found ${matches.length}`);
  return matches[0];
}

/** Invokes a host prop callback (onPress, onRefresh, …) inside act(), awaiting any returned promise. */
export async function fire(node: ReactTestInstance, prop: string, ...args: unknown[]): Promise<void> {
  const handler = node.props[prop] as ((...a: unknown[]) => unknown) | undefined;
  if (typeof handler !== 'function') throw new Error(`Host ${String(node.type)} has no "${prop}" handler`);
  await act(async () => {
    await handler(...args);
  });
}

/** A fetch Response stand-in carrying a JSON body. */
export function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
