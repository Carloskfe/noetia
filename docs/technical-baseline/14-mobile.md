# 14 — Mobile

Framework: **React Native + Expo** (managed workflow, EAS build/OTA). `services/mobile`.

## Structure — CONFIRMED (`services/mobile/src`)
```
navigation/  hooks/  lib/  types/  api/  i18n/  components/  auth/  offline/
screens/{auth, account, library, reader, fragments, clubs}
screens/ConsentScreen.tsx  screens/LanguageScreen.tsx  screens/PaywallScreen.tsx
```

## Key dependencies — CONFIRMED (`package.json`)
- `expo`, `expo-status-bar`, `expo-updates` (OTA), `expo-web-browser`.
- **Audio:** `expo-av` (not react-native-track-player).
- **Auth:** `expo-auth-session`, `expo-apple-authentication`, `expo-crypto` (OAuth: Google/Facebook/Apple via mobile token-exchange endpoints).
- **Notifications:** `expo-notifications` (Expo push; backend `push_tokens`).
- **Offline/state:** `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`.
- **Navigation/UI:** `react-native-screens`, `react-native-safe-area-context`.

## Feature parity — CONFIRMED (screens present)
- **Auth:** login/register + social auth; `PaywallScreen` (subscription check after login).
- **Library:** catalog + user library.
- **Reader:** its own reader screen (Escucha Activa / phrase sync, auto-scroll, speed) — a **separate implementation** from web (own strings; web reader namespaces are not mirrored to mobile).
- **Fragments:** create/view offline-capable fragments.
- **Clubs:** club screens.
- **Sharing:** ShareSheet with 4 platforms (per project notes).
- **Account / Consent / Language:** settings, consent capture, language selection.

## Offline support — CONFIRMED (`src/offline`)
- `book-download.ts`, `book-storage.ts` — download & cache book phrases/content.
- `progress-storage.ts` — local reading position (seek-on-load from saved position).
- `fragment-storage.ts` — offline fragments.
- `consent-storage.ts`, `tour-storage.ts` — local flags.
- `sync.ts` — reconcile on reconnect (NetInfo offline→online → `syncOfflineData`).
- Backend: AsyncStorage (key-value); **no SQLite**. **CONFIRMED** from deps.

## i18n — CONFIRMED
`src/i18n/{en,es}.ts` with a `LanguageProvider`, syncing UI language to/from the API on mount. Mobile strings are **platform-specific** (not shared with web per project convention).

## Distribution — CONFIRMED / INFERRED
- `expo-updates` present → **OTA updates** for JS-only changes.
- **Not yet published to app stores** (needs Apple Developer + Google Play enrollment per project state). Native binary submission pending. **INFERRED** current store status; capability **CONFIRMED**.

## Testing — CONFIRMED
24 unit spec files under `services/mobile/tests/unit` (see [18-testing.md](18-testing.md)).

## Notable — CONFIRMED
- **No mobile stats screen** (the `stats` surface is web-only) — a known gap.
- Mobile audio-position/duration handling mirrors the web `effectiveDuration` concept (concatenated-MP3 header workaround) per project notes.
