// next/link and next/image need no router or loader in jsdom if rendered as plain elements.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, ...props }: any) => {
    const React = require('react');
    return React.createElement('img', props);
  },
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BookGrid } from '@/components/BookGrid';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const freeBook = { id: 'free-1', title: 'Libre', author: 'A', coverUrl: null, category: 'classic', language: 'es', isFree: true };
const paidBook = { id: 'paid-1', title: 'De pago', author: 'B', coverUrl: null, category: 'business', language: 'es', isFree: false };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function addButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('BookGrid add-to-library button (NEM-011)', () => {
  it('offers "add" on a free book and calls onAdd with its id', () => {
    const onAdd = jest.fn();
    act(() => root.render(<BookGrid books={[freeBook]} onAdd={onAdd} />));

    const [button] = addButtons();
    expect(button.getAttribute('aria-label')).toBe('Agregar a tu biblioteca');
    act(() => button.click());
    expect(onAdd).toHaveBeenCalledWith('free-1');
  });

  it('never offers "add" on a paid book — it would create ownership without payment', () => {
    act(() => root.render(<BookGrid books={[paidBook]} onAdd={jest.fn()} />));
    expect(addButtons()).toHaveLength(0);
  });

  it('hides "add" when the free flag is missing (fails closed)', () => {
    const { isFree: _omit, ...unknownBook } = freeBook;
    act(() => root.render(<BookGrid books={[unknownBook]} onAdd={jest.fn()} />));
    expect(addButtons()).toHaveLength(0);
  });

  it('shows the in-library state and does not re-add a free book already in the library', () => {
    const onAdd = jest.fn();
    act(() => root.render(<BookGrid books={[freeBook]} libraryBookIds={new Set(['free-1'])} onAdd={onAdd} />));

    const [button] = addButtons();
    expect(button.getAttribute('aria-label')).toBe('En tu biblioteca');
    act(() => button.click());
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('renders no buttons at all without an onAdd handler', () => {
    act(() => root.render(<BookGrid books={[freeBook, paidBook]} />));
    expect(addButtons()).toHaveLength(0);
    expect(container.textContent).toContain('Libre');
    expect(container.textContent).toContain('De pago');
  });
});
