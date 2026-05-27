# Noetia — Project Management Documentation
**Version 1.1 | May 2026**

---

## 1. Project Charter

### Project Information

| Field | Value |
|-------|-------|
| **Project Name** | Noetia — Multimodal Reading Platform |
| **Start Date** | June 2, 2025 |
| **End Date** | May 25, 2026 |
| **Duration** | 12 months |
| **Status** | ✅ Beta launched, App Store submission in progress |

### Project Objectives

1. Design, build, and launch a production-ready multimodal reading platform with language-agnostic architecture — Spanish as the launch market, English from Year 2, multilingual roadmap thereafter
2. Deliver phrase-by-phrase text-audio synchronization across web and mobile
3. Build a monetization engine (subscriptions + tokens) capable of processing real payments via Stripe
4. Launch a social layer (Clubs, fragment sharing, quote card generation) that creates user retention loops
5. Deploy to production infrastructure with CI/CD, monitoring, and automated backups
6. Establish a content and licensing framework covering public domain, author-direct, and publisher pipeline tracks

### Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Production deployment live | noetia.app | ✅ Achieved |
| Unit test coverage | ≥ 80% across all services | ✅ Achieved |
| Stripe payment processing | End-to-end, real transactions | ✅ Achieved |
| Mobile apps buildable | iOS + Android via EAS | ✅ Achieved |
| Database migrations applied | 55 migrations, zero rollbacks | ✅ Achieved |
| Monitoring and alerting | Grafana + Prometheus live | ✅ Achieved |
| CI/CD pipeline | Auto-deploy on push to main | ✅ Achieved |

### Constraints

- **Budget:** Bootstrapped (no external funding). Infrastructure cost < $50/month.
- **Team:** 4 people (PM, Backend, Frontend, DevOps) — no additional contractors.
- **Timeline:** Hard deadline of 12 months for beta-ready product.
- **Technology:** Must support offline use on mobile, real-time club features, and automated deployments.

---

## 2. Team Roles & Responsibilities

### Product Manager (PM)
**Core responsibilities:**
- Define and maintain the product roadmap
- Write user stories and acceptance criteria for each sprint
- Run all Scrum ceremonies (planning, review, retrospective, daily standup)
- Manage the product backlog (priority ordering, estimation facilitation)
- Communicate progress to stakeholders
- Define and track KPIs
- Make product decisions on UX, feature scope, and technical trade-offs

**Key decisions made:**
- Chose Audible-style token model over pure subscription (enables per-title pricing without limiting free catalog)
- Prioritized Clubs feature in Q4 despite scope risk — correctly identified it as the primary retention driver
- Kept reading statistics as a Duolingo-inspired engagement loop (streak + weekly goals)
- Defined the 3-priority hierarchy: Reader experience > Author experience > Free library
- Chose language-agnostic architecture over Spanish-only from the start — i18n (EN/ES) shipped in Q4; English catalog and audience are Year 2, not Year 3
- Chose soft DRM (account binding + signed URLs) over full Widevine/FairPlay — sufficient at current catalog scale, avoids certification overhead before publisher deals are signed
- Chose author-direct model for Year 1 catalog (non-exclusive, self-certified, 45% royalty) while pursuing publisher outreach in parallel rather than waiting for publisher deals before launching paid content

---

### Backend Developer
**Core responsibilities:**
- Architect and implement the NestJS API (REST endpoints, middleware, guards)
- Design PostgreSQL schema and write all TypeORM migrations
- Implement authentication (JWT, Google, Facebook, Apple OAuth)
- Integrate Stripe (plans, webhooks, checkouts, subscriptions, tokens, gift cards)
- Build the reading statistics heartbeat system and streak calculation
- Implement Clubs backend (7 tables: clubs, members, books, messages, discussions, polls, sessions)
- Write unit tests for all services (≥ 80% coverage)

**Stack owned:** NestJS, TypeORM, PostgreSQL, Redis, Stripe SDK, Nodemailer, Meilisearch

---

### Frontend Developer
**Core responsibilities:**
- Build the Next.js web application (reader, library, fragments, sharing, profile, billing)
- Build the React Native mobile app (iOS + Android) with full feature parity
- Implement phrase-by-phrase synchronization UI (active phrase highlight, auto-scroll)
- Build the quote card share modal (4 platforms × multiple formats)
- Implement i18n system (Spanish/English) across web and mobile with API sync
- Integrate Expo EAS for mobile builds and OTA updates
- Write unit tests for all frontend components and hooks

**Stack owned:** Next.js 14, React Native (Expo SDK 51), Tailwind CSS, React Navigation, Zustand, AsyncStorage

---

### DevOps Engineer
**Core responsibilities:**
- Provision and harden the production server (Contabo VPS, Ubuntu 24.04)
- Configure Traefik v2.11 as reverse proxy with automatic Let's Encrypt SSL
- Write and maintain all Docker Compose configurations (dev, prod overlay, server)
- Build the GitHub Actions CI/CD pipeline (test → build → deploy → migrate)
- Configure Grafana + Prometheus monitoring (API latency, error rate, container health)
- Set up automated database backups (PostgreSQL daily, MinIO weekly)
- Manage server security (UFW firewall, fail2ban, non-standard SSH port 222)
- Configure MinIO buckets (private books/audio, public images) and bucket policies

**Stack owned:** Docker, Docker Compose, Traefik, GitHub Actions, Grafana, Prometheus, PostgreSQL cron, MinIO

---

## 3. Project Methodology

**Framework:** Scrum with 2-week sprints
**Sprint duration:** 14 days
**Total sprints:** 24 sprints over 12 months
**Sprint cadence:** Monday start, Friday end (with review/retro on the last Friday)

### Ceremonies

| Ceremony | Frequency | Duration | Participants |
|----------|-----------|----------|-------------|
| Daily Standup | Every weekday | 15 min | All 4 |
| Sprint Planning | Every 2 weeks (Monday) | 2 hours | All 4 |
| Sprint Review | Every 2 weeks (Friday) | 1 hour | All 4 |
| Sprint Retrospective | Every 2 weeks (Friday) | 45 min | All 4 |
| Backlog Refinement | Weekly (Wednesday) | 1 hour | PM + relevant dev |
| Architecture Review | Monthly | 2 hours | Backend + DevOps + PM |

### Tools

| Tool | Purpose |
|------|---------|
| GitHub Projects | Kanban board, issue tracking, sprint backlog |
| GitHub | Code repository, PR reviews, CI/CD |
| Slack | Daily communication, standup threads, incident alerts |
| Figma | UI design, wireframes, component specs |
| Notion | Project wiki, meeting notes, retrospective logs |
| Loom | Async video updates for PM → stakeholder comms |

### Definition of Done (DoD)

A story is **done** when:
- [ ] Feature is implemented and working as specified in the acceptance criteria
- [ ] Unit tests exist at the mirrored path under `tests/unit/`
- [ ] Tests cover happy path, edge cases, and error scenarios
- [ ] All tests pass (`npm test` / `pytest`)
- [ ] Coverage for the modified service is ≥ 80%
- [ ] Code has been reviewed and approved by at least one other team member
- [ ] No new lint errors or TypeScript errors introduced
- [ ] Feature is deployed to production (via CI/CD auto-deploy on merge to main)
- [ ] PM has verified the feature against acceptance criteria

---

## 4. Sprint History & Milestones

### Q1: Foundation (Sprints 1–6 | Jun–Aug 2025)

**Sprint 1–2 (Jun 2–27)**
*Goal: Project scaffolding and developer environment*
- Monorepo structure, Docker Compose (all 7 services), .env.example
- PostgreSQL init.sql, Redis config, MinIO bucket setup
- NestJS project init, TypeORM config, first migration (CreateUsersTable)
- Jest and pytest configuration across all services (80% coverage gates)
- GitHub Actions: lint + test + build CI on PRs

**Sprint 3–4 (Jun 30–Jul 25)**
*Goal: Authentication system*
- Email + password auth (register, login, JWT access + refresh tokens)
- Email confirmation on registration (24h token via Resend SMTP)
- Password recovery via reset link
- Google OAuth, Facebook OAuth, Apple Sign-In
- Auth guards, logout, protected route wrapper (web)

**Sprint 5–6 (Jul 28–Aug 22)**
*Goal: Books and reader foundation*
- Books table, CRUD endpoints, MinIO upload for text and audio
- Audio streaming endpoint (range requests)
- Phrase-level sync map design and storage
- Reading progress endpoint (save/restore by phrase index)
- Library page (book grid), book detail page
- Reader layout: text + audio controls, phrase rendering

**Q1 Milestone: Working reader prototype** ✅

---

### Q2: Core Platform (Sprints 7–12 | Sep–Nov 2025)

**Sprint 7–8 (Aug 25–Sep 19)**
*Goal: Full reading engine*
- Phrase highlight: audio time → active phrase synchronization
- Click phrase → seek audio
- Seamless mode switches (reading ↔ listening ↔ active listening)
- Active listening mode (audio + text + live highlight)
- Font size controls, dark mode, chapter navigation
- Reading preferences (localStorage persistence)

**Sprint 9–10 (Sep 22–Oct 17)**
*Goal: Fragment & sharing system*
- Fragment CRUD, Fragment Sheet panel
- Text selection handler (mouse + touch)
- Quote card image generation service (Python Flask + Pillow)
- BullMQ worker for async image rendering
- LinkedIn, Instagram, Facebook, Pinterest templates

**Sprint 11–12 (Oct 20–Nov 14)**
*Goal: Monetization foundation*
- Stripe integration: customer creation, Checkout sessions
- Subscription plans (Individual, Duo, Family — monthly + annual)
- Stripe webhooks: activate/cancel subscriptions, issue tokens on invoice.paid
- Token system: creditBalance, redemption, 90-day expiry
- Book purchases and access guard
- Pricing page, billing management UI

**Q2 Milestone: Monetization live, first test payments processed** ✅

---

### Q3: Mobile & Social (Sprints 13–18 | Dec 2025–Feb 2026)

**Sprint 13–14 (Nov 17–Dec 12)**
*Goal: React Native app shell*
- Expo SDK 51 project init, EAS project configuration
- Auth screens: login, register, social login (iOS + Android)
- Bottom tab navigation, library screen, book detail
- Reader screen: text + phrase sync on mobile
- google-services.json, Firebase setup for FCM

**Sprint 15–16 (Dec 15–Jan 9)**
*Goal: Mobile features*
- Mobile fragment capture and Fragment Sheet
- Mobile paywall enforcement (subscription check on every login)
- Offline book download (phrases cached to AsyncStorage)
- Auto-sync on reconnect (NetInfo offline→online hook)
- Push notifications (Expo Notifications, APNs + FCM)
- Mobile audio player (Expo AV, background mode, speed control)

**Sprint 17–18 (Jan 12–Feb 6)**
*Goal: Author portal + social sharing*
- Author/publisher registration and dashboard
- Book upload endpoint (text + audio + metadata + cover)
- Hosting tier enforcement (Basic: 1, Starter: 3, Pro: 12 books)
- Social OAuth account linking (LinkedIn, Facebook, Instagram, Pinterest)
- Direct publish from app to social platforms
- ShareModal: platform selector, format picker, hex picker, gradient directions

**Q3 Milestone: iOS and Android builds running on physical devices** ✅

---

### Q4: Clubs, i18n, Stats & Launch (Sprints 19–24 | Mar–May 2026)

**Sprint 19–20 (Feb 9–Mar 6)**
*Goal: Noetia Clubs — backend*
- 7 migrations: clubs, club_members, club_books, club_messages, club_discussions, club_polls+votes, club_sessions
- Club CRUD (create, join, leave, settings, ban)
- Phrase-anchored discussions tied to sync map phraseIndex
- Club polls for book nominations
- Escucha Juntos: scheduled live listening sessions
- Club invitation link system

**Sprint 21–22 (Mar 9–Apr 3)**
*Goal: Clubs UI + i18n*
- Clubs discovery page, club page (4 tabs: Chat, Discussion, Polls, Sessions)
- Clubs Tutorial bottom sheet, WelcomeSplash entry point
- Full Spanish/English i18n across web and mobile
  - Language selection on first launch
  - All 8 email templates bilingual (EN/ES)
  - ReaderTopBar, BottomNav, all 5 tutorials fully i18n
  - LanguageProvider syncs language to/from API on mount

**Sprint 23–24 (Apr 6–May 25)**
*Goal: Stats, privacy, QA, launch prep*
- Reading statistics system (heartbeat, 7-day bar chart, streak, goals)
- Privacy settings (4 toggles with optimistic updates)
- Profile page tabs (Profile / Stats / Privacy)
- Grafana monitoring fixed (Tailscale access, false-positive alert fixes)
- CD pipeline hardened (concurrency groups, dynamic container cleanup)
- EAS build configuration (production profiles, autoIncrement, OTA channels)
- 55 migrations applied to production, beta launch

**Q4 Milestone: Beta launched at https://noetia.app** ✅

---

## 5. Key Project Metrics

### Velocity (story points per sprint, average)

| Quarter | Avg Velocity | Notes |
|---------|-------------|-------|
| Q1 (Sprints 1–6) | 28 SP | Ramp-up; infrastructure-heavy |
| Q2 (Sprints 7–12) | 38 SP | Full cadence; complex features |
| Q3 (Sprints 13–18) | 42 SP | Peak velocity; mobile parallelism |
| Q4 (Sprints 19–24) | 35 SP | Clubs complexity; QA overhead |

### Deliverable Counts

| Artifact | Count |
|----------|-------|
| Database migrations | 55 |
| API endpoints | ~85 |
| Unit test files | 35+ |
| React components (web) | 40+ |
| React Native screens | 12 |
| i18n translation keys | ~400 |
| Docker services | 9 |

---

## 6. Risk Register

| Risk | Status | Resolution |
|------|--------|-----------|
| Phrase-sync complexity underestimated | Mitigated | Allocated extra Sprint 7–8 buffer |
| Stripe webhook reliability | Mitigated | Idempotency keys on all webhook handlers |
| Mobile offline-sync edge cases | Mitigated | NetInfo + retry queue implemented |
| Docker cache causing stale migrations | Hit | Added --no-cache build step; documented in runbook |
| SSH terminal corruption on server (multi-line paste) | Hit | Established nano/base64 protocol; added to CLAUDE.md |
| Grafana 404 after server restart | Hit | Cookie injection workaround; Tailscale access configured |
| Apple Sign-In differences iOS/Android | Mitigated | expo-apple-authentication handles natively |

---

## 7. Retrospective Highlights

### What went well
- **Mono-repo structure with Docker Compose** made cross-service changes fast and consistent
- **CI/CD from Sprint 1** meant every merge was deployable — no "integration week" at the end
- **80% test coverage gate** caught multiple regressions that would have shipped to production
- **Migration-first database changes** meant zero schema drift between environments
- **TypeScript everywhere** (API + web + mobile) reduced cross-layer bugs dramatically

### What could be improved
- Clubs scope was larger than estimated — should have been split into two phases with a separate "Clubs v2" backlog
- i18n should have been designed into the UI from Sprint 1, not retrofitted in Q4
- Mobile development started in Q3; earlier mobile consideration would have influenced API design
- DevOps should have configured Grafana alerting tuning earlier to avoid false positives

### Process improvements implemented
- Added architecture review meeting after the Clubs backend surfaced 7 interdependent migrations
- Introduced async Loom standup option to reduce meeting fatigue in Q4
- Created CLAUDE.md as a living developer guide — became the team's primary onboarding document

---

---

## 8. Post-Launch Roadmap

The 12-month build phase ended with beta launch in May 2026. The following phases govern post-launch product and business development.

### Phase 1 — Beta (May–Aug 2026)

**Goal:** Validate product-market fit, collect churn data, onboard first authors.

| Track | Actions |
|-------|---------|
| Product | Monitor reading session length, streak retention, club engagement — identify drop-off points |
| Growth | Activate 500-user waitlist via invite codes; onboard 5–10 authors |
| Content | Maintain 38+ Spanish public-domain titles; begin English public-domain ingestion |
| Licensing | Draft Author Agreement template; establish self-certification upload flow |
| Metrics | Baseline NPS, D1/D7/D30 retention, churn rate, conversion from free to paid |

**Success exit criteria:** ≥ 200 paying subscribers, ≥ 3 active authors, churn ≤ 7%/month.

---

### Phase 2 — Growth (Sep 2026–Feb 2027)

**Goal:** App Store launch, English catalog, scale to 2,000 subscribers.

| Track | Actions |
|-------|---------|
| Product | App Store + Google Play launch; English public-domain catalog live; onboarding flow A/B tests |
| Growth | TikTok/Instagram content strategy; referral program (3 friends → 1 token); author partnership program (10 Spanish + 5 English authors) |
| Content | English public-domain catalog: 40+ titles via Gutenberg + LibriVox pipeline |
| Licensing | Begin publisher outreach (first formal meetings Q4 2026); retain IP attorney for Publisher License Agreement |
| Metrics | MRR, ARR, blended CAC by channel, author count, paying titles count |

**Success exit criteria:** 2,000 paying subscribers, 25 active authors, 75+ paid titles, App Store rating ≥ 4.5.

---

### Phase 3 — Scale (Mar 2027+)

**Goal:** Publisher catalog deals, B2B channel, Portuguese market entry.

| Track | Actions |
|-------|---------|
| Product | Full DRM capability (Widevine/FairPlay) — required before major publisher deals |
| Growth | Podcast/newsletter sponsorships; corporate wellness B2B; university licensing |
| Content | First publisher catalog deals (Spanish + English); 250+ paid titles |
| Licensing | Signed Publisher License Agreements; per-territory rights negotiation |
| Expansion | Portuguese-language market entry (Brazil); localized UI and catalog |

---

## 9. Content & Licensing Governance

### Content Decision Authority

| Decision | Owner | Approval Required |
|----------|-------|------------------|
| Add public-domain title | Backend Dev | None — follows ingestion script |
| Invite new author | PM | PM sign-off on author criteria |
| Remove author title (DMCA) | PM + Backend | Immediate removal; document incident |
| Sign publisher deal | PM | Legal review + founder approval |
| Change royalty split | PM | Founder approval |
| Enable full DRM | PM + Backend + DevOps | Founder approval |

### Author Onboarding Process

1. Author applies → PM reviews against criteria (1K+ audience, eligible category)
2. PM issues upload code → author receives onboarding email with Author Agreement
3. Author self-certifies rights ownership at upload
4. Backend dev reviews upload for completeness (audio sync-ready, metadata, cover)
5. Title goes live → author gains access to author dashboard (earnings, fragments, reader stats)

### Content Removal Process

1. DMCA complaint or rights dispute received → title immediately taken offline (< 4 hours)
2. PM notifies author within 24 hours
3. If dispute resolved: title restored; if not: title permanently removed
4. All removals documented in Risk Register (Section 6)

### Publisher Deal Criteria (Year 2+)

Before signing any publisher agreement:
- [ ] IP attorney has reviewed and approved the Publisher License Agreement template
- [ ] Publisher has confirmed ownership of both text AND audiobook/digital rights for each title
- [ ] Revenue split agreed: 50% publisher (inclusive of author share) / 50% Noetia
- [ ] Territory scope defined in the agreement
- [ ] DRM requirements confirmed — upgrade to Widevine/FairPlay if required before signing

---

## 10. Post-Launch KPIs

### Growth KPIs

| KPI | Target (Month 3) | Target (Month 12) | Notes |
|-----|-----------------|------------------|-------|
| Paying subscribers | 200 | 2,000 | Primary growth metric |
| Monthly churn | ≤ 7% | ≤ 5% | Should decline as clubs deepen engagement |
| MRR | $2,040 | $20,400 | Based on blended ARPU $10.20 |
| Blended CAC | — | $15–25 | Track by channel; organic dominant in Year 1 |
| LTV:CAC ratio | — | ≥ 7:1 | Validate against real retention data |

### Content KPIs

| KPI | Target (Month 6) | Target (Month 12) | Notes |
|-----|-----------------|------------------|-------|
| Active authors | 10 | 50 | Quality over quantity |
| Paid titles live | 20 | 75+ | Spanish + English combined |
| English public-domain titles | 20 | 40+ | Gutenberg + LibriVox pipeline |
| Token attach rate | — | 15% | % of subscribers buying ≥1 token package/year |

### Engagement KPIs

| KPI | Target | Notes |
|-----|--------|-------|
| D1 retention | ≥ 60% | % of new users who read again on Day 1 |
| D7 retention | ≥ 35% | Measures habit formation in first week |
| D30 retention | ≥ 25% | Measures product stickiness |
| Avg reading session | ≥ 15 min | Tracked via heartbeat system |
| Active streak holders | ≥ 40% | % of MAU with a streak ≥ 3 days |
| Clubs with ≥ 5 members | ≥ 10 | Indicator of community health |

### Licensing KPIs

| KPI | Target (Month 12) | Notes |
|-----|------------------|-------|
| Author Agreements signed | 50 | Formal non-exclusive license on file |
| Publisher conversations active | 3+ | Formal outreach initiated |
| Publisher deals signed | 1 (stretch) | First deal targeted Q4 2026 |
| IP attorney retained | Month 6 | Before any publisher negotiation |
| DMCA incidents | 0 | Track in Risk Register if any occur |

---

*Document maintained by the Product Manager. Last updated: May 26, 2026.*
