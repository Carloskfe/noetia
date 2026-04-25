## ADDED Requirements

### Requirement: Font size preference with three steps
The reader SHALL support three font size steps: small (`text-base`), medium (`text-lg`, default), and large (`text-xl`). The active step SHALL be applied as a Tailwind class on the phrase list container. The top bar SHALL include a font size control with decrease (A−) and increase (A+) buttons that cycle through the three steps. The selected step SHALL be persisted to localStorage under the key `reader-font-size` and restored on next load.

#### Scenario: User increases font size
- **WHEN** the user taps the A+ button and the current size is not already large
- **THEN** the font size advances one step and phrases re-render at the new size

#### Scenario: User decreases font size
- **WHEN** the user taps the A− button and the current size is not already small
- **THEN** the font size decreases one step and phrases re-render at the new size

#### Scenario: Font size at maximum
- **WHEN** the current font size is large and the user taps A+
- **THEN** the button is disabled (or visually inert) and the size does not change

#### Scenario: Font size at minimum
- **WHEN** the current font size is small and the user taps A−
- **THEN** the button is disabled (or visually inert) and the size does not change

#### Scenario: Font size persists across sessions
- **WHEN** the user sets font size to large and reloads the reader page
- **THEN** the reader opens with large font size applied

### Requirement: Dark mode toggle
The reader SHALL support a dark reading theme. A moon/sun icon button in the top bar SHALL toggle between light mode (white background, dark text) and dark mode (near-black background, light text). The active theme SHALL be applied as CSS classes on the page's root element. `FragmentPopover` and `FragmentSheet` SHALL accept a `dark` boolean prop and apply matching background and text classes. The selected theme SHALL be persisted to localStorage under the key `reader-dark-mode` and restored on next load.

#### Scenario: User switches to dark mode
- **WHEN** the user taps the moon icon button while in light mode
- **THEN** the page background becomes near-black, text becomes light, and the icon changes to a sun

#### Scenario: User switches back to light mode
- **WHEN** the user taps the sun icon button while in dark mode
- **THEN** the page returns to white background with dark text and the icon changes to a moon

#### Scenario: Fragment overlays match active theme
- **WHEN** the user opens FragmentPopover or FragmentSheet while dark mode is active
- **THEN** both overlays render with dark backgrounds and light text matching the reader theme

#### Scenario: Dark mode persists across sessions
- **WHEN** the user enables dark mode and reloads the reader page
- **THEN** the reader opens in dark mode

### Requirement: Preference helpers are isolated and testable
A `lib/reader-preferences.ts` module SHALL export `loadPreferences()` and `savePreferences(prefs)` functions. `loadPreferences` SHALL return a `ReaderPreferences` object (`{ fontSize: 'sm'|'md'|'lg', darkMode: boolean }`) reading from localStorage, or defaults (`{ fontSize: 'md', darkMode: false }`) when running server-side or when no value is stored. `savePreferences` SHALL write both keys to localStorage. The module SHALL NOT import any React or Next.js APIs.

#### Scenario: Load with no stored values
- **WHEN** localStorage has no `reader-font-size` or `reader-dark-mode` keys
- **THEN** `loadPreferences()` returns `{ fontSize: 'md', darkMode: false }`

#### Scenario: Load with stored values
- **WHEN** localStorage contains `reader-font-size = "lg"` and `reader-dark-mode = "true"`
- **THEN** `loadPreferences()` returns `{ fontSize: 'lg', darkMode: true }`

#### Scenario: Save writes both keys
- **WHEN** `savePreferences({ fontSize: 'sm', darkMode: true })` is called
- **THEN** localStorage contains `reader-font-size = "sm"` and `reader-dark-mode = "true"`

#### Scenario: Server-side returns defaults
- **WHEN** `window` is not defined (SSR context)
- **THEN** `loadPreferences()` returns `{ fontSize: 'md', darkMode: false }` without throwing
