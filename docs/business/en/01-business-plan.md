# Noetia — Business Plan
**Version 1.0 | May 2026**

---

## Executive Summary

Noetia is a multimodal reading platform that synchronizes text and audio phrase by phrase, enabling readers to read and listen at the same time. Built for Spanish-speaking audiences, Noetia combines the immersive depth of a reader app with the habit-forming mechanics of social learning platforms — allowing users to save fragments, generate visual quote cards, share to social networks, and read together in real-time clubs.

Noetia launched its beta in May 2026 following 12 months of development by a 4-person team. The platform is live at **https://noetia.app**, runs on production infrastructure, and is preparing for App Store and Google Play submission.

**Business model:** Subscription (Individual $8.99/mo · Duo $13.99/mo · Family $18.99/mo) plus per-title token purchases and social giving (2.22% of every payment supports partner social causes).

**Target market:** 500M Spanish speakers globally; 30M+ digital readers in Latin America willing to pay for premium reading experiences.

**12-month revenue target (post-launch Year 1):** $165,000 total revenue, reaching 2,000 paying subscribers by May 2027.

---

## The Problem

Reading and audiobook consumption in Spanish is underserved relative to the size of the market. Spanish is the second most spoken native language in the world, yet the dominant reading platforms (Audible, Blinkist, Storytel) were built for English-first audiences and offer thin Spanish catalogs with poor cultural fit.

Readers who want to engage deeply with Spanish-language books face three compounding problems:

1. **Fragmented consumption** — text and audio exist on separate apps, breaking focus and continuity.
2. **Passive reading** — existing platforms don't help readers retain or share what they learn.
3. **Social isolation** — reading is treated as a solitary activity with no community or accountability layer.

---

## The Solution

Noetia solves all three:

| Problem | Noetia Solution |
|---------|----------------|
| Fragmented text + audio | Phrase-by-phrase synchronization — audio and text move together, phrase highlighted in real time |
| Passive reading | Fragment capture → visual quote cards → share to LinkedIn, Instagram, Facebook, Pinterest |
| Reading in isolation | Noetia Clubs — phrase-anchored discussion threads, live listening sessions (Escucha Juntos), book polls |

Additional differentiators:
- **Reading statistics** — 7-day activity chart, streak counter, weekly goals — habit loops proven by Duolingo's engagement model
- **Privacy controls** — granular settings for what is shared in clubs
- **Causes Noetia** — 2.22% of every payment routes to vetted social causes (Medio Ambiente, Educación, Salud), turning every subscription into a social contribution

---

## Product Overview

### Core Features (shipped)

**Reader**
- Phrase-synchronized text + audio (read mode, audio mode, active listening mode)
- Offline book download and sync
- Font size, dark mode, chapter navigation
- Reading progress saved and restored across devices

**Fragments & Sharing**
- Long-press phrase selection to save fragments
- Quote card image generation (4 platforms × multiple formats and sizes)
- Direct publish to LinkedIn, Facebook, Instagram, Pinterest via OAuth
- Deep link sharing

**Library & Discovery**
- 38+ curated free public-domain titles (Spanish) at launch
- Author-uploaded paid titles (token gated)
- Collection grouping, search (Meilisearch full-text)

**Noetia Clubs**
- Public / private / author-event club types
- Phrase-anchored discussion threads
- General club chat
- Book nomination polls
- Escucha Juntos — scheduled live listening sessions
- Member roles (admin / moderator / member), ban mechanics

**Monetization**
- 3 subscription tiers (Individual / Duo / Family) with monthly and annual billing
- Token system (1 token = 1 paid book) — 90-day expiry, FIFO redemption
- Token packages (1, 3, 5, 10 tokens) purchased à la carte
- Gift cards with personal message and occasion
- Causes Noetia — 2.22% social giving on every payment

**Platforms**
- Web (Next.js — desktop + mobile browser)
- iOS (React Native via Expo)
- Android (React Native via Expo)

---

## Market Analysis

### Total Addressable Market (TAM)
The global audiobook market is projected to reach **$35 billion by 2030** (Grand View Research, 2024). Spanish-language digital reading is a structurally underserved segment within this. The ~500M native Spanish speakers represent roughly 6.5% of the global population but receive a fraction of premium reading content investment.

### Serviceable Addressable Market (SAM)
Latin America had **~130M internet users** who read digital content regularly in 2025. The paid digital reading segment (users who pay for books, subscriptions, or audiobooks) is estimated at **8–12M users across the region**, growing at ~18% annually.

### Serviceable Obtainable Market (SOM)
**Year 1 target:** 2,000 paying subscribers (0.025% of SAM)
**Year 3 target:** 15,000 paying subscribers (0.15% of SAM)

These targets are conservative and reachable through organic content marketing, author partnerships, and social sharing virality.

### Market Trends
- Audiobook consumption in Spanish-speaking markets grew 34% in 2024 (Statista)
- Social reading (book clubs, discussion apps) is the fastest-growing book discovery channel
- Short-form video (TikTok/Instagram Reels) is the primary book discovery platform for under-35 audiences — Noetia's visual quote card sharing plugs directly into this behavior
- Remote-work culture in Latin America has increased daily reading time (+22% since 2022, Bain & Company)

---

## Competitive Landscape

| Competitor | Strengths | Weaknesses vs. Noetia |
|-----------|-----------|----------------------|
| Audible (Amazon) | Huge catalog, global brand | English-first, no text sync, no social layer, no Spanish community |
| Storytel | Strong Scandinavian catalog | Limited Spanish content, no phrase sync, no sharing |
| Blinkist | Summary-focused, strong UX | Summaries only (no full books), English-first |
| 12min | Spanish-language summaries | Summaries only, no audio sync, no community |
| Kindle | Best-in-class e-reader | No audio sync, weak social features, separate from Audible |
| Wattpad | Strong community | Fiction-only, user-generated, no curated catalog |

**Noetia's defensible differentiators:**
1. Phrase-by-phrase audio-text sync (technical moat — significant implementation complexity)
2. Native Spanish-language focus with cultural product design
3. Social causes integration (emotional stickiness — readers feel their subscription matters)
4. Visual quote card generation for social sharing (virality engine)

---

## Business Model

### Revenue Streams

**1. Subscriptions (recurring MRR)**
| Plan | Monthly | Annual | Users |
|------|---------|--------|-------|
| Individual | $8.99 | $89.99 | 1 user, 1 token/cycle |
| Duo | $13.99 | $139.99 | 2 users, shared pool |
| Family | $18.99 | $189.99 | 5 users, shared pool |

**2. Token Packages (one-time)**
| Package | Price | Per Token |
|---------|-------|-----------|
| 1 token | $3.99 | $3.99 |
| 3 tokens | $9.99 | $3.33 |
| 5 tokens | $14.99 | $3.00 |
| 10 tokens | $29.99 | $3.00 |

**3. Gift Cards** — token gifts with personal message (1 or 3 tokens), sent by email

**4. Author Hosting Fees** — future revenue from hosting-tier upgrades (Basic: 1 book, Starter: 3 books, Pro: 12 books)

### Revenue Distribution Per Payment
- **45%** → Noetia operating revenue
- **36%** → Author / narrator royalties
- **9%** → Narrator fee (when separate from author)
- **2.22%** → Causas Noetia (social giving)
- **7.78%** → Marketing fund

### Unit Economics (Individual Plan, monthly)
- ARPU: $8.99
- Estimated churn: 5%/month (industry avg for niche reading apps: 4–7%)
- LTV (at 5% churn = 20-month avg tenure): **$179.80**
- Customer Acquisition Cost (Year 1, organic-first): **estimated $15–25**
- LTV:CAC ratio: **7:1 – 12:1**

---

## Go-to-Market Strategy

### Phase 1 — Beta Launch (May–Aug 2026)
- 500 beta users via waitlist (already collecting)
- Invite-only with upload codes for early authors
- Focus: product-market fit validation, churn analysis, NPS
- Channels: founder's network, LinkedIn content, author outreach

### Phase 2 — Growth (Sep 2026–Feb 2027)
- App Store and Google Play launch
- TikTok/Instagram content strategy: "best quotes from [book]" using Noetia share cards (virality loop)
- Author partnership program: 10 Spanish-language authors with existing audiences
- Book club partnerships: university literary circles, reading communities on WhatsApp/Discord
- Referral program: invite 3 friends → 1 free token

### Phase 3 — Scale (Mar 2027+)
- English-language catalog launch (same tech, new market)
- Podcast/newsletter sponsorships targeting productivity and self-development audiences
- B2B: corporate wellness programs (reading as a benefit), university licensing

---

## Team

The founding team combines product vision with technical execution across the full stack.

| Role | Responsibilities |
|------|-----------------|
| **Product Manager** | Roadmap, sprint planning, stakeholder management, user research, KPIs, go-to-market |
| **Backend Developer** | NestJS API, PostgreSQL schema, Stripe, auth, subscriptions, clubs, migrations |
| **Frontend Developer** | Next.js web app, React Native mobile (iOS + Android), i18n, UI components |
| **DevOps Engineer** | Docker infrastructure, Traefik, GitHub Actions CI/CD, Grafana monitoring, backups, server security |

12 months of development. 55 database migrations. Zero external contractors. Full ownership of the technology stack.

---

## Financial Projections

### Assumptions
- Beta launch: May 2026
- App Store launch: Q3 2026
- Average plan: 70% Individual, 20% Duo, 10% Family → blended ARPU ≈ $10.20/mo
- Monthly churn: 5% (conservative; declining as product matures)
- Token purchase attach rate: 15% of subscribers buy at least 1 token package per year

### Revenue Projections

| Period | Subscribers | MRR | ARR |
|--------|------------|-----|-----|
| Aug 2026 (3mo post-launch) | 200 | $2,040 | $24,480 |
| Nov 2026 (6mo) | 600 | $6,120 | $73,440 |
| Feb 2027 (9mo) | 1,200 | $12,240 | $146,880 |
| May 2027 (12mo) | 2,000 | $20,400 | $244,800 |
| May 2028 (24mo) | 6,000 | $61,200 | $734,400 |
| May 2029 (36mo) | 15,000 | $153,000 | $1,836,000 |

*Plus token package revenue and author hosting fees add ~12% on top of subscription ARR from Year 2.*

### Cost Structure (current)
| Item | Monthly Cost |
|------|-------------|
| Contabo VPS (8 vCPU, 24 GB RAM, 400 GB SSD) | ~$25 |
| Resend (email, free tier) | $0 |
| Expo EAS Build | $0–$29 |
| Stripe fees (~2.9% + $0.30) | Variable |
| Domain / DNS (Cloudflare) | ~$12/yr |
| **Total fixed infrastructure** | **< $50/mo** |

Infrastructure cost is negligible at current scale. The primary cost to scale is human capital (customer support, content licensing, marketing).

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Low initial author catalog | High | High | 38 free public-domain titles provide full beta experience; author program launching |
| App store rejection | Medium | Medium | Privacy policy live, permissions declared, no objectionable content |
| Stripe disputes / chargebacks | Low | Medium | No refund policy on tokens (declared at checkout); strong auth |
| Server outage | Low | High | Daily PostgreSQL backups, MinIO backups, Grafana alerts, 99.9% uptime history |
| Competitor copies phrase-sync | Medium | Medium | Technical moat is deep; Spanish cultural focus and community are harder to replicate |
| Churn higher than projected | Medium | High | Reading streak gamification, clubs, and goal system are designed to fight churn |

---

*Noetia — Read. Listen. Capture. Share.*
*https://noetia.app | noreply@noetia.app*
