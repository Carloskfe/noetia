# EAS Build & Submit Guide

Complete guide for building and publishing Noetia to the iOS App Store and Google Play.

---

## Prerequisites

| What | Where to get it | Cost |
|------|-----------------|------|
| Expo account | expo.dev (carloskfe) | Free |
| Apple Developer account | developer.apple.com | $99/yr |
| Google Play Console account | play.google.com/console | $25 one-time |
| EAS CLI | `npm install -g eas-cli` | Free |

---

## One-time setup

### 1. Log in to EAS

```bash
eas login   # use carloskfe account
eas whoami  # confirm
```

### 2. Set EAS secrets

These values are NOT in eas.json (they're sensitive or file-based). Set them once — EAS stores them server-side and injects them into every build automatically.

```bash
cd services/mobile

# Google Services JSON for Android FCM push notifications
eas secret:create --scope project \
  --name GOOGLE_SERVICES_JSON \
  --type file \
  --value ./google-services.json

# Google OAuth client ID (web client ID from Google Cloud Console → APIs → Credentials)
eas secret:create --scope project \
  --name EXPO_PUBLIC_GOOGLE_CLIENT_ID \
  --value "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

# Facebook App ID (from developers.facebook.com → your app → Settings → Basic)
eas secret:create --scope project \
  --name EXPO_PUBLIC_FACEBOOK_APP_ID \
  --value "YOUR_FACEBOOK_APP_ID"
```

Verify secrets are set:
```bash
eas secret:list
```

### 3. Set up iOS credentials (EAS manages these)

EAS creates and manages your iOS signing certificates and provisioning profiles automatically when you first run a production build. You don't need to touch Xcode or the Apple Developer portal manually.

When prompted during the first production build, EAS will:
- Create a Distribution Certificate (or reuse an existing one)
- Create an App Store provisioning profile for `com.noetia.app`
- Store both securely in EAS

### 4. Set up Android keystore (EAS manages this)

Similarly, EAS creates and manages the Android signing keystore. When you run the first production build for Android, EAS generates a keystore and stores it securely. **The keystore EAS creates is what Google Play will trust — keep it in EAS, never lose it.**

---

## Fill in the submit placeholders

Before submitting, edit `eas.json` to replace the two iOS placeholders:

**ascAppId** — the numeric App Store Connect app ID:
1. Go to appstoreconnect.apple.com → Apps
2. Create "Noetia" if it doesn't exist (Bundle ID: `com.noetia.app`)
3. Open the app — the URL will be `.../apps/XXXXXXXXXX/...`
4. That 10-digit number is your `ascAppId`

**appleTeamId** — your 10-character Apple team ID:
1. Go to developer.apple.com → Account → Membership Details
2. Copy the "Team ID" field (e.g. `ABC123DEF4`)

**google-play-key.json** (for Android auto-submit):
1. In Google Play Console → Setup → API access → Link to a Google Cloud project
2. Create a service account → grant it "Release manager" role
3. Create and download a JSON key
4. Save as `services/mobile/google-play-key.json` (gitignored — never commit)
5. Also create the app in Play Console first (package `com.noetia.app`)

---

## Building

Run all build commands from `services/mobile/`.

### Development build (for testing with expo-dev-client)

```bash
# iOS simulator
eas build --profile development --platform ios

# Android device (APK)
eas build --profile development --platform android
```

### Preview build (internal distribution — TestFlight / direct APK install)

Used for QA and stakeholder testing before a store release.

```bash
# Both platforms
eas build --profile preview --platform all

# iOS only → automatically added to TestFlight internal group
eas build --profile preview --platform ios

# Android only → APK downloadable via QR code from EAS dashboard
eas build --profile preview --platform android
```

### Production build (App Store / Google Play)

```bash
# Both platforms — triggers autoIncrement on build number / versionCode
eas build --profile production --platform all

# Single platform
eas build --profile production --platform ios
eas build --profile production --platform android
```

After the build completes you'll get a link to download the artifact or submit it directly.

---

## Submitting to stores

### Submit immediately after a build

```bash
# Submit the latest production build to both stores
eas submit --profile production --platform all

# Submit to iOS only
eas submit --profile production --platform ios

# Submit to Android only
eas submit --profile production --platform android
```

EAS will prompt you to pick the build if there are multiple recent ones.

### Build + submit in one step

```bash
eas build --profile production --platform all --auto-submit
```

---

## iOS App Store flow

1. `eas submit` uploads the `.ipa` to App Store Connect
2. Open App Store Connect → TestFlight → wait for processing (~5 min)
3. Add the build to the **External Testing** group → Apple review (~24–48 hr)
4. Once approved: App Store → Pricing and Availability → Submit for Review
5. Apple review for production release: typically 24–48 hr

**Required before first submission:**
- App icon (1024×1024 PNG, no alpha) — already in `assets/icon.png`
- At least 3 screenshots per device size (iPhone 6.7", iPhone 6.5", iPad 12.9" if supportsTablet)
- Privacy policy URL — `https://noetia.app/privacy`
- App description, keywords, category (Books), age rating

---

## Android Google Play flow

1. `eas submit` uploads the `.aab` to the **internal track**
2. In Play Console → Testing → Internal testing → promote the release
3. Track progression: Internal → Closed testing (alpha) → Open testing (beta) → Production
4. Production rollout can be staged (e.g. 10% → 50% → 100%)

**Required before first submission:**
- App icon (512×512 PNG)
- Feature graphic (1024×500 PNG)
- At least 2 screenshots (phone) + 1 screenshot (7" tablet) + 1 screenshot (10" tablet)
- Privacy policy URL — `https://noetia.app/privacy`
- App description, short description, category (Books & Reference)
- Content rating questionnaire (complete in Play Console)

---

## OTA updates (EAS Update)

OTA updates let you push JavaScript changes to users without a store review. Native code changes (new plugins, package.json dependencies) always require a new store build.

```bash
# Push an OTA update to production channel (reaches all production builds)
eas update --channel production --message "fix: reader scroll position"

# Push to preview channel only (for internal QA)
eas update --channel preview --message "feat: new stats tab"
```

OTA updates are tied to `runtimeVersion` (set to `sdkVersion` policy = "51.0.0"). All production builds on SDK 51 will receive updates pushed to the production channel.

**When you DO need a new store build:**
- Adding or updating native packages (expo plugins, React Native libs)
- Upgrading Expo SDK version
- Changing `app.config.js` permissions, bundle ID, or plugins

---

## Version numbering

- **`version`** in `app.config.js` — the user-visible version (e.g. "1.0.0", "1.1.0"). Update manually before major/minor releases.
- **`buildNumber`** (iOS) / **`versionCode`** (Android) — auto-incremented by EAS on every production build (`autoIncrement: true`). Do not edit these manually.

To bump the version:
```bash
# Edit app.config.js version field, then build
nano services/mobile/app.config.js  # change version: '1.0.0' → '1.1.0'
eas build --profile production --platform all
```

---

## Checklist before first store submission

- [ ] Apple Developer account active ($99/yr paid)
- [ ] App created in App Store Connect (`com.noetia.app`)
- [ ] `ascAppId` and `appleTeamId` filled in `eas.json`
- [ ] Google Play Console account active ($25 paid)
- [ ] App created in Play Console (`com.noetia.app`)
- [ ] `google-play-key.json` downloaded and saved in `services/mobile/`
- [ ] All 3 EAS secrets set (`GOOGLE_SERVICES_JSON`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_FACEBOOK_APP_ID`)
- [ ] Screenshots prepared for both stores
- [ ] Privacy policy live at `https://noetia.app/privacy`
- [ ] Production build succeeds: `eas build --profile production --platform all`
- [ ] `eas submit` completes without errors
