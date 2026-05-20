# App Store Submission Guide

## Prerequisites

1. **Expo account** (free) — already set up, owner: `carloskfe`
2. **EAS CLI** — install globally: `npm install -g eas-cli`
3. **Apple Developer Program** — $99/yr at developer.apple.com (needed for iOS)
4. **Google Play Console** — $25 one-time at play.google.com/console (needed for Android)

---

## iOS Submission

### Step 1 — Apple Developer enrollment
1. Go to developer.apple.com → enroll in Apple Developer Program ($99/yr)
2. Note your **Team ID** (10-character alphanumeric, e.g. `ABCDE12345`)

### Step 2 — Create app in App Store Connect
1. Go to appstoreconnect.apple.com
2. Apps → + → New App
3. Platform: iOS, Name: Noetia, Bundle ID: `com.noetia.app`
4. Note the **App ID** (numeric, e.g. `1234567890`)

### Step 3 — Update eas.json
Edit `services/mobile/eas.json` submit.production.ios:
```json
"ios": {
  "appleId": "carloskfe@gmail.com",
  "ascAppId": "YOUR_APP_ID_FROM_STEP_2",
  "appleTeamId": "YOUR_TEAM_ID_FROM_STEP_1"
}
```

### Step 4 — Build
```bash
cd services/mobile
eas login
eas build --platform ios --profile production
```
This takes ~15-20 minutes on EAS servers. You'll get a download link.

### Step 5 — Submit
```bash
eas submit --platform ios --profile production
```
EAS will prompt for your Apple ID password or App Store Connect API key.

### Step 6 — App Store Connect
- Fill in app description, screenshots, keywords, support URL
- Submit for review (~1-3 days)

---

## Android Submission

### Step 1 — Google Play Console enrollment
1. Go to play.google.com/console → Pay $25 one-time fee
2. Create new app → Name: Noetia, package: `com.noetia.app`

### Step 2 — Service account key
1. Google Play Console → Setup → API access → Link to Google Cloud project
2. Create service account with **Release Manager** role
3. Download JSON key → save as `services/mobile/google-play-key.json`
4. **Never commit this file** — it's in .gitignore

### Step 3 — Build
```bash
cd services/mobile
eas build --platform android --profile production
```

### Step 4 — Submit
```bash
eas submit --platform android --profile production
```
This uploads the AAB to the internal testing track.

### Step 5 — Google Play Console
- Fill in store listing (description, screenshots, content rating)
- Promote from internal → production

---

## Both platforms simultaneously
```bash
eas build --platform all --profile production
eas submit --platform all --profile production
```

---

## OTA Updates (after initial release)

For JavaScript-only changes (no native code), use OTA updates — no app store review needed:
```bash
eas update --branch production --message "Fix: description of change"
```

This pushes the update immediately to all users on the production runtime.

---

## Environment Variables for Production Build

The `production` profile in `eas.json` sets:
- `EXPO_PUBLIC_API_URL=https://noetia.app/api`

For any additional secrets, add them as EAS secrets:
```bash
eas secret:create --scope project --name MY_SECRET --value "value"
```

---

## App Store Metadata (prepare in advance)

| Field | Value |
|-------|-------|
| App name | Noetia |
| Subtitle | Lee. Escucha. Comparte. |
| Bundle ID | com.noetia.app |
| Category | Books |
| Age rating | 4+ |
| Privacy policy URL | https://noetia.app/legal/privacy |
| Support URL | https://noetia.app |
| Marketing URL | https://noetia.app |

**Short description (80 chars):**
> Read, listen, and share fragments from the books that matter to you.

**Long description:**
> Noetia is a synchronized reading platform where text and audio play together phrase by phrase. Highlight the ideas that move you, create visual quote cards, and share them across your networks.
>
> Features:
> • Synchronized text + audio (Modo Escucha Activa)
> • Capture highlights as fragments
> • Generate visual quote cards for Instagram, LinkedIn, Facebook, and Pinterest
> • Offline reading — download books for reading without internet
> • Duo and Family plans — share your subscription with loved ones
> • Gift tokens to friends and family
