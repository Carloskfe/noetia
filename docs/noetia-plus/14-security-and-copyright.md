# 14 — Security & Copyright Protection

## Anti-extraction / copyright (mission §12)
Threat: prompts that reconstruct copyrighted books ("give me every paragraph of chapter 4", sequential extraction, very long verbatim output, whole-book reconstruction).

**Layered mitigations (design):**
1. **Quotation policy per book** — a per-book max verbatim quote length/proportion (`book_ai_permissions.maxQuotePolicyRef`). The exact thresholds are a **product/legal decision** ([20](20-open-product-decisions.md)) — do **not** hardcode arbitrary legal limits.
2. **Output-length restrictions** — the Context Builder + response guard cap verbatim spans; answers *summarize/synthesize* by default, quoting only short, attributed passages.
3. **Context-window safeguards** — retrieval returns only the top-k permission-filtered chunks needed to answer; the system never loads a whole book into context, structurally preventing "dump the book".
4. **Sequential-extraction detection** — per-(user,book) counters detect systematic coverage (e.g. many adjacent-chunk requests over time) → throttle/refuse with a policy message. Signals stored in metering/Redis.
5. **Refusal behavior** — explicit refuse-and-explain for extraction-shaped prompts; refusals are logged (abuse signal).
6. **Attribution** — grounded answers always cite ([citations](10-api-design.md)); no unattributed verbatim.
7. **Scope enforcement** — extraction is impossible for RESTRICTED/LICENSED_PREVIEW content because full text never enters context ([05](05-content-permissions.md)).

## Prompt injection (content is untrusted)
Book text, **notes**, and uploaded content are **untrusted input** and may contain injection ("ignore instructions…").
- **Separation:** retrieved content is placed in a clearly delimited, **data-only** context region; the system prompt instructs the model to treat retrieved text as quoted material, never as instructions.
- **No tool/authority from content:** the model has no ability to act on instructions embedded in content (no privileged tools exposed to content-derived text).
- **Note injection:** user notes are user-private and only ever enter *that user's own* context — injection can only affect the injecting user, not others.
- **Malicious uploaded books:** author/publisher uploads already pass review (`isPublished`); AI indexing is gated on permission + review. Sanitize/normalize on chunking; treat as data.

## Entitlement & data-isolation attacks
- **Entitlement bypass:** every AI route goes through `PlusEntitlementGuard` + content-scope resolver — no feature path skips the check (the NEM-002A lesson: centralize, don't scatter). A missing check can't ship because capability is declarative (`@RequiresCapability`).
- **User-to-user leakage:** conversations/assets/embeddings-of-private-notes are user-scoped; retrieval for a user only queries that user's owned/permitted content + their own fragments. Caching keys include `userId` for private computations ([15](15-privacy.md)).
- **Publisher-content leakage:** licensed non-owned content never enters context beyond permitted representations; embeddings for discoverability are separate from full-text embeddings and gated.
- **Unauthorized catalog extraction / scraping:** AI routes are metered + fair-use-limited + bot-protected; retrieval is permission-filtered so scraping via prompts yields only entitled content.

## Cost/abuse
- **Oversized prompts** rejected pre-model (size guard). **Cost abuse / bots:** per-user + global budget guards, fair-use limits, throttling, anomaly alerts ([16](16-observability.md)). A runaway can't exceed the global budget guard, which trips a kill switch before overspend.

## Model risks
- **Hallucination:** grounded-answer mode with citations; "insufficient sources" refusal when retrieval is empty (`no_sources`) rather than fabricating; evaluation harness ([47 → EXECUTIVE]) gates rollout.

## Non-negotiable
None of these guards run in the reader path. A security failure in Noetia+ degrades Noetia+, never the reader.

## ADR candidates
- **Quotation-policy model** (per-book limits — product/legal).
- **Prompt-injection isolation pattern** (data-region + system-prompt contract).
