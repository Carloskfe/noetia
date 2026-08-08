# 15 — Privacy

Noetia+ processes **intellectual-behavior data** (what you read, highlight, ask, think) — the most sensitive data the platform holds. Design for privacy-by-default.

## Principles
- **Private by default.** Conversations, messages, knowledge assets, resurfacing queues, and private-note embeddings are **user-scoped** and never visible to anyone else (including admins, except via audited abuse investigation — [37]).
- **Deletion is first-class.** Conversation deletion, AI-history deletion, and knowledge-asset deletion are user actions (soft-delete → purge job, including derived embeddings of private content). Extends the existing account-deletion (`DELETE /users/me`) to cascade Noetia+ data.
- **Opt-outs.** Reuse/extend the existing privacy toggles (`allowInsights`, `share*`) with Noetia+-specific opt-outs (e.g. "don't use my highlights for resurfacing", "don't retain AI history"). The persona pipeline already honors `allowInsights` — Noetia+ honors it too.

## Duo/Family isolation (hard requirement)
Shared **book-token pools do NOT imply shared knowledge data.** Members MUST NOT see each other's:
- library, highlights, notes, AI conversations, knowledge assets, or intellectual profile.

Enforcement: every Noetia+ query is keyed by the **individual `userId`**, never the subscription/pool. `linkedUserIds` governs *billing/entitlement*, never *data visibility*. Retrieval scope for a Family member = that member's own `user_books` + own fragments — never a sibling's. (Recommended default: Noetia+ entitlement is per-member — [08](08-entitlements-and-subscription.md).)

## Caching & leakage prevention
- **Book-level reusable computation** (chunk embeddings, public-domain common answers) is shared safely — it is content-derived, not user-derived.
- **User-private computation** (answers over private notes, personal library synthesis, resurfacing) is cached **per-user only**; cache keys include `userId`. No cross-user cache path exists ([22 caching]).

## Provider data handling
- Content sent to external providers is the minimum needed; **provider data-retention / no-training** posture is required (align provider config to no-retention/no-training where offered). Whether/which provider trains on data is an **OPEN DECISION** ([20](20-open-product-decisions.md)) with a **strong default: no provider training on user or licensed content.**
- Publisher licensed content follows §11 permissions; **training default OFF**.

## Post-cancellation
User's own AI history/assets: recommended **retain read-only + export**, re-enable on resubscribe; hard-delete on account deletion. Exact retention is an [OPEN DECISION](20-open-product-decisions.md).

## Regulatory
GDPR-style rights (access, deletion, portability/export) are supported by the deletion + export design. Data-processing disclosures extend the existing legal surfaces (`lib/legal/*`, cookie/consent). Not implemented here.
