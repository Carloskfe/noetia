# Apple App Store — App Privacy

**Privacy Policy URL:** https://noetia.app/legal/privacy

> Copy the answers below into App Store Connect → Your App → App Privacy.
> Complete the privacy questionnaire for each data type listed.

---

## Does this app collect data from users?

**Yes**

---

## App Privacy Label — Data Linked to Identity

The following data types are collected and **linked to the user's identity**:

| Data Type | Category | Purpose(s) | Notes |
|-----------|----------|------------|-------|
| Email Address | Contact Info | Account Management, App Functionality | Used for login and account-related communications |
| Name | Contact Info | Account Management | Collected via registration or OAuth providers |
| Purchase History | Purchases | Analytics, Account Management | Subscription history managed via Stripe |
| Reading Activity | Usage Data | App Functionality, Product Personalization | Reading progress per book, phrase position |
| User Content (fragments, notes) | User Content | App Functionality | Highlights and notes created by the user |

---

## App Privacy Label — Data NOT Linked to Identity

The following data types are collected but **not linked to the user's identity**:

| Data Type | Category | Purpose(s) | Notes |
|-----------|----------|------------|-------|
| Crash Data | Diagnostics | Analytics | Used solely to identify and fix bugs |

---

## Is any of the collected data used to track users across other companies' apps or websites?

**No** — Noetia does not use any data to track users across third-party apps or websites. We do not participate in advertising networks or cross-app tracking.

---

## Third-Party SDKs that collect data

| SDK / Service | Data collected | Purpose |
|---------------|----------------|---------|
| Stripe iOS SDK | Payment card data (handled on-device, not stored by Noetia) | Payment processing |
| Google Sign-In SDK | Google account email | Authentication |
| Facebook Login SDK | Facebook account email | Authentication |
| Apple Sign In | Apple ID email (may be relayed) | Authentication |

---

## Data Retention

Users may request deletion of all their data by contacting **legal@noetia.app**.
Account and reading data is retained until deletion is requested.
Payment records are retained for 7 years as required by tax regulations.

---

## Summary for App Store Connect questionnaire

When completing the questionnaire step-by-step in App Store Connect, select:

1. **Contact Info → Email Address** — Linked to Identity — Account Management
2. **Contact Info → Name** — Linked to Identity — Account Management
3. **Purchases → Purchase History** — Linked to Identity — Analytics
4. **Usage Data → Other Usage Data** (reading progress) — Linked to Identity — App Functionality
5. **User Content → Other User Content** (fragments/notes) — Linked to Identity — App Functionality
6. **Diagnostics → Crash Data** — NOT Linked to Identity — App Functionality (bug fixes)

---

*Last updated: April 24, 2026*
*Subject to legal review before submission.*
