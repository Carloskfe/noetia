# Noetia — Project Stages, Sprints & Tasks

> **Product hierarchy (governs all prioritization):**
> 1. **Reader experience** — daily active user; reading engine, sync, fragments, sharing
> 2. **Author/company experience** — content supply chain; upload, sync tooling, analytics
> 3. **Free library** — beta acquisition only; not expanded after 6–12 months; UI hero will yield to author content
>
> **Current status (2026-06-25):** Stages 0–5 complete + major feature sprint complete. **Production live at https://noetia.app** — Contabo VPS (Traefik v2.11, containers healthy, 61 migrations applied). SSH port 222, fail2ban active. CI/CD working (auto-deploys + runs migrations).
>
> **Completed since last update:**
> - [x] **Sync-map units bug fixed (2026-07-14, migration 062)** — legacy chapter-linear (`auto`) maps stored phrase times in ms; reader expects seconds → Escucha Activa ~1000× off (reported on Crimen y Castigo). `alignment.service.ts` now emits seconds; migration rescales 26 existing maps. See [whisper-sync-troubleshooting.md §13](whisper-sync-troubleshooting.md#13-phrase-timing-units-and-why-chapter-linear-alignment-is-retired) ✅
> - [x] **Chapter-linear alignment retired** — validated `alignAll` fixes span but not accuracy (Crimen: 55 text headings vs 30 audio chapters). New titles must get a Whisper map; `auto` is never shippable ✅
> - [x] **Search quality-gate cull (2026-07-15, `963313a`)** — below-standard titles leaked into Meili search (only isFree/isPublished filtered); now indexes a `meetsStandard` flag matching discovery + collections. **Re-run `seed-search` after deploy** ✅
> - [x] **OAuth email-confirmation fix (migration 063)** — Google/FB/Apple users created before emailConfirmed-on-create were trapped behind the confirmation gate with no email; `upsertOAuthUser` now heals on login, migration confirms the backlog ✅
> - [x] **Reader audio timeline — full-book HH:MM:SS** — `formatTimecode` in reader-utils; timeline already used `effectiveDuration` (full book, not one chapter) ✅
> - [x] **Quote card text size (S/M/L)** — `textScale` param in image-gen + ShareModal control + scaled preview ✅
> - [ ] **Whisper maps for the ~26 culled `auto` books** *(carry-over — the one open sync item)* — Crimen y Castigo, Viaje al Centro de la Tierra, Niebla, most Bible books, etc. Run the §2 Colab pipeline; they stay culled until ≥90% coverage
> - [x] Stripe fully activated — 10 products, webhook live, price IDs in DB ✅
> - [x] Meilisearch seeded — 67 books indexed, search functional ✅
> - [x] Google OAuth live — any Google account can log in ✅
> - [x] Facebook OAuth configured — Dev mode (test users); Go Live pending Meta business verification ✅
> - [x] Audio M4B→MP3 transcoding — 63 books on MinIO (progressive streaming, <2s start) ✅
> - [x] Mobile audio seek-on-load — audio starts from user's saved reading position ✅
> - [x] All unit tests green — 686 API tests + 145 mobile tests passing ✅
> - [x] Duo/Family invite flow — backend + billing UI + /join acceptance page ✅
> - [x] Token "Comprar" buttons wired on pricing page ✅
> - [x] Gift cards — 1/3 tokens, personal message, occasion, Stripe one-time, email delivery ✅
> - [x] PostgreSQL daily backups — 2 AM cron, 7-day daily + 4-week Sunday retention ✅
> - [x] MinIO weekly backups — Sunday 3 AM cron, 4-copy retention ✅
> - [x] MinIO bucket policy audit — books/ and audio/ confirmed private, images/ public ✅
> - [x] Mobile paywall enforcement — subscription check after every login ✅
> - [x] Mobile register screen — name/email/password + social auth ✅
> - [x] Mobile audio player — Modo Escucha Activa, phrase sync, auto-scroll, speed control ✅
> - [x] Mobile sharing flow — ShareSheet, 4 platforms, generate + share/open ✅
> - [x] Offline book download — cache phrases, DownloadButton in reader header ✅
> - [x] Auto-sync on reconnect — NetInfo offline→online triggers syncOfflineData ✅
> - [x] Push notifications — Expo push, invite accepted + gift claimed triggers ✅
> - [x] Spanish/English i18n — both web and mobile, language selection as first decision ✅
> - [x] Complete i18n — ReaderTopBar, BottomNav, all 5 tutorials, and all 8 email templates fully bilingual; web + mobile LanguageProvider syncs language to/from API on mount ✅
> - [x] Noetia Clubs — 7 migrations (046–052: clubs, members, books, messages, discussions, polls, sessions); ClubsTutorial + WelcomeSplash entry point + landing section + discover banner ✅
> - [x] Grafana monitoring fixed — access via Tailscale (100.84.48.16:3001, no SSH tunnel), `or vector(0)` pattern eliminates false-positive DatasourceNoData alerts; docs at docs/grafana-monitoring.md ✅
> - [x] CD pipeline hardened — force-remove containers before up, DB_HOST in migration step ✅
> - [x] ShareModal D3/D4/D7 — hex picker, gradient directions, background presets all done ✅
> - [x] Reading stats — 7-day bar chart, streak counter, all-time totals, weekly goal progress rings; heartbeat hook in reader (60s, phrasDelta tracking); GET /api/stats/me + POST /api/stats/heartbeat ✅
> - [x] Privacy settings — 4 toggles (reading progress, library, profile, fragments) with optimistic PATCH; columns on users table ✅
> - [x] Weekly goals — minutes + books per week, user-editable, stored on users.goalWeeklyMinutes/goalWeeklyBooks ✅
> - [x] Profile page tabs — Profile / Stats / Privacy three-tab layout; all strings i18n'd ✅
> - [x] Reader Persona pipeline — events table (migrations 057–058), 20-theme fragment tagging, user_personas computed table (migration 059), nightly cron, admin endpoints ✅
> - [x] Noetia Insights opt-out — allowInsights column (migration 060), 5th privacy toggle (amber accent), persona cron skips opted-out users ✅
> - [x] Legal terms updated — ALEXANDRIA bug fixed, correct plan prices ($8.99/$13.99/$18.99), analytics/persona disclosure, opt-out path, 30-day change notice ✅
> - [x] La Odisea text fixed — CatalogueEntry.textPostProcess hook strips verse numbers + illustration captions; reIngestText rebuilds DB phrases; deployed ✅
> - [x] 4 new books added — Platero y yo, Pepita Jiménez (ES); Meditations, Jane Eyre (EN); text + audio + covers live ✅
> - [x] **Developer docs overhaul (2026-06-25)** — CLAUDE.md restructured (39,987 → 31,576 chars); 5 new reference docs created; §Development Safety Rules added ✅
>   - `docs/sync-procedures.md` — Whisper pipeline, VTT procedure, quality status table (ES: 8 ✅ / 16 ❌ / 16 auto; EN: Meditations 45.1%, Jane Eyre next)
>   - `docs/incident-response.md` — 8 production playbooks (Traefik, OOM, DB, MinIO, SSL, CI/CD, Grafana)
>   - `docs/secrets-rotation.md` — rotation procedure for all 9 production secrets
>   - `docs/database-migrations.md` — migration history (000–061), golden rules, run/generate commands
>   - `docs/persona-pipeline.md` — event stream, 20-theme taxonomy, 8-aggregation computation, admin endpoints, opt-out
>   - PRD.md: plan names/prices corrected (Individual/Duo/Family, tokens not credits), catalog count, Whisper syncSource
>   - apple-app-privacy.md: behavioral analytics + persona pipeline disclosure added
>
> **Sync quality audit (2026-06-25 updated) — 73 books total (40 ES + 31 EN + 2 pending rights):**
>
> **Standard:** Whisper `syncCoverage` ≥ **90%** (raised from 85% on 2026-06-24). Full status table, diagnostic SQL, and per-book next steps: [`docs/sync-procedures.md`](sync-procedures.md).
>
> **ES:** 8 books ✅ ≥ 90% (Marianela 99.8%, Romeo y Julieta 99.1%, Don Juan Tenorio 98.6%, Cuentos de Amor 98.0%, Cuentos de la Selva 100%, Lazarillo 100%, Platero y yo 98.2%, Pepita Jiménez 96.8%) · 16 books ❌ below threshold (root causes vary — see sync-procedures.md) · 16 Bible books auto-sync only.
>
> **EN:** 1 book Whisper-attempted (Meditations 45.1% — CRLF fix applied; confidence stuck at 25%, likely translation mismatch). 30 books auto-sync. Next Whisper priority: **Jane Eyre** (39 sections).
>
> **Remaining before app store submission:**
> - [~] **Don Quijote Vol. I & II Whisper** — running on server overnight 2026-06-15; SCP VTTs back, commit, align on server when done
> - [ ] **Run whisper-batch.sh for remaining 22 Spanish books** — after Don Quijote completes; run on server; commit VTTs; align each via seed-sync-whisper.js
> - [ ] **Text source investigation for 11 below-threshold Spanish books** — identify which edition the LibriVox reader used; find matching Gutenberg/Wikisource text; apply textPostProcess; re-run Whisper
> - [ ] **English Whisper VTTs** — no English book Whisper-aligned; start Meditations then Jane Eyre on server after Spanish batch completes
> - [ ] **EAS build config** — app.config.js + eas.json complete; needs Apple Developer Program enrollment for ascAppId + appleTeamId
> - [ ] **App store submissions** — iOS ($99/yr Apple Developer) + Android ($25 one-time Google Play)
>
> **Backlog (post app store):**
> - [ ] **English Whisper sync** — run remaining 29 EN titles after Meditations + Jane Eyre; then expand EN catalogue
> - [ ] English free library — expand EN catalogue once priority titles are fully synced
> - [x] Facebook + Google OAuth credentials — Google live; Facebook Dev mode (Go Live pending Meta business verification) ✅
> - [ ] Narrator payment schemes — royalty/advance/hybrid field + marketplace UI
> - [ ] Gift cards — already built; consider adding more token amounts (5, 10)
> - [ ] Market segment engine — admin-defined rule-based segments from user_personas, user_segment_membership table, segment query UI
> - [ ] Persona-based book recommendations — surface books by semantic similarity to user's dominantThemes
> - [ ] Author persona analytics dashboard — show which reader archetypes resonate with each book (aggregate, N≥50)
>
> **Content pipeline — special titles:**
> - [x] **Magnifica Humanitas (León XIV) — rights clearance email sent** — Email sent 2026-06-10 to `diritti.lev@spc.va` (LEV Ufficio Diritti) from `pronoiallc@gmail.com`. Bilingual ES+EN. Subject: "Request for Authorization / Solicitud de autorización — Free Reproduction of Magnifica Humanitas (Leo XIV, 2026)". Requests: free reproduction of full ES+EN text, Vatican News EN audiobook licensing, and advance authorization for any future official ES audio. Follow up after 3–4 weeks if no reply; fallback `segreteria.lev@spc.va` or +39 06 6984 5766.
> - [ ] **Magnifica Humanitas — Spanish text ingestion** *(blocked on rights)* — Source: `https://www.vatican.va/content/leo-xiv/es/encyclicals/documents/20260515-magnifica-humanitas.html`. 7 sections (Intro + 5 chapters + Conclusión), ~245 párrafos, ~37,000 words. Add catalogue entry, ingest text, seed phrases.
> - [ ] **Magnifica Humanitas — English text ingestion** *(blocked on rights)* — Source: `https://www.vatican.va/content/leo-xiv/en/encyclicals/documents/20260515-magnifica-humanitas.html`. Same structure. Add catalogue entry, ingest text, seed phrases.
> - [ ] **Magnifica Humanitas — English audio sync** *(blocked on rights)* — Vatican News produced an official 7-part English audiobook (~4.5–6h total, narrator: Sr. Bernadette Reis FSP). Contact Vatican News to request licensing for third-party use. If granted, download the 7 files, run Whisper per-chapter, merge VTTs, align. Podcast page: `https://www.vaticannews.va/en/podcast/magnifica-humanitas.html`
> - [ ] **Magnifica Humanitas — Spanish audio** *(no source exists yet)* — No Spanish audiobook has been produced by the Vatican or any publisher as of 2026-06-10. This is a significant gap: ~40% of global Catholics are Spanish-speaking and Leo XIV is a native Spanish speaker. Options: (a) wait and monitor Vatican News Spanish service; (b) commission a narrator once LEV rights are confirmed — Noetia could be the first Spanish reading of this encyclical. ~4–5 hours of narration estimated.
>
> **Why this matters for Noetia:** *Magnifica Humanitas* is a papal encyclical specifically on AI and human dignity, signed May 15, 2026 (135th anniversary of Rerum Novarum). It is culturally timely, intellectually substantial (~37,000 words, comparable to Meditations in scope), available in both target languages, and authored by the first American pope — a native Spanish speaker. Offering it in a Spanish reading app with synchronized audio would be distinctive and relevant to Noetia's audience.
>
> **Security & ops backlog:**
> - [x] SSH hardening — fail2ban, port 222, UFW ✅
> - [x] PostgreSQL backups — daily cron + retention ✅
> - [x] MinIO backups — weekly cron + retention ✅
> - [x] MinIO bucket policy audit — books/audio private, images public ✅
> - [x] Server monitoring & alerting — Grafana live via Tailscale (100.84.48.16:3001); alerts for API error rate + container restarts; false-positive fix deployed ✅
> - [ ] Let's Encrypt renewal smoke test — verify auto-renewal 30 days before expiry
> - [ ] GitHub Actions deploy scope — dedicated deploy user instead of root SSH key
> - [x] Secrets rotation policy — `docs/secrets-rotation.md` with full procedure for all 9 production secrets ✅
> - [x] Privacy policy compliance — GDPR/CCPA data retention policy, opt-out toggle, analytics disclosure ✅

**Estimation key:** Each task is estimated in days (1 dev). Sprints are 2 weeks (10 working days).
**Legend:** `[ ]` pending · `[x]` done · `[~]` in progress

> **Definition of Done — mandatory for all service tasks**
> A backend task is NOT complete until:
> - [x] A unit test file exists at the mirrored path under `tests/unit/`
> - [x] Tests cover happy path, edge cases, and error scenarios for every public method
> - [x] All tests pass (`npm run test` / `pytest`)
> - [x] Coverage for the modified service is ≥ 80% (`npm run test:cov` / `pytest --cov`)
> - [x] No test touches a real database or makes a real network call
>
> See [CLAUDE.md — Testing](../CLAUDE.md#testing) for naming conventions and run commands per service.

---

## Table of Contents

1. [Stage 0 — Foundation](#stage-0--foundation)
2. [Stage 1 — Core Platform](#stage-1--core-platform)
3. [Stage 2 — Social Layer](#stage-2--social-layer)
4. [Stage 3 — Monetization & Publishers](#stage-3--monetization--publishers)
5. [Stage 4 — Mobile & Offline](#stage-4--mobile--offline)
6. [Stage 5 — Launch & QA](#stage-5--launch--qa)

---

## Stage 0 — Foundation

> **Goal:** Project infrastructure, tooling, and design system ready before feature development begins.
> **Estimate:** 2 weeks · 1 sprint

### Sprint 0.1 — Project Setup (Weeks 1–2)

**Infrastructure**
- [x] Initialize monorepo structure and Git repository — 0.5d
- [x] Write `docker-compose.yml` with all services (api, web, db, cache, storage, proxy) — 1d
- [x] Write `docker-compose.prod.yml` with production overrides — 0.5d
- [x] Configure `.env.example` with all required variables — 0.5d
- [x] Set up Nginx reverse proxy with routing rules — 0.5d
- [x] Initialize MinIO and create buckets: `books/`, `audio/`, `images/` — 0.5d
- [x] Set up PostgreSQL with `init.sql` base schema — 1d
- [x] Set up Redis with `redis.conf` — 0.5d

**Testing Setup**
- [x] Configure Jest + coverage in `api` and `worker` (80% threshold, `tests/unit/` root) — 0.5d
- [x] Configure Jest + coverage in `web` and `mobile` (80% threshold, `tests/unit/` root) — 0.5d
- [x] Configure pytest + pytest-cov in `image-gen` (80% threshold, `tests/unit/` root) — 0.5d

**CI/CD**
- [x] Configure GitHub Actions: lint, test (with coverage gate ≥ 80%), build on PR — 1d
- [x] Configure GitHub Actions: deploy to staging on merge to main — 1d _(SSH deploy to Contabo VPS via DEPLOY_SSH_KEY secret; triggers on push to main)_

**Design System**
- [x] Define color palette, typography, and spacing tokens — done-in-practice (Tailwind config + design tokens ship in the live web/mobile apps)
- [x] Create base component library (Button, Card, Typography, Input) — done-in-practice (component library built out across the live app)

**Sprint 0.1 total: 11.5d** _(1.5d added for test framework setup across all services)_

---

## Stage 1 — Core Platform

> **Goal:** Working reading experience with auth and content library — the foundation users interact with.
> **Estimate:** 6 weeks · 3 sprints

---

### Sprint 1.1 — Authentication & User Management (Weeks 3–4)

**Backend (api)**
- [x] Set up NestJS project with TypeScript, ESLint, Prettier — 0.5d
- [x] Configure database connection with TypeORM and migrations — 0.5d
- [x] Create `users` table and entity — 0.5d
- [x] Implement email + password auth (register, login, JWT) — 1d
- [x] Email confirmation on registration (24h token via SMTP/nodemailer; OAuth users auto-confirmed) — 0.5d
- [x] Password recovery via email reset link (EmailService, SMTP env vars) — 0.5d
- [x] Integrate Google OAuth — 0.5d
- [x] Integrate Facebook OAuth — 0.5d
- [x] Integrate Apple Sign-In — 1d
- [x] Auth guards, refresh tokens, and logout — 1d
- [x] User profile endpoints (GET, PATCH, DELETE) — 0.5d
- [x] Unit tests: `auth.service`, `users.service` (mock DB, cover happy path + errors) — 1d

**Frontend (web)**
- [x] Set up Next.js project with TypeScript and Tailwind — 0.5d
- [x] Build login page (email/password + social buttons) — 1d
- [x] Build register page — 0.5d
- [x] Auth context and session persistence — 0.5d
- [x] Protected route wrapper — 0.5d

**Sprint 1.1 total: 10d** _(1d added for auth/user unit tests)_

---

### Sprint 1.2 — Content Library (Weeks 5–6)

**Backend (api)**
- [x] Create `books`, `authors`, `categories` tables and entities — 1d
- [x] Book CRUD endpoints (admin only) — 1d
- [x] Upload book text (EPUB/HTML) to MinIO — 1d
- [x] Upload audio file to MinIO — 0.5d
- [x] Streaming endpoint for audio (range requests, DRM headers) — 1d
- [x] Streaming endpoint for book text (encrypted, chunked) — 1d
- [x] Book search endpoint (Meilisearch integration) — 1d
- [x] Unit tests: `books.service`, `storage.service`, `search.service` (mock MinIO + Meilisearch) — 1d

**Frontend (web)**
- [x] Library page: book grid with cover, title, author — 1d
- [x] Book detail page: description, author, CTA — 0.5d
- [x] Category filter and search bar — 1d

**Sprint 1.2 total: 10d** _(1d added for books/storage/search unit tests)_

---

### Sprint 1.3 — Synchronized Reading Engine (Weeks 7–8)

**Backend (api)**
- [x] Design and store phrase-level sync map (JSON: phrase → timestamp) — 1d
- [x] Endpoint to fetch sync map for a given book — 0.5d
- [x] Reading progress endpoint (save/restore position by phrase index) — 0.5d
- [x] Unit tests: `sync-map.service`, `progress.service` (mock DB) — 0.5d

**Frontend (web)**
- [x] Reader layout: text column + audio controls — 1d
- [x] Render book text split into phrase spans — 1d
- [x] Audio player component (play/pause, scrub, speed 0.75×–2×) — 1d
- [x] Phrase highlight: sync audio time → active phrase highlight — 1.5d
- [x] Click phrase → seek audio to corresponding timestamp — 1d
- [x] Seamless switch: Reading → Listening (preserve position) — 0.5d
- [x] Seamless switch: Listening → Reading (scroll to active phrase) — 0.5d
- [x] Persist and restore reading progress — 0.5d
- [x] **Hybrid mode**: new reader mode — audio plays + full text visible + active phrase highlighted — 1d
  - Add `'hybrid'` to the mode state machine alongside `'reading'` and `'listening'`
  - Disable text selection (`user-select: none` + `onMouseDown` guard) while in hybrid mode
  - Display a "Hybrid" badge in the top bar with a one-tap exit button
  - Resume seamlessly: exiting hybrid mode pauses audio and enables selection at the current phrase
  - Unit tests: mode transition guards and selection-disabled behavior — 0.5d

**Sprint 1.3 total: 13d** _(hybrid mode adds 1.5d; 0.5d for sync/progress unit tests)_

---

## Stage 2 — Social Layer

> **Goal:** Fragment capture, quote card generation, and sharing — the core differentiator.
> **Estimate:** 6 weeks · 3 sprints

---

### Sprint 2.1 — Highlight & Fragment System (Weeks 9–10)

**Backend (api)**
- [x] Create `fragments` and `fragment_sheets` tables and entities — 1d
- [x] Fragment CRUD endpoints (create, read, update, delete) — 1d
- [x] Combine multiple fragments into a single selection — 1d
- [x] Fragment Sheet endpoint: list all fragments for a book/user — 0.5d
- [x] Unit tests: `fragments.service`, `fragment-sheets.service` (mock DB) — 0.5d

**Frontend (web)**
- [x] Text selection handler in reader (mouse + touch) — 1d
- [x] Highlight popover: "Save as Fragment" action — 0.5d
- [x] Fragment Sheet panel: list, edit, delete fragments — 1.5d
- [x] Combine fragments: multi-select + merge UI — 1d
- [x] Visual distinction between saved highlights in reader — 0.5d

**Sprint 2.1 total: 9.5d** _(0.5d added for fragments unit tests)_

---

### Sprint 2.2 — Image Generation Service (Weeks 11–12)

**image-gen service (Python)**
- [x] Set up Flask API with health check endpoint — 0.5d
- [x] Design LinkedIn quote card template (1200×627px) — 1d
- [x] Design Instagram quote card template (1080×1080px) — 1d
- [x] Design Facebook quote card template (1200×630px) — 0.5d
- [x] Design Pinterest quote card template (1000×1500 pin, 1000×1000 square) — replaces WhatsApp — 0.5d
- [x] Render endpoint: accept fragment + platform → return image — 1d
- [x] Upload generated image to MinIO `images/` bucket (MINIO_PUBLIC_URL rewrite for browser access) — 0.5d
- [x] Noetia watermark overlay — 0.5d
- [x] Font rendering for Spanish characters — 0.5d
- [x] Unit tests: `test_linkedin.py`, `test_instagram.py`, `test_facebook.py`, `test_pinterest.py` (mock MinIO, no network) — 1d

**worker service (BullMQ)**
- [x] Set up BullMQ worker connected to Redis — 0.5d
- [x] `image-render` job: call image-gen service + store result URL — 1d
- [x] Job status endpoint in api (pending / done / failed) — 0.5d
- [x] Unit tests: `image-render.job.spec.ts` (mock image-gen HTTP client + Redis) — 0.5d

**Frontend (web)**
- [x] Quote card preview modal: select platform format — 1d
- [x] Trigger image generation job, poll for result — 0.5d
- [x] Display rendered card preview — 0.5d

**Sprint 2.2 total: 11.5d** _(1.5d added for image-gen + worker unit tests)_

---

### Sprint 2.3 — Sharing Engine (Weeks 13–14)

**Backend (api)**
- [x] Share record endpoint: log share event (platform, fragment, user) — 0.5d
- [x] Signed URL generation for image download from MinIO — 0.5d
- [x] Unit tests: `sharing.service` (mock MinIO signed URL, mock DB) — 0.5d

**Frontend (web)**
- [x] "Share" button: native share sheet (Web Share API) — 0.5d
- [x] Platform-specific share links (LinkedIn, Instagram, Facebook, Pinterest) — 1.5d
- [x] Social OAuth account linking + direct publish (LinkedIn, Facebook, Instagram, Pinterest) — 1d
- [x] Fix download/copy link (MINIO_PUBLIC_URL presigned URL rewrite) — 0.5d
- [x] "Download image" fallback — 0.5d
- [x] Share confirmation feedback (toast notification) — 0.5d

**Sprint 2.3 total: 5.5d** _(0.5d added for sharing unit tests; light sprint — buffer for Stage 1–2 carry-over)_

---

## Stage 3 — Monetization & Publishers

> **Goal:** Paid subscriptions and author upload portal working end-to-end.
> **Estimate:** 4 weeks · 2 sprints

---

### Sprint 3.1 — Subscription & Payments (Weeks 15–16)

> Payment model: Audible-style hybrid. Users can buy titles individually (pay-per-title) or subscribe monthly to receive credits (1 credit = 1 book of any price). Individual plan = 1 credit/month; Reader plan = 2 credits/month. Credits expire at cycle end.

**Backend (api)**
- [x] Create `plans` table: Individual ($9.99/mo, 1 credit) and Reader ($14.99/mo, 2 credits) with annual variants — 0.5d
- [x] Create `subscriptions` table (userId, planId, status, creditBalance, currentPeriodEnd, trialEnd) — 0.5d
- [x] Create `book_purchases` table: record per-title purchases and credit redemptions — 0.5d
- [x] Stripe integration: create customer on sign-up — 0.5d
- [x] Stripe Checkout: redirect for subscription plans — 1d
- [x] Stripe Checkout: redirect for pay-per-title purchases — 0.5d
- [x] Stripe webhooks: activate/cancel subscription; issue credits on `invoice.paid` — 1d
- [x] Credit redemption endpoint `POST /api/library/redeem`: deduct 1 credit, record book_purchase — 0.5d
- [x] Free trial logic (14-day gate) — 0.5d
- [x] Content access guard: allow if book_purchase record exists OR active subscription with content access — 1d
- [x] Subscription status endpoint `GET /api/subscriptions/me` (status, creditBalance, plan) — 0.5d
- [x] Unit tests: `subscriptions.service`, `purchases.service`, `access-guard` (mock Stripe SDK, mock DB) — 1d

**Frontend (web)**
- [x] Pricing page: plan comparison table (pay-per-title + subscription plans side by side) — 1d
- [x] Book detail page: show list price + "Buy" button; "Use a Credit" button for subscribers — 0.5d
- [x] Credit balance indicator in user account page — 0.5d
- [x] Checkout flow for both subscription and per-title purchase — 0.5d
- [x] Paywall prompt: offer subscribe or buy-now for locked content — 0.5d
- [x] Post-payment success/cancel pages — 0.5d

**Sprint 3.1 total: 11.5d** _(1d added for unit tests; +2d for credit + per-title purchase mechanics)_

---

### Sprint 3.2 — Author / Publisher Module (Weeks 17–18)

**Backend (api)**
- [x] Create `publishers` table and role — 0.5d
- [x] Publisher registration and approval flow — 1d
- [x] Book upload endpoint: text + audio + metadata + cover — 1d
- [x] Hosting tier enforcement (1 / 3 / 12 books per tier) — 0.5d
- [x] Analytics endpoints: downloads, reads, shares per book — 1d
- [x] Revenue sharing record model — 0.5d
- [x] Unit tests: `publishers.service`, `analytics.service` (mock DB, mock MinIO) — 0.5d

**Frontend (web)**
- [x] Publisher registration page — 0.5d
- [x] Publisher dashboard: book list, upload form — 1.5d
- [x] Analytics charts per book (Recharts or Chart.js) — 1d
- [x] Upload progress indicator (large audio files) — 0.5d

**Sprint 3.2 total: 8.5d** _(0.5d added for publishers/analytics unit tests)_

---

## Stage 4 — Mobile & Offline

> **Goal:** React Native app with full feature parity and offline support.
> **Estimate:** 6 weeks · 3 sprints

---

### Sprint 4.1 — React Native App Shell (Weeks 19–20)

- [x] Initialize React Native project (Expo or bare workflow) — 0.5d
- [x] Shared API client package between web and mobile — 1d
- [x] Auth screens: login, register, social login — 1.5d
- [x] Bottom tab navigation: Library, Reader, Fragments, Account — 0.5d
- [x] Library screen: book grid — 1d
- [x] Book detail screen — 0.5d
- [x] Reader screen: text + audio player — 2d
- [x] Phrase-level sync on mobile — 1.5d

**Sprint 4.1 total: 10d**

---

### Sprint 4.2 — Mobile Fragments & Sharing (Weeks 21–22)

- [x] Text selection and fragment capture on mobile — 1.5d
- [x] Fragment Sheet screen — 1d
- [x] Quote card preview screen — 1d
- [x] Native share sheet integration — 0.5d
- [x] Subscription paywall on mobile — 1d
- [x] Push notification setup (Expo Notifications) — 1d

**Sprint 4.2 total: 7d** _(buffer for mobile-specific fixes)_

---

### Sprint 4.3 — Offline Mode (Weeks 23–24)

- [x] Download book text to device storage — 1d
- [x] Download audio file to device storage — 1d
- [x] Offline-capable reader (read from local files) — 1d
- [x] Offline-capable audio player (local file) — 0.5d
- [x] Store fragments offline (AsyncStorage / SQLite) — 1d
- [x] Sync progress and fragments when back online — 1.5d
- [x] Download manager UI: progress, cancel, delete — 1d

**Sprint 4.3 total: 8d**

---

## Stage 5 — Launch & QA

> **Goal:** Production-ready platform — performance tuned, bugs fixed, monitoring in place.
> **Estimate:** 4 weeks · 2 sprints

---

### Sprint 5.1 — Performance & Monitoring (Weeks 25–26)

**Backend**
- [x] Add Prometheus metrics to api service — 0.5d
- [x] Grafana dashboards: API latency, error rate, queue depth — 1d
- [x] CDN setup for MinIO assets (CloudFront or Cloudflare) — 1d _(self-hosted MinIO exposed via Traefik at storage.noetia.app; Cloudflare proxy can be enabled later as CDN layer)_
- [x] Database query optimization and indexing audit — 1d _(migration 032: idx_books_published_free, idx_books_collection, idx_books_category, idx_books_uploaded_by, idx_subscriptions_plan)_
- [x] API rate limiting and abuse protection — 0.5d _(ThrottlerModule: 120 req/min global, 20/min on auth endpoints; Stripe webhook exempt)_
- [x] Content streaming caching strategy — 0.5d _(HTTP Cache-Control on /books, /books/:id/sync-map, /collections)_

**Frontend**
- [x] Next.js performance audit (Lighthouse) — 0.5d _(metadata on all public pages, robots.txt, sitemap.xml, force-dynamic on auth pages, server-component landing page, Sentry dynamic import, WaitlistForm extracted; Chrome-based score audit pending)_
- [x] Image optimization (lazy loading, WebP covers) — 0.5d _(all covers use next/image with fill+sizes; remotePatterns for openlibrary.org)_
- [x] Code splitting and bundle size audit — 0.5d _(shared JS: 87 kB; largest page: /reader/[id] 109 kB First Load; /login 119 kB; no single page exceeds 120 kB First Load JS)_
- [x] Error boundary and global error tracking (Sentry) — 1d _(wired up in api + web; activate by setting SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN env vars)_

**Sprint 5.1 total: 8d**

---

### Sprint 5.2 — Beta QA & Launch Prep (Weeks 27–28)

- [x] End-to-end test suite (Playwright): auth, reader, sharing flow — 2d _(9/9 pass against production; 1 skipped: programmatic text selection headless limitation; runs via `npx playwright test` from services/web/)_
- [x] Load testing: simulate 500 concurrent readers — 1d _(k6 script at scripts/load-test/; 97% checks pass at 500 VUs; latency high on dev machine — production gap: CDN + DB pool tuning; @SkipThrottle({ global: true }) applied to reader endpoints; see scripts/load-test/RESULTS.md)_
- [x] DRM audit: verify no raw file access leaks — 1d _(presigned URLs 15-min TTL ✓; GET /books/:id guarded ✓; fixed: sync-map had no guard — now requires JWT + SubscriptionGuard; MinIO buckets should be set to private in prod)_
- [x] Accessibility audit (WCAG 2.1 AA) — 1d _(17 issues fixed: aria-label on 3 modal close buttons + 2 search inputs; role="dialog" aria-modal + Escape key on ChapterSheet, FragmentSheet, ShareModal; role="button" + keyboard on interactive phrase spans; focus rings on cookie toggles; aria-live on status messages)_
- [ ] App Store submission (iOS) — 1d _(requires Apple Developer Program $99/yr; one account covers all apps; use TestFlight for beta before full submission)_
- [ ] Google Play submission (Android) — 0.5d _(requires Google Play Console $25 one-time; APK can also be distributed directly from website without store review)_
- [x] Privacy policy and terms of service pages — 0.5d
- [x] Onboarding flow for new users — 1d
- [x] Beta invite system and waitlist page — 0.5d _(landing page at /, waitlist API with confirmation + invite emails, admin view with invite button)_

**Sprint 5.2 total: 9.5d**

---

## Session pause — resume here (2026-06-30, quote-card assets)

**Shipped & deployed today** (pushed to `main`, CD rebuilt web + image-gen — both `Up`/healthy on the server):
- `d865b64` — Noetia **logo watermark** on quote cards (light/dark variant auto-picked by background; replaces plain "Noetia" text; assets in `services/image-gen/assets/`).
- `945a39a` — **18-image Noetia background gallery** in the picker (`services/web/public/backgrounds/imagen-1..18.jpg`, optimized 35MB→3MB; `BG_PRESETS` now in `lib/share-utils`).
- `61247d0` — quote-card **horizontal flip** backend (`bgFlip` in image-gen). *UI still pending.*

**Uncommitted local changes (ready to commit tomorrow — a `fix:` for stale tests):**
- `services/image-gen/tests/unit/scripts/test_generate_presets.py` (5→7 fonts, renamed test)
- `services/image-gen/scripts/generate_presets.py` (docstring 5→7)
- `services/web/tests/unit/components/ShareModal.spec.ts` (FONTS registry lato/lora/raleway → the actual 7)
- Both suites verified green locally: image-gen **144 passed**, web ShareModal **34 passed**. Just needs `git commit` + `git push`.

**Next up:**
1. [x] **Flip toggle UI** — web `ShareModal` toggle + preview mirror, `bgFlip` threaded through api/share-utils (`7e4167d`); mobile flip Switch in ShareSheet (`fb3bd4b`). Camera/upload flip deferred to the native upload picker.
2. [x] **Mobile 18-image gallery** — preset picker in ShareSheet (Default + 18 presets, OTA-safe via preset URLs); `src/lib/share-backgrounds.ts` + tests (`fb3bd4b`). Camera/gallery upload deferred (needs `expo-image-picker` / eas build).
3. [~] **EN/ES free-library sync** — in progress:
   - Catalogue + Colab batch list complete for all 12 (6 EN self-dev + 6 ES second-wave).
   - **EN half (6 Gutenberg self-dev):** sources verified (all 200), clean and ready.
   - **ES half (6 second-wave):** all 6 `wikisourceTitle`s pointed at disambiguation/index pages — **fixed** (`06fecff`), validated 40k–533k chars each through the real fetcher. See troubleshooting §5b.
   - **Batch 1 aligned on prod (2026-07-06):** 5 titles ingested + aligned →
     - ✅ **How to Live on 24 Hours a Day 99.8%**, **As a Man Thinketh 98.7%** (EN), **La Edad de Oro 91.3%** (ES) — flipped `isFree=true`, audio in MinIO.
     - ❌ **El Príncipe 60.2%** — translation mismatch: the LibriVox audio (`elprincipe_2601_librivox`, PDF-sourced) uses a translation not on es.wikisource (neither Sánchez Rojas nor 1854 match "Costumbre es de cuantos…"). Held back; text readable via Sánchez Rojas. See troubleshooting §6. Options: source the exact translation (Gutenberg/archive.org PDF) or leave text-only.
     - ❌ **Cartas a Lucilio 56.6%** — as predicted (63/124 letters + *selección* audio). Held back.
   - **Still to transcribe (Colab) + align:** María, Rimas, Meditaciones (ES second-wave), + the other EN self-dev/second-wave titles.
   - **Doc bug fixed alongside:** CLAUDE.md deploy-verify query used `typeorm_migrations`; real table is `migrations` (`data-source.ts` sets no custom name).

---

## Backlog — Self-host ALL audio in MinIO (added 2026-07-05)

> **Decision (Carlos):** own/control all audio — no third-party streaming — the same model for future author/publisher audio. Scope: every book, all sources. Runs on prod via SSH (Carlos).

- [x] **Tool built** (`a22169e`) — `migrate-audio-to-minio.ts` + `audio-source-resolver.ts` (17 tests). Idempotent; resolves archive.org (direct) or LibriVox page → archive.org; downloads chapter MP3s → one progressive MP3 in MinIO → sets `audioStreamKey`. Nothing deleted. Validated on dev (dry run 38/39 resolved; Filipenses real run OK).
- [x] **Run on prod** — DONE. All book audio self-hosted in MinIO: **81 books on MinIO, 0 external**, 3 with no external audio (El Príncipe, Cartas a Lucilio, El Líder que No Tenía Cargo). No `audioStreamKey` starts with `http`.
- [ ] **Follow-on (better sync):** re-run Whisper against the *exact MinIO file* for drift-free timing. Mostly superseded by the 2026-07-12 drift fix (real audio-duration merge offsets); still the correct fix for the grouped-transcription holdouts — La Odisea, Fábulas y Verdades, Acts (per-chapter counts don't pair 1:1 with the concatenated audio).
- [ ] Note: `El Líder que No Tenía Cargo` is a Noetia original with no external audio — correctly skipped (needs its own recording when available).

---

## Backlog — User bug report batch 2 (added 2026-07-09, from Carlos) — narration/player

> Field-testing after the audio→MinIO migration. All **Reader #1** priority. Several likely connect to the sync-map vs served-audio timing and the audio-mode UX.

- [x] **Highlight leads the narration by ~5 phrases (audio runs behind)** — FIXED. Root cause confirmed as suspected: `merge-transcriptions.ts` offset each chapter by `last_cue_end + 2s gap`, but LibriVox chapters have ~5s of audio *after* the last cue, so the merged-VTT timeline ran ~3s short per chapter → cumulative negative drift (highlight leads). Fix: `mergeVttDirectory` now offsets each chapter by its **real audio duration** (ffprobed from the archive.org source via `fetchChapterDurations`, `--audio-id`). 76 multi-chapter books re-merged (`scripts/drift-realign.tsv` + `drift-realign.sh`); validated drift≈0 on El Príncipe, Marianela (6h01m), Romeo (2h21m).
  - **DEPLOYED + VERIFIED (2026-07-12):** all 76 re-aligned on prod. A compression regression on **Apocalipsis & Salmos** (bundled-audio `--audio-id` → undersized durations → timeline collapsed) was caught and fixed — reverted their VTTs (`2a5fa86`) + added a merge guardrail rejecting durations shorter than a chapter's own cues (`01d7a21`). Both recovered to 100.0% / 99.96%. Final audit: **free library = 57 books, 100% pass ≥90%, all synced** — nothing broken is offered. Full write-up: `docs/sync-procedures.md §3` + `whisper-sync-troubleshooting.md §12`.
  - **Residual — La Odisea (held back) still drifts:** grouped transcription (24 audio → 19 VTTs) can't pair 1:1 → gap fallback. Needs per-chapter re-transcription against the MinIO file. Same limitation: Fábulas y Verdades, and the EN Bible sub-books on bundled archive items (Ephesians, Philippians, Exodus, Genesis-KJV).
- [x] **Free-library promotion (2026-07-12):** promoted the 9 books that passed ≥90% but were held back — As a Man Thinketh, How to Live on 24 Hours a Day, The Game of Life, The Science of Getting Rich, Up from Slavery (EN); La Edad de Oro, Lazarillo de Tormes, Pepita Jiménez, Platero y yo (ES) — via guarded `UPDATE ... isFree=true` (gated on `syncCoverage ≥ 0.90`). Free library grown **57 → 66, all passing ≥90%.**
- [ ] **The Call of the Wild** — the one free-eligible EN book with no VTT (`auto` source); needs a Whisper transcription before it can be synced/offered.
- [ ] **Narration starts over from the beginning** — may be the resume-from-position race already fixed in `c12f1ff` (not yet deployed) — **verify after the web deploy**; if it persists it's a separate "restarts on chapter/segment boundary or on audio reload" bug.
- [x] **Audio progress bar reflects the chapter, not the whole book (added 2026-07-12, from Carlos)** — FIXED on web (`c7b18c3`). Confirmed root cause: multi-chapter audio is **byte-concatenated** (`migrate-audio-to-minio.ts` `Buffer.concat`), so the merged MP3 keeps the **first chapter's VBR/Xing duration header** → browsers report `audio.duration` as ~one chapter → the scrubber filled up within chapter 1. Fix: the reader drives the bar off `effectiveDuration() = max(audio.duration, last-phrase end)` (the sync map's last phrase is the true full-book length); `currentTime` was already correct. +5 unit tests. **Verify on prod after web deploy.**
  - [x] **Mobile:** FIXED (`df39aba`). `useAudioPlayer` now exposes `effectiveDuration()` as `duration` and uses it in the seek clamps — on mobile the stale header ALSO blocked `seekTo`/`skipForward` past chapter 1 (they clamped to `durationMillis`), so this fixes both the bar and cross-chapter scrubbing. +5 tests. **Needs an OTA push to reach users.**
  - **Optional backend follow-up:** re-mux the concatenated MP3s with a correct duration header (ffmpeg `-c copy -write_xing 1`, or concat-demuxer) so `audio.duration` is right at the source — avoids relying on the sync map and helps un-synced books. Not required now (frontend fix covers synced books).
- [x] **Can't get back to the correct audio position** — FIXED (`a287461`). Root cause: the nav-bar audio button opened the text-hidden "Now Playing" mode (only the active part, no context). It now opens **Escucha Activa**, which has a full scrubber, −10s/+10s, and tap-any-phrase-to-seek. The text-hidden player is opt-in via a "Solo audio" toggle. **Verify on prod after web deploy.**
- [x] **Player should show all parts together** — FIXED (`a287461`, same change). Escucha Activa presents the full text with the moving highlight + auto-scroll; it's now the default audio experience from both the nav button and the FAB. **Verify on prod after web deploy.**

---

## Backlog — User bug report batch (added 2026-07-03, from Carlos)

> Field-testing feedback. Ordered by product hierarchy: **Reader experience (#1) first**, then sharing (#2), then content/catalogue. Most reader items are mobile unless noted. None triaged/reproduced yet — each needs an owner + repro.

### A. Reader — narration & phrase sync (product hierarchy #1, highest priority)
- [x] **Phrase highlight unreliable during narration** — FIXED (`0eeb531`). Root cause: `heading`/`paragraph-break` phrases carry `startTime===endTime===0` and are interleaved with timed phrases, breaking `phraseAt` (web binary search returned wrong phrase/-1) and `findActivePhraseIndex` (mobile drifted onto the zero-timed marker). Both now skip zero-duration markers + are gap-tolerant.
- [x] **Highlight is off-by-one (shows the NEXT phrase, not the current one)** — FIXED with the same change (`0eeb531`); the wrong-neighbour result came from the non-monotonic array.
- [x] **Hybrid/mixed reading mode: text does not advance with the audio** — FIXED (`0eeb531`); auto-scroll was gated on `activePhraseIndex >= 0`, which the broken lookup kept returning -1. Verify on-device once deployed.
- [x] **Starting narration begins one phrase early** — FIXED (`04b7582`). `seekToPhrase` targeted the exact `startTime`; MP3 seeking snaps to the nearest frame (a hair earlier) → `phraseAt` resolved to the previous phrase. Now nudges the seek 150ms into the target phrase (capped at half the phrase's duration). +3 regression tests proving the nudged target resolves back to the same phrase. Applies to resume, tap-to-sync, bookmark-resume. **Verify on prod after web deploy.**
- [~] **Resume is slow and loses text position** — audio resume-to-position FIXED (`c12f1ff`, seek-before-loaded race); text already scrolls to saved phrase on load. Re-verify "slow" after deploy. — "continue where you left off" takes a long time to seek to the saved position, and the *text* is not restored to that spot (renders from the beginning of the book).
- [x] **After full-screen narration, returning to reading does not reposition the text** — FIXED (`e1943a4`). The reading list and audio player share one FlatList; auto-scroll only ran while *playing*, so pausing / manual scroll / the player-bar padding reflow left the reader stranded on close. The audio-close handler now captures the active phrase (before the audio hook tears down) and scrolls the list to it (`viewPosition 0.3`). **Mobile — needs an OTA.**
- [x] **Confirm before moving the audio start point mid-playback** — FIXED (`16bd26d`). Tapping a phrase while narration is *playing* now shows a "¿Mover la narración aquí?" card (Mover aquí / Seguir escuchando) instead of jumping immediately; when paused it still seeks directly. Prevents accidental taps yanking the listener away. **Verify on prod after web deploy.**
- [x] **Playback speed should persist across sessions** — FIXED (`0e88519`): stored in reader preferences, restored on load + re-applied on loadedmetadata. — after restarting a book, restore the speed selected in the last session.

### B. Reader — fragments & highlighting UX (#1)
- [x] **Mobile text selection is hijacked by the OS menu** — FIXED (`f5ff624`). The ✎ mode used `<Text selectable>` (native OS menu, no save). Replaced with Noetia's own tap-to-select multi-phrase flow + floating "Guardar fragmento" bar (OTA-safe, no native module); logic in `src/lib/fragment-selection.ts` + tests. Verify on-device once the OTA ships.
- [x] **Second highlight color for light mode** — FIXED (`0e88519`): active-phrase highlight is theme-aware (yellow on dark, sky-blue on light). — yellow works well in dark reading mode but is poor for the "clear"/light theme; add a distinct highlight color per theme.

### C. Reader — web/desktop (#1)
- [x] **Desktop: Don Quijote "not available / request failed"** — FIXED (`658c613`). Not an audio bug: Don Quijote Vol I/II are `isFree=false` (culled below the 90% sync gate, 59%/57%), and `SubscriptionGuard` 403's non-free books → the reader showed generic "request failed". Per the product rule (**only offer books that meet the standard — complete, with audio, ≥90% sync; never surface a title that errors**), the fix is to stop *offering* culled titles: (1) `books.service.findAll` quality gate now requires ingested books to have sync ≥ 0.90 (isFree=false is no longer a free pass — only real author uploads `uploadedById` bypass); (2) search defaults to `isFree=true`. Audio objects actually exist fine (Vol I 582 MB, Vol II 607 MB on MinIO). **Prod step:** re-run `seed-search` so the Meilisearch index reflects current `isFree` values (culled titles were likely indexed pre-cull as free; the catalog fix is a live DB query so it's immediate, but search reads the index). See [[feedback_only_offer_standard_books]].
  - *Defensive follow-up (optional):* have the reader show a clean paywall/"not available" message instead of "request failed" if a non-free book is ever reached via a deep link.
- [x] **Library nav bar disappears** — FIXED (`26a8a51`). Root cause: the logged-in app had **no top bar on any tab** (Library/Discover/Profile just rendered a per-page title + the bottom tabs). Added a sticky `AppTopBar` (Noetia wordmark home link + profile + account/settings) to the `(library)` shell so every main tab has consistent top chrome. **Verify on prod after web deploy.**
  - [x] **Clubs nav shell** — FIXED (`cb192c6`). Added a `(clubs)` layout that wraps pages in `AppTopBar` + `BottomNav` via a client `ClubsChrome` wrapper, which excludes the full-screen Escucha Juntos live session (`/sessions/:id/live`) so the chrome can't cover the live UI. **Verify on prod after web deploy.**
- [x] **Font size: 4 sizes** — FIXED (`0e88519`): added `xl` step (sm/md/lg/xl); the +/- control iterates FONT_SIZES. — expand the reader font-size control to 4 steps.
- [x] **Language-aware library ordering** — FIXED (`cc1f645`): browsed library orders the user's-language titles first (search keeps relevance order). — once the user picks a language, show that language's titles first, then other languages.

### D. Sharing — quote-card image generation (#2)
- [x] **Image generator not working correctly (web download)** — FIXED (`5ba541c` + `ecee736`). Root cause: `images/` presigned URLs 403'd behind Traefik (SignatureDoesNotMatch — signed against internal host then string-rewritten), so the download returned a broken file. Now image-gen `storage.py` returns a **permanent public URL** for the public `images/` bucket (no presign), and `ShareModal.handleDownload` fetches it as a blob → forces a real `noetia-<format>.png` file download. **VERIFIED ON PROD 2026-07-12** (Carlos confirmed download works — solid, gradient, and gallery-image backgrounds all generate + download). Also hardened image-gen to **log the real cause on a 500** (`c548138`) — it was a silent bare 500 that made this a long diagnosis. (Confirmed *not* a bug: gallery presets travel as base64 data URIs, so image-gen never fetches a relative URL.)
- [x] **Downloaded image is wrong format for FB/IG upload** — RESOLVED by the download fix above (the "wrong format" was a corrupt/HTML body from the 403, not the image itself). Output is valid PNG at correct per-platform dimensions (IG 1080×1080 / 1080×1920; FB 1200×630 / 1080×1920), verified on prod 2026-07-12. If a platform's native picker specifically rejects PNG, add a JPEG export option (tracked in the mobile EAS-build backlog).
- [x] **Bold / italic missing in image customization** — FIXED for mobile (`3865eec`): added a "Text style" Bold/Italic row to the ShareSheet, threaded `textBold`/`textItalic` via `buildSharePayload` (backend already supported). Web `ShareModal` already had it. (mobile OTA)
- [x] **Text alignment options missing in image customization** — FIXED (`5e6d2ed`). image-gen `textAlign` (left/center/right) param + `_line_x()` helper in `templates/base.py`; wired through `app.py`; web `ShareModal` alignment buttons + live preview. (mobile alignment control still to add with the next ShareSheet pass.)
- [ ] **Quote-card text size must be customizable (added 2026-07-12, from Carlos)** — let the user adjust the quote text size on the card (e.g. S/M/L or a slider). Today the font size is auto-fit per template only. Scope: image-gen `templates/base.py` `render_card` — accept a `textScale`/`fontSize` param and apply it to the quote font sizing (keep auto-fit as the default/bounds so long quotes still fit); thread through `app.py` (`POST /generate`) + api `SharingService`/controller; add the control to web `ShareModal` (with live preview) and the mobile ShareSheet; i18n all 4 files. Sharing #2.
- [x] **Free-image gallery backgrounds fail to download (added 2026-07-12, from Carlos)** — FIXED (`e9ce350`). Confirmed root cause: `ShareModal` inlines the preset (`urlToBase64`) — and user uploads (`fileToBase64`) — as a **base64 data URI** in the `/fragments/:id/share` JSON body; a ~1200px JPEG (~200–300 KB base64) exceeded Express's **default 100 KB JSON limit**, so the api rejected the request and the image couldn't be downloaded (solid/gradient carry no image payload → worked). Fix: `main.ts` now sets `useBodyParser('json'/'urlencoded', { limit: '10mb' })`. Also fixes user-upload backgrounds (same base64 path). **Verify on prod after api deploy.** *Optional follow-up (payload optimization, not required):* stop inlining **presets** as base64 — send a preset reference and have image-gen fetch it internally (`http://web:3000/backgrounds/…` or MinIO `images/backgrounds/presets/`); keep base64 only for genuine uploads.

### E. Content / catalogue (#3, but Bible is a stated priority)
- [x] **No covers for Bible books, and no collection cover** — FIXED (`459b400`). All 34 Bible entries + both collection seeds pointed at a blank Open Library placeholder (1.7KB). Now ES→`/covers/biblia-reina-valera.png`, EN→ new `/covers/bible-kjv.png`. Re-run `seed-covers`/`seed-collections` on prod to apply.
- [x] **"Platero y yo" shows empty** — root cause FIXED (`92d5d54`): Gutenberg 39209 has no working cache/epub or `-0.txt` (only a Latin-1 `-8.txt`), so the fetcher got empty text. Added the `.txt.utf-8` canonical fallback. **Needs a prod re-ingest of Platero** to repopulate.
- [ ] **Reina-Valera / KJV Bible is incomplete — 17 of 66 books** — see canon gap below; complete the canon (49 missing) → catalogue entries + LibriVox audio + Colab batch.

#### Bible canon gap (2026-07-05 audit)

Protestant canon = **66 books** (39 OT + 27 NT). Catalogue has **17 per language** (ES `Biblia Reina-Valera`, EN `Bible`): **5 OT** (Génesis, Éxodo, Salmos, Proverbios, Isaías) + **12 NT** (Mateo, Marcos, Lucas, Juan, Hechos, Romanos, 1 Corintios, Efesios, Filipenses, Hebreos, Santiago, Apocalipsis). **Missing 49** (34 OT + 15 NT):

- **OT missing (34):** Levítico, Números, Deuteronomio, Josué, Jueces, Rut, 1 Samuel, 2 Samuel, 1 Reyes, 2 Reyes, 1 Crónicas, 2 Crónicas, Esdras, Nehemías, Ester, Job, Eclesiastés, Cantares, Jeremías, Lamentaciones, Ezequiel, Daniel, Oseas, Joel, Amós, Abdías, Jonás, Miqueas, Nahúm, Habacuc, Sofonías, Hageo, Zacarías, Malaquías.
- **NT missing (15):** 2 Corintios, Gálatas, Colosenses, 1 Tesalonicenses, 2 Tesalonicenses, 1 Timoteo, 2 Timoteo, Tito, Filemón, 1 Pedro, 2 Pedro, 1 Juan, 2 Juan, 3 Juan, Judas.

**Path to "Colab instructions" (must be built in this order — the batch can't exist until entries do):**
1. **Text sources** — verify each missing book's Wikisource page. ES pattern is `Biblia Reina-Valera 1909/<Book>` with per-chapter subpages the fetcher auto-crawls; but the self-index page is thin (e.g. `/Levítico` renders 544 chars), so each must be confirmed to have real `/N` chapter subpages, not a stub (same disambig/thin-index trap as troubleshooting §5b). EN pattern is `Bible (King James)/<Book>`.
2. **Audio** — find the LibriVox recording per book (Reina-Valera + KJV have full multi-volume projects); capture `librivoxAudioUrl` / `librivoxSearchTitle`.
3. **Catalogue** — add 49 (×2 languages if completing both) entries with the verified text + audio.
4. **Colab batch** — append the new books to `scripts/whisper-colab.ipynb`; then the run + align + `isFree` flow is the standard pipeline.

> Scope note: per CLAUDE.md the free library isn't expanded long-term, **but the Bible is a stated priority** (see memory `project_library_reorganization`). Confirm whether to complete ES only, or ES + EN, before building 49–98 entries.

---

## Backlog — Quote card: flip/mirror background image (added 2026-06-30)

> **Goal:** In the quote-card image generator, let the user horizontally flip (mirror) the **background image** — so a subject/composition can face the other way — for the two image-background sources: (1) a preset from the free **Noetia images collection** (`imagen-1..5`, `services/web/public/backgrounds/`), and (2) an image the user **uploads or captures with the mobile camera**. The quote text/citation must stay upright and readable (only the background is mirrored, not the composited text).

**Scope:**
- [x] **image-gen:** `bgFlip` (bool) param on `POST /generate`; `ImageOps.mirror()` applied to the bg fill in `templates/base.py` before text is composited; no-op when `bgImage` absent. Mirror tests present (`61247d0`).
- [x] **api:** `SharingService.ShareOptions.bgFlip` + controller `@Body('bgFlip')`, forwarded to image-gen only when true. Tests (`7e4167d`).
- [x] **web:** flip toggle in `ShareModal.tsx` preview, shown only when an image background is active (preset or upload/camera); `bgFlip` threaded through `share-utils` + payload; preview mirrors the bg on its own layer so text stays upright. Tests (`7e4167d`).
- [x] **mobile:** flip Switch in the ShareSheet, shown only when a preset image background is selected; `bgFlip` threaded via `buildSharePayload` (`fb3bd4b`). *(Flip on camera/upload images still pending with the native upload picker.)*
- [x] **i18n:** `t.shareCard.flip`/`flipAria` (web en/es) + `sharing.flip`/`flipAria` (mobile en/es) — all 4 files.
- [x] Confirmed: preset **and** upload/camera image sources; quote text remains un-mirrored (separate CSS/render layer).

**Note:** flip applies to raster **image** backgrounds only — solid/gradient backgrounds are unaffected. Priority is Reader/sharing UX (product hierarchy #1–2), above free-library work. **Remaining:** mobile toggle, gated on the mobile image-background picker landing first.

---

## Backlog — Quote card: 18-image Noetia gallery for backgrounds (added 2026-06-30)

> **Goal:** In the quote-card background picker, a user can choose from **18 Noetia-provided gallery images**, in addition to the existing **solid** background and their **own camera/uploaded** images. Today only ~5 presets (`imagen-1..5`) ship — grow the curated set to 18.

**Scope:**
- [x] Produce/curate **18 background images** (Noetia collection) — delivered by user, downscaled to 1200px + optimized JPEG (35MB→3MB), committed to `services/web/public/backgrounds/imagen-1..18.jpg` (945a39a).
- [x] **web:** background picker (`ShareModal.tsx`) shows all 18 alongside **solid** and **upload/camera**; `BG_PRESETS` moved to `lib/share-utils` (exported + unit-tested).
- [x] **mobile:** 18-image preset gallery in the ShareSheet (Default gradient + 18 presets), OTA-safe via preset URLs fetched server-side by image-gen; `src/lib/share-backgrounds.ts` + tests (`fb3bd4b`). **Camera capture / gallery upload deferred** — needs native `expo-image-picker` (full eas build, not OTA).
- [x] Confirm the **flip toggle** works across the 18 presets: web ✅ (`7e4167d`) and mobile ✅ (`fb3bd4b`). Flip on **user upload/camera** images pending with the mobile upload picker (native/eas build).

> **Also delivered alongside this:** the Noetia **logo watermark** (d865b64) — quote cards now stamp the brand logo (light/dark variant by background) instead of plain "Noetia" text.

**Note:** pairs with the flip/mirror feature — both live in the same background picker. Reader/sharing UX (hierarchy #1–2).

---

## Backlog — Next mobile EAS build (quote-card native features, added 2026-07-11)

> Grouped here because each needs a **full `eas build` + store submission** (native modules), not an OTA JS update. Keep active for the next native build cycle. Reader/sharing UX (hierarchy #1–2).

- [ ] **Camera capture / gallery upload for quote-card backgrounds (mobile)** — add `expo-image-picker` so users can pick or shoot their own background image, matching web upload. Blocks the two items below.
- [ ] **Flip/mirror on mobile camera/upload images** — flip already works on the 18 presets; extend `bgFlip` to user-supplied images once the picker lands.
- [ ] **Text alignment control in the mobile ShareSheet** — image-gen `textAlign` param + web control already ship (`5e6d2ed`); add the left/center/right control to the mobile ShareSheet (this one is OTA-safe, but bundle it with the ShareSheet pass above).
- [ ] **JPEG export option (if needed)** — only if a platform's native picker rejects the PNG quote-card on upload; see Sharing §D.

---

## Backlog — App-wide illustrated onboarding tours (added 2026-07-12, from Carlos)

> **Goal:** Friendly, **illustrated** guided tours spanning the whole app that teach a new user how Noetia works — reading, Escucha Activa, fragments/quote cards, library, clubs, sharing, tokens. These are **in addition to** the existing inline text explanations, not a replacement: illustration + short copy, in the warmest, simplest form possible (Voice & Style guide, "tú" form).

**Hard requirements (from Carlos):**
- The **first / primary welcome tour must auto-pop the very first time a new user creates an account and opens a session.** Not on later logins, not on every device refresh — the genuine first session.
- It **remains available until the user themselves either _skips_ or _completes_ it.** If they close the app mid-tour, it comes back next session (resumable) until one of those two terminal states is recorded. No silent permanent dismissal.

**Scope:**
- [ ] **Tour framework** — a reusable illustrated step component (image/animation + copy + Prev/Next/Skip + progress dots), web + mobile, i18n (all 4 files: web+mobile × en/es).
- [ ] **Welcome tour (first-run)** — the primary end-to-end walkthrough that auto-launches on first session after signup.
- [ ] **Per-surface tours** — reader/Escucha Activa, fragments + quote-card creator, library/Mi Biblioteca, Clubes de Lectura, sharing, tokens — launchable on demand and optionally auto-shown the first time each surface is opened.
- [ ] **Illustrations** — commission/produce the tour artwork (consistent Noetia visual language).
- [ ] **State model — the key design decision:** the current `services/web/lib/tutorial-flags.ts` is **localStorage-only** (`welcome`/`fragments`/`audio`/`clubs`), which is per-device and can't reliably detect a true first-account-session or survive a cache clear. The first-run welcome tour needs a **server-persisted per-user flag** (e.g. `users.onboardingState`: `not_started` | `in_progress@step` | `skipped` | `completed`) so it (a) fires exactly once on the first real session, (b) resumes until skipped/completed, and (c) follows the user across devices. Per-surface tours can stay client-side or also move server-side for consistency.

**Notes:** builds on the existing one-off tutorials (`hasSeenAudioTutorial`, welcome/fragments/clubs flags) — extend/unify rather than duplicate. Reader/onboarding UX is hierarchy #1 (new-user activation). Mobile tour changes that add native deps require an EAS build; a pure JS/RN tour is OTA-safe.

---

## Backlog — Keep users signed in on the same device (added 2026-07-12, from Carlos)

> **Report:** the app doesn't remember a returning user on the same device — they have to log in again each session. **Goal:** persistent session per user/device — stay signed in until explicit logout.

**What already exists (so this is mostly client wiring, not new infra):**
- API sets an httpOnly `refresh_token` cookie with `maxAge` **7 days** (`auth.controller.ts` `setRefreshCookie`) and exposes **`POST /auth/refresh`** (access token is short-lived, `JWT_EXPIRES_IN=15m`).
- Mobile has `src/auth/token-storage.ts` (secure/async storage) + `src/api/client.ts`.

**Likely gaps to fix:**
- [x] **Web session refresh race** — FIXED (`78492eb`). The real bug wasn't a missing refresh (apiFetch already refreshed on 401) — it was a **concurrent-refresh race**: on load many requests 401 at once; each called `/auth/refresh` independently, and refresh-token rotation (old deleted, new issued) made every call after the first send an invalidated cookie → 401 → forced logout. Now a single in-flight `/auth/refresh` is shared across callers (`lib/api.ts` `refreshAccessToken`). +concurrency test.
- [x] **Extend the remember window** — FIXED (`78492eb`). 7 → **30 days** on BOTH the cookie `maxAge` (`auth.controller.ts`) and the Redis refresh TTL (`token.service.ts` — the real cap; they must match). Refresh token already rotates on each use.
- [x] **Mobile auto-restore** — FIXED (`c22f146`). Mobile only stored a 15-min access token with **no refresh** (refresh was cookie-only; native apps have no cookie jar), so users were logged out on return. Added a body-based refresh flow: native clients send `X-Client-Type: mobile`, receive the rotating refresh token in the response body (login/register/OAuth), store it (`token-storage`), and the API client **silently refreshes on 401 then retries** (de-duped). Web keeps the httpOnly cookie (token never exposed to JS). On launch, `fetchSubscriptionStatus` now auto-refreshes, restoring the session. +API controller spec, +mobile client/token-storage tests (all green). **OTA-safe** (JS only). **Verify on the installed app after deploy.**
  - **Minor follow-up:** when the refresh token itself is expired/absent (30+ days, or logged out elsewhere), `fetchSubscriptionStatus` swallows the 401 → `'none'` → the launch gate lands on **paywall** instead of **login**. Pre-existing (not caused by this change); route a genuinely-unauthenticated launch to the login screen.
- [ ] Confirm cookie attributes survive prod (SameSite `strict`/secure/domain) — web + api are same-origin (`noetia.app` + `noetia.app/api`) so `strict` should be sent on same-site fetches; **verify on prod** the refresh cookie comes back on a return visit after the deploy.

**Note:** reader/auth is hierarchy #1 (activation + retention). **Verify on prod:** log in, close the tab, return later (past 15 min) — should stay signed in. Mobile auto-restore still to do.

---

## Spike Sprint — Launch Readiness Audit (backlog, added 2026-06-30)

> **Goal:** a time-boxed spike to verify the whole project is launch-ready end to end — exercise the real flows, refresh every doc/report, re-run project-management and risk artifacts (incl. the premortem), and produce a single up-to-date readiness report listing all remaining pending tasks before go-live.

**Why now:** Production is live and feature work has largely landed (Stages 0–5 + clubs/persona/stats). Before promoting launch we need one consolidated pass that confirms nothing critical is stale, untested, or undocumented — and surfaces the true remaining backlog in one place.

### A. End-to-end verification
- [ ] Full E2E run against production: auth (email + Google/Facebook), reader + Escucha Activa sync, fragments, sharing (all 4 platforms), subscriptions/tokens checkout, clubs, mobile offline sync — extend the Playwright suite (`services/web/`) where gaps exist
- [ ] Mobile E2E smoke (iOS + Android): login → paywall → read → sync → share → offline download
- [ ] Cross-check unit/coverage gates still green across all services (api, worker, web, mobile, image-gen ≥ 80%)
- [ ] Re-run load test (k6, 500 VUs) and DRM/access audit against current prod config

### B. Documentation & reports refresh
- [ ] Reconcile CLAUDE.md + PRD.md + sync-procedures.md against actual prod state (migrations count, book counts, sync coverage table, OAuth status)
- [ ] Refresh `docs/business/` PM + technical-architecture docs (EN + ES) to current reality
- [ ] Update incident-response and secrets-rotation docs if anything changed since 2026-06-25

### C. Project management & risk
- [ ] Re-run the **premortem** — review existing assumptions, mark which risks materialized / were mitigated / are still open; capture new risks discovered since
- [ ] Risk register pass: severity × likelihood for each open risk + owner + mitigation status
- [ ] Reconcile backlog: every `[ ]` item across TASKS.md confirmed still-relevant, de-duplicated, and prioritized by the product hierarchy

### D. Deliverable
- [ ] **Launch-Readiness Report** — single up-to-date document: E2E results, coverage/perf numbers, doc-refresh status, premortem outcomes, open risks, and the consolidated remaining-pending-tasks list with a go / no-go recommendation

---

## Summary

| Stage | Name                        | Sprints | Estimated Weeks | Testing overhead |
|-------|-----------------------------|---------|-----------------|------------------|
| 0     | Foundation                  | 1       | 2               | +1.5d (setup)    |
| 1     | Core Platform               | 3       | 6               | +4d (incl. hybrid mode) |
| 2     | Social Layer                | 3       | 6               | +2.5d            |
| 3     | Monetization & Publishers   | 2       | 4               | +1.5d            |
| 4     | Mobile & Offline            | 3       | 6               | included inline  |
| 5     | Launch & QA                 | 2       | 4               | —                |
| **—** | **Total**                   | **14**  | **~30 weeks**   | **+9.5d total**  |

> Estimates assume 1 senior full-stack developer. Unit tests are baked into each backend service task (see Definition of Done above). With a team of 2–3, total calendar time reduces to ~13–17 weeks depending on parallel workstreams.
