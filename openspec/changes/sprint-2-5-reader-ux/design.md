## Context

The reader page (`app/(reader)/reader/[id]/page.tsx`) is a fully self-contained client component with no shared layout wrapping it — no `BottomNav`, no app shell. All UI lives inside a single `<div>` returned by `ReaderPage`. The fixed top-right corner currently holds two icon buttons (Fragmentos + mode toggle). There is no navigation chrome.

Reading preferences (font size and dark mode) need to survive page refreshes. The app has no global state manager, so localStorage is the appropriate persistence layer. The preference values are simple scalars and do not need to be shared across routes.

## Goals / Non-Goals

**Goals:**
- Give users a clear exit path from the reader back to `/library`
- Provide a one-tap shortcut to `/discover` for finding a new book
- Let users increase or decrease text size in three discrete steps, persisted across sessions
- Let users switch between light and dark reading themes, persisted across sessions
- Keep all preference logic in a standalone, fully testable utility (`lib/reader-preferences.ts`)
- Ensure `FragmentPopover` and `FragmentSheet` match the active theme

**Non-Goals:**
- System-level dark mode detection (`prefers-color-scheme`) — user preference is explicit only
- More than three font size steps
- Per-book preference memory — one global setting applies everywhere
- Any backend changes

## Decisions

**Top bar placement — fixed strip vs. augmenting existing buttons**
The existing fixed top-right cluster will become a full-width fixed top bar. This is the conventional pattern for mobile readers (Kindle, Moon+) and avoids cramming six controls into a corner. The bar is slim (h-12 / 48 px) so it does not eat into reading space. The phrase list gets `pt-14` to clear it.

**Font size — CSS class vs. inline style**
Three named steps (`text-base` / `text-lg` / `text-xl`) mapped to Tailwind classes. This is simpler than an arbitrary pixel value and aligns with the existing typography scale. A `FONT_SIZES` constant array in `reader-preferences.ts` defines the three values so both the UI and tests share one source of truth.

**Dark mode — Tailwind class on root div vs. `next-themes`**
A `dark` boolean toggles a class (`bg-gray-950 text-gray-100`) on the page's root `<div>`. Installing `next-themes` would be overkill for a single route that already bypasses the app shell. No new dependency needed.

**Dark prop threading vs. React context**
`FragmentPopover` and `FragmentSheet` receive a `dark` boolean prop. Context would add indirection with no benefit since both components are rendered by the same parent that owns the preference state.

**localStorage key names**
- `reader-font-size` → `"sm" | "md" | "lg"` (default `"md"`)
- `reader-dark-mode` → `"true" | "false"` (default `"false"`)

## Risks / Trade-offs

- **SSR hydration mismatch** — localStorage is not available on the server. The `loadPreferences` helper must guard with `typeof window !== "undefined"` and return defaults on the server. → Mitigation: implement this guard in `reader-preferences.ts` and test the server-side default path.
- **Top bar obscures content on very small screens** — The `pt-14` offset on the phrase list handles this; the bar is fixed so it never overlaps text.
- **Dark mode flicker on load** — Since preferences are loaded after hydration, there may be a one-frame flash of the light theme. This is an acceptable trade-off without a more complex SSR solution.
