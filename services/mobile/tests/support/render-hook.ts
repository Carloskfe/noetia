import React from 'react';
import { act } from 'react-test-renderer';
import { render } from './render';

// Minimal renderHook on top of the CI-4.0 render() helper (CI-4.1). The hook runs inside a
// real function component rendered by React's reconciler, so its effects, state updates and
// cleanups behave exactly as in the app; `result.current` always holds the latest return value.

export interface RenderedHook<P, R> {
  result: { current: R };
  rerender: (props: P) => void;
  unmount: () => void;
}

export function renderHook<P, R>(hook: (props: P) => R, initialProps: P): RenderedHook<P, R> {
  const result = { current: undefined as unknown as R };

  function Probe({ hookProps }: { hookProps: P }): null {
    result.current = hook(hookProps);
    return null;
  }

  const renderer = render(React.createElement(Probe, { hookProps: initialProps }));

  return {
    result,
    rerender: (props: P) => {
      act(() => {
        renderer.update(React.createElement(Probe, { hookProps: props }));
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

/** A promise whose settlement the test controls, for exercising in-flight async races. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
