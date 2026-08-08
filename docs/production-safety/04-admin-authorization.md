# 04 — Admin Route Authorization Inventory

**Status: CONFIRMED — all admin routes are authenticated and authorization-checked, EXCEPT `admin/tokens`, which uses a broken check that fails CLOSED (deny-all).**

## Authorization model — CONFIRMED
- `req.user` is the **full `User` entity** (`jwt.strategy.validate` loads it via `usersService.findById`), so both `isAdmin` (boolean) and `userType` (`personal|author|editorial|null`) are available on every guarded request.
- There is **no `AdminGuard`** — admin authorization is an **inline check per route** (the systemic risk flagged in NEM-001 H2). NEM-002 verified whether each one is actually present and correct.

## Inventory — CONFIRMED

| Controller / route | Admin-sensitive | Check found | Correct? |
|--------------------|-----------------|-------------|----------|
| `books` `GET /pending` | yes | `if (!req.user.isAdmin) throw Forbidden` | ✅ |
| `books` `PATCH /:id/publish` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `books` `DELETE /:id` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `books` `POST /:id/sync-map` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `books` `POST /:id/sync-map/srt` | admin **or owner** | `if (!isAdmin && !isOwner) …` | ✅ |
| `books` `POST /` (upload) | role-gated | `isAdmin \|\| author \|\| editorial` (+ quota/code) | ✅ |
| `personas` `POST /recompute` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `personas` `POST /:userId/recompute` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `personas` `GET /:userId` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `codes` `POST /` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `codes` `GET /` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `waitlist` `GET /` (list) | yes | `if (!req.user.isAdmin) …` | ✅ |
| `waitlist` `GET /stats` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `waitlist` `POST /:id/invite` | yes | `if (!req.user.isAdmin) …` | ✅ |
| `waitlist` `POST /` (join) | public by design | (none — intended) | ✅ |
| **`admin/tokens` `POST /promotional`** | yes | `assertAdmin` → `userType !== 'admin'` | ❌ **broken** |
| **`admin/tokens` `GET /courtesy/quotas`** | yes | same | ❌ **broken** |
| **`admin/tokens` `POST /courtesy/quotas`** | yes | same | ❌ **broken** |
| **`admin/tokens` `POST /courtesy/issue`** | yes | same | ❌ **broken** |
| **`admin/tokens` `GET /balance/:userId`** | yes | same | ❌ **broken** |

All controllers above are behind `@UseGuards(JwtAuthGuard)` (authentication required). **No admin route is unprotected/open.**

## The `admin/tokens` bug — CONFIRMED
```ts
private assertAdmin(req: any) {
  if (req.user?.userType !== 'admin') throw new ForbiddenException('Admin only');
}
```
- The `UserType` enum is `personal | author | editorial` — **there is no `'admin'` value.** Admin status is the separate `isAdmin` boolean.
- Therefore `req.user.userType` is **never** `'admin'` → `assertAdmin` **always throws** → every `admin/tokens` route returns 403 for **all** users, including real admins.

### Severity & direction — CONFIRMED
- **Fails CLOSED**, not open: this is **not** a privilege-escalation hole. Nobody can reach these endpoints, so nothing is exposed.
- It **is** a **functional defect**: admins **cannot** issue promotional tokens, manage courtesy quotas, issue courtesy tokens, or look up balances via the API. (These may currently be done via direct DB, or the feature is simply unused — **UNKNOWN** which.)
- It is the **only** admin check in the codebase using `userType` instead of `isAdmin` — a direct consequence of decentralized (copy-inconsistent) authorization.

### Latent trap — INFERRED
Because it fails closed, someone "fixing" the symptom incorrectly (e.g. adding `'admin'` to the `UserType` enum, or loosening the check) could accidentally **open** these token-minting endpoints. The correct fix is to align it with the rest of the codebase (`isAdmin`), not to invent an `'admin'` userType.

## Recommendation — see [06](06-remediation-plan.md)
1. **Smallest safe fix:** change `assertAdmin` to `if (!req.user?.isAdmin) throw new ForbiddenException(...)`. One line; restores intended admin function; consistent with all other routes; still fails closed for non-admins.
2. **Structural (NEM-001 H2):** introduce a single `AdminGuard`/`@Roles('admin')` and migrate the inline checks to it, so this class of drift cannot recur. (Design/plan only — not part of NEM-002 implementation.)
