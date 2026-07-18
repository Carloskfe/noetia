// next/link needs no router in jsdom if we render it as a plain anchor.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', props, children);
  },
}));

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: {
      nav: {
        myLibrary: 'Library', generalCollection: 'Discover', clubs: 'Clubs',
        backToLibrary: 'Back', darkMode: 'Dark', lightMode: 'Light',
        decreaseFontSize: 'A-', increaseFontSize: 'A+',
        audioMode: 'Audio', audioModeActive: 'Audio on', activeListeningMode: 'Listening',
        chapters: 'Chapters', fragments: 'Fragments',
        readingProgress: (pct: number) => `Reading progress: ${pct}%`,
      },
    },
  }),
}));

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import ReaderTopBar from '@/components/ReaderTopBar';

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps = {
  title: 'Mi Libro',
  dark: false,
  fontSize: 'md' as const,
  onFontDecrease: () => {},
  onFontIncrease: () => {},
  onDarkToggle: () => {},
  onFragmentsToggle: () => {},
  fragmentCount: 0,
};

let container: HTMLDivElement;
let root: Root;

function render(props: Record<string, unknown>): void {
  act(() => {
    root.render(React.createElement(ReaderTopBar, { ...baseProps, ...props } as any));
  });
}

function bar(): HTMLElement | null {
  return container.querySelector('[data-testid="reading-progress-bar"]');
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ReaderTopBar progress indicator', () => {
  it('renders no progress bar when progress is undefined', () => {
    render({});
    expect(bar()).toBeNull();
  });

  it('renders a bar whose width matches the rounded percentage', () => {
    render({ progress: 0.43 });
    expect(bar()?.style.width).toBe('43%');
    expect(container.textContent).toContain('43%');
  });

  it('renders 0% at the start of the book', () => {
    render({ progress: 0 });
    expect(bar()?.style.width).toBe('0%');
  });

  it('clamps values above 1 to 100%', () => {
    render({ progress: 1.4 });
    expect(bar()?.style.width).toBe('100%');
  });

  it('clamps negative values to 0%', () => {
    render({ progress: -0.3 });
    expect(bar()?.style.width).toBe('0%');
  });

  it('labels the percentage for screen readers', () => {
    render({ progress: 0.6 });
    const label = container.querySelector('[aria-label="Reading progress: 60%"]');
    expect(label).not.toBeNull();
  });
});
