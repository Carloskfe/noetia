## 1. Reader Preferences Utility

- [x] 1.1 Create `services/web/lib/reader-preferences.ts` exporting `ReaderPreferences` type, `FONT_SIZES` constant (`['sm', 'md', 'lg']`), `loadPreferences()`, and `savePreferences(prefs)` — guard `window` access for SSR
- [x] 1.2 Create `services/web/tests/unit/lib/reader-preferences.spec.ts` — test: defaults when no localStorage values, correct values when stored, save writes both keys, server-side returns defaults without throwing
- [x] 1.3 Run `pnpm test` in `services/web` — confirm all tests pass

## 2. FragmentPopover Dark Mode

- [x] 2.1 Add `dark?: boolean` prop to `FragmentPopover` in `services/web/components/FragmentPopover.tsx` — apply `bg-gray-900 border-gray-700 text-gray-100` classes when `dark` is true, keep existing light classes as default

## 3. FragmentSheet Dark Mode

- [x] 3.1 Add `dark?: boolean` prop to `FragmentSheet` in `services/web/components/FragmentSheet.tsx` — apply dark background/text classes to the drawer, backdrop, and all inner text elements when `dark` is true

## 4. Reader Top Bar

- [x] 4.1 Create `services/web/components/ReaderTopBar.tsx` — accepts props: `title: string`, `dark: boolean`, `fontSize: 'sm'|'md'|'lg'`, `onFontDecrease()`, `onFontIncrease()`, `onDarkToggle()`, `onFragmentsToggle()`, `fragmentCount: number`; renders fixed top bar with back link (→ `/library`), truncated title, A−/A+ buttons (disabled at limits), moon/sun icon, magnifier link (→ `/discover`), and Fragments badge button
- [x] 4.2 Add chevron-left, moon, sun, and magnifier SVG icon helpers inside `ReaderTopBar.tsx` (inline, no external icon library)

## 5. Reader Page Integration

- [x] 5.1 In `services/web/app/(reader)/reader/[id]/page.tsx`: import `loadPreferences`, `savePreferences` from `@/lib/reader-preferences`; initialise `fontSize` and `darkMode` state from `loadPreferences()` in a `useEffect` on mount
- [x] 5.2 Add `useEffect` that calls `savePreferences({ fontSize, darkMode })` whenever either value changes
- [x] 5.3 Replace the existing fixed top-right button cluster with `<ReaderTopBar>` wired to all preference and drawer state; remove the old inline button JSX
- [x] 5.4 Apply `FONT_SIZE_CLASSES` map (`{ sm: 'text-base', md: 'text-lg', lg: 'text-xl' }`) to the phrases `<div>` container className
- [x] 5.5 Apply dark/light classes to the page root `<div>` (`bg-gray-950 text-gray-100` vs `bg-white text-gray-800`) based on `darkMode` state
- [x] 5.6 Add `pt-14` to the text column `<main>` to clear the fixed top bar
- [x] 5.7 Pass `dark={darkMode}` to `<FragmentPopover>` and `<FragmentSheet>`

## 6. Verification

- [x] 6.1 Run `pnpm test` in `services/web` — all 9+ test suites pass
- [x] 6.2 Open `http://localhost:3000/reader/<any-book-id>` — confirm top bar renders with back, title, A−, A+, moon, magnifier, and Fragments button
- [x] 6.3 Tap back button (←) — confirm navigation to `/library`
- [x] 6.4 Tap magnifier — confirm navigation to `/discover`
- [x] 6.5 Tap A+ twice — confirm phrases grow; tap A− — confirm shrink; buttons disable at limits
- [x] 6.6 Reload page — confirm font size is restored from localStorage
- [x] 6.7 Tap moon icon — confirm background turns dark, text turns light, overlays match; tap sun — confirm return to light mode
- [x] 6.8 Reload page — confirm dark mode is restored from localStorage
- [x] 6.9 Commit and push all changes to GitHub
