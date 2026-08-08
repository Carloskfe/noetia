# 13 — Admin System

Admin is not a separate application — it is a set of `isAdmin`-gated endpoints plus a web dashboard route group.

## Admin authorization — CONFIRMED
- `User.isAdmin` boolean. **No `AdminGuard`**; admin checks are performed **inline** inside controllers (`books`, `personas`, `waitlist`, `codes`). This is decentralized (flagged in [16-security.md](16-security.md)).

## Admin endpoints — CONFIRMED
| Area | Routes |
|------|--------|
| Upload codes | `/admin/codes` — `POST` (mint), `GET` (list) |
| Tokens | `/admin/tokens` — `POST promotional`, `GET/POST courtesy/quotas`, `POST courtesy/issue`, `GET balance/:userId` |
| Personas | `/admin/personas` — `POST recompute` (all), `POST :userId/recompute`, `GET :userId` |
| Waitlist | `/waitlist` — `GET /`, `GET stats`, `POST :id/invite` (admin reads/invites) |
| Catalog | `/books` — `GET pending`, `PATCH :id/publish`, `DELETE :id` (admin-gated) |

## Admin capabilities — CONFIRMED
- **Catalog moderation:** review pending books, publish, delete.
- **Token operations:** grant promotional tokens, manage courtesy quotas, issue courtesy tokens, inspect any user's balance.
- **Persona ops:** trigger persona recomputation (all users or one), inspect a user's computed persona.
- **Growth:** waitlist management + invites, upload-code minting.

## Admin dashboard (web) — CONFIRMED
`services/web/app/(admin)/admin/page.tsx` — real UI (not mocked); includes e.g. invite/code creation (placeholder text is form-hint only). The `(admin)` route group also hosts the author dashboard (`/author`).

## What admin does NOT include — CONFIRMED absence
- No subscription/refund management UI (refunds handled in Stripe dashboard).
- No content-flagging / user-moderation console beyond club-level ban (club moderators/admins can ban members via club endpoints).
- No feature-flag / config console (configuration is via env + migrations).
- No audit log of admin actions (no admin-action audit table found) — **CONFIRMED absence**, flagged as debt.

## Club-level administration — CONFIRMED
Separate from platform admin: club `owner`/`admin`/`moderator` roles (`ClubMember.role`) enforced by `ClubRoleGuard` allow per-club moderation (ban/remove members, manage books/polls/sessions).
