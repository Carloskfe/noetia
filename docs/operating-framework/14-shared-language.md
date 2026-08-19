# Shared Language

**v0.1** · NOF-001 · The canonical glossary. Where a term is contested, the conflict is
named rather than silently resolved.

---

## Product

**Noetia** — The platform. Always "Noetia" in user-facing copy; never "la app" or "la
plataforma."

**Escucha Activa** — Synchronized reading and listening at phrase level. A proper noun:
**both words always capitalized**, never translated, never "modo de escucha."

**Fragmento** (ES) / **Fragment** (EN) — A reader's captured highlight, a first-class
object that can carry a note and become a quote card. **Never** "highlight," "marcador,"
or "nota" in Spanish copy.

**Frase** / **Phrase** — The atomic unit of synchronization. Never "oración" or "cue."

**Biblioteca** / **Library** — The user's collection of accessible books. Never "librería"
(which means bookshop) or "colección."

**Quote card** — The rendered shareable image produced from one or more fragments.

**Clubes de Lectura** — Reading clubs. Never "clubs" or "círculos". *Specified in project
memory; absent from the documentation corpus.*

**Free library** — The ~84 public-domain titles used as a beta acquisition tool.
Explicitly **not the business**.

## Commerce

**Token** — The unit of book access. Renamed from "credit" in migration 038; **never**
"crédito" in Spanish. One token redeems one book, permanently.

**Redemption** — Spending a token to gain permanent access to a specific title. The moment
a creator obligation is created (PO-008).

**Qualifying redemption** — A *paid* token redemption, which creates a creator allocation.
Promotional and courtesy redemptions do not.

**Shared pool** — Duo/Family tokens drawn from the subscription owner's balance. Distinct
from libraries, which remain **separate per user**.

**Duo / Family** — Multi-user plans. Duo = 2 users. Family = **5 or 6 — CONFLICTING**
(C-02).

**Causas Noetia** — The social-giving allocation: 2.22% of every payment. A proper noun.

**Gift card** — A Stripe purchase delivered by email with a claim token. Distinct from
**peer token gifting** (sharing from an existing balance), which is *not implemented*.

**Breakage** — Value from unredeemed expired tokens. `OPEN` — no decision.

## Creator

**Writer / Author** — Creates the work. **Publisher / Rights holder** — Holds distribution
rights; may be the author. **Narrator / Voice creator** — Produces the audio.
**Self-narrating author** — Writer and narrator in one party (the 45% combined case).

**Creator** — Umbrella term for any of the above. Use the specific role when economics are
involved; "creator share" without qualification is the ambiguity PO-007 exists to fix.

## AI (all PLANNED — none implemented)

**Noetia+** — The paid AI capability tier. **Noetia Brain** — The intelligence layer.

**Ask This Book** — Grounded Q&A within one book. **My Knowledge** — Across owned books,
highlights and notes; the core experience. **Expand** — Broader knowledge with
distinguishable provenance. *All three names are provisional (Q-10).*

**Grounding** — Anchoring an answer in retrieved Noetia content rather than model
knowledge. **Provenance** — The citable chain Book → Author → Chapter → chunk → reader
location.

**Semantic chunk** — A retrieval unit referencing a phrase range. **Deliberately separate
from sync phrases** — AI chunking is never coupled to reader synchronization.

**Workload class** — Low-cost / standard / advanced routing tiers (PO-001).

## Governance

**PO decision** — A Product Owner ruling (PO-001 … PO-009). **ADR** — An Architecture
Decision Record. **NEM** — Noetia Engineering Mission; bounded authorization to change the
repository. **NOF** — Noetia Operating Framework mission; institutional documentation.

**Bounded authorization** — An approved mission authorizes its own scope and nothing else.
**Protected system** — Escucha Activa, ownership, production data, business-rule engines.

**Product Architecture review** — The mandatory review before a mission is complete. A
deploy is not completion.

## Naming conflicts recorded

| Term | Conflict |
|---|---|
| **"45%"** | Noetia's share *and* the combined creator share. Resolved by PO-007 — must always name whose |
| **Family seats** | 5 (business plan) vs 6 (PRD) — unresolved (C-02) |
| **"Product Bible"** | Superseded by "Operating Framework" (NOF-001 §2). Historical documents are not renamed |
| **"Ownership"** | Used for permanent library access; carries legal weight — `LEGAL REVIEW REQUIRED` |

## Copy conventions

"tú" throughout, never "usted." Sentence case on labels. Ellipsis `…` not `...`. No `¡`/`!`
in errors or loading states. No `"Error:"` prefix. Full guide: [`CLAUDE.md` § Voice & Style](../../CLAUDE.md).
