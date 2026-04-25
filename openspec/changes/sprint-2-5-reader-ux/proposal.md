## Why

Once a user opens a book in the reader, they are stranded — there is no way to go back to the library, switch books, search for another title, or adjust the reading experience (font size, dark mode). These gaps make the reader feel like a dead end and hurt retention for extended reading sessions.

## What Changes

- Add a persistent reader top bar with a back-to-library button, book title, and a discover/search shortcut
- Add font size controls (three steps: small / medium / large) persisted in localStorage
- Add a dark mode toggle (light ↔ dark) persisted in localStorage
- Extract reading preferences logic into a new `lib/reader-preferences.ts` utility with full unit test coverage
- Update `FragmentPopover` and `FragmentSheet` to accept and apply a `dark` prop so overlays match the active theme

## Capabilities

### New Capabilities

- `reader-navigation`: Back button to `/library`, centered book title, and discover shortcut in a fixed top bar inside the reader
- `reader-preferences`: Font size (sm/md/lg) and dark mode boolean persisted to localStorage; load/save helpers exported from `lib/reader-preferences.ts`

### Modified Capabilities

- `synchronized-reader`: Reader page gains top bar, font size class on phrases container, and dark/light theme class on root element; dark prop threaded into popover and sheet overlays

## Impact

- `services/web/app/(reader)/reader/[id]/page.tsx` — add top bar, wire preferences state
- `services/web/lib/reader-preferences.ts` — new utility (new file)
- `services/web/tests/unit/lib/reader-preferences.spec.ts` — new unit tests
- `services/web/components/FragmentPopover.tsx` — accept `dark` prop
- `services/web/components/FragmentSheet.tsx` — accept `dark` prop
- No API or backend changes required
- No new dependencies required (Tailwind classes only)
