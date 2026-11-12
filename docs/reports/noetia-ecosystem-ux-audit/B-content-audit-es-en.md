# Appendix B — Spanish and English Content Audit, Terminology and Style Guide

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md). **Translation files were not modified.** Evidence references follow [Appendix A](A-findings-register.md#how-to-read-this-register).

## 1. Sources inspected

| Source | Branch@commit | Notes |
|---|---|---|
| `services/web/lib/i18n/es.ts` (828 lines), `en.ts` (833) | `main@6a5e5c0` | Parity enforced by `tests/unit/lib/i18n.spec.ts` (structure only, not meaning) |
| Research i18n block (`research: {…}`, about 116 lines per language) | `feat/nem-024-checkpoint-b@860f531` | **Not on main** |
| `services/mobile/src/i18n/es.ts`, `en.ts` (216 lines each) | `main@6a5e5c0` | Separate mobile catalogue |
| Hard-coded JSX strings and inline `=== 'es' ?` ternaries | `main@6a5e5c0:services/web/{app,components}` | Heuristic scan; see §4 |
| Email templates | `main@6a5e5c0:services/api/src/email/email.service.ts` | Bilingual by `lang` |
| A random sample of 26 strings per language, reviewed for naturalness | `main@6a5e5c0` | Seeded sample, method in Appendix E |

Of 107 web TSX files, 63 use `useTranslation()`. Twelve marketing and corporate files use inline language ternaries instead.

## 2. Spanish (assessed independently)

**Overall:** natural and warm. The "tú" register is consistent and there is no "usted". Loading text uses "…" correctly.

| ID | Issue | Example | Location | Suggested direction |
|---|---|---|---|---|
| CT-01 | Proper noun lowercased | "Modo escucha activa" | `es.ts:158` | "Modo Escucha Activa" |
| CT-02 | Non-canonical term | "Noetia Clubs" | `es.ts:403`; `discover/page.tsx:330` | "Clubes de Lectura Noetia" |
| CT-03 | Error templates diverge | "Ocurrió un error. Intenta de nuevo." | `es.ts:660` | "Algo salió mal. Inténtalo de nuevo." (guide pattern) |
| — | Link-expiry wording diverges | "El enlace no es válido o ya expiró" vs "El enlace de confirmación es inválido o ha expirado" | `es.ts` (auth sections) | One pattern: "Este enlace no es válido o ya caducó." |
| CT-04 | Title Case | "Mis Estadísticas de Lectura" | `es.ts:461` | "Mis estadísticas de lectura" |
| CT-05 | Calque from English "charged" | "Tu cuenta no ha sido cobrada" | `es.ts:308` | "No se te cobró nada." |
| CT-05 | "Discutir" can read as "to argue" | "Discute frase a frase" | `es.ts:448` | "Comenta frase a frase" |
| CT-06 | Over-exclamatory empty state | "¡Nadie ha escrito aún. Empieza la conversación!" | `es.ts:562` | "Aún no hay mensajes. Empieza la conversación." |
| CT-07 | Developer jargon | "Bifúrcala para continuar" | `860f531:es.ts:847,929` | "Continúa en una sesión nueva" |
| NP-09 | Vague usage term | "capacidad mensual" | `860f531:es.ts:924` | Depends on PO usage units (D10) |
| NC-13 | Gendered slash | "¡Bienvenido/a!" | `email.service.ts:126` | "¡Te damos la bienvenida!" |
| NC-11 | Plan naming collides with premium tiers | "Noetia Premium" | `es.ts:378`; mobile paywall | PO decision: "Suscripción Noetia" |
| NC-11 | Ambiguous benefit | "Acceso completo a la biblioteca" | `es.ts:354`; mobile paywall | PO decision on access rules first (NOF-004 F-3) |
| CT-12 | Unsupported claims | "llega a miles de lectores"; "Somos el primer intento deliberado…" | `author/page.tsx:202`; `company/content.tsx:53` | Factual phrasing |

**Strength:** the research copy on `860f531` is honest and precise. Examples:
- "Puede contar en tu capacidad mientras se confirma."
- "Se perdió la conexión. Recuperaremos tu pregunta sin volver a cobrarla."
- Pluralized exclusion messages.

It should serve as the tone reference for premium copy.

## 3. English (assessed independently)

**Overall:** grammatical and mostly natural.

| ID | Issue | Example | Location | Suggested direction |
|---|---|---|---|---|
| CT-08 | "Fragment" (about 30 occurrences) is a literal rendering of *fragmento*; English reading apps say "highlight" | "Save fragment", "No fragments yet" | `en.ts:150` and others | **PO decision**: "Highlight" recommended, or keep "Fragment" deliberately as a brand term |
| CT-09 | Brand term translated | "Active Listening Mode" | `en.ts:174` | **PO decision**: keep "Escucha Activa" as a brand name in both languages, or adopt an official English name |
| CT-10 | System-style errors | "Registration failed", "Confirmation failed" | `en.ts:56` | "We couldn't create your account. Please try again." |
| — | Club naming mixed | "Clubs" / "Reading Club" | `en.ts` | "Reading Clubs" |
| NC-14 | Hard-coded English outside i18n | "Save X%", "/mo", "/yr", "Unlimited books" | `lib/plan-utils.ts:10` (unused `PlanCard`) | Remove or i18n; "Unlimited books" is unsupported |
| NC-01 | Metadata | English Open Graph text with `locale: 'es_LA'` | `app/page.tsx:5-17` | Locale-specific metadata |
| NC-04, NC-09, NC-10 | **Missing English** | billing, author portal, admin, waitlist, cause selector, email verification, collection page, discover clubs promo | §4 | Translate |

## 4. Hard-coded string inventory

Heuristic: JSX text nodes and `placeholder`/`aria-label`/`alt`/`title` literals outside `t()`. These are counts of candidate strings per file on `main@6a5e5c0`.

| File | Strings | Language state |
|---|---|---|
| `app/(library)/upload-guide/content.tsx` | 96 (+53 ternaries) | Bilingual via ternaries |
| `app/(corporate)/company/content.tsx` | 46 | Bilingual via `es=`/`en=` props |
| `app/(admin)/author/page.tsx` | 36 | **Spanish only** |
| `app/(admin)/admin/page.tsx` | 33 | **Spanish only** |
| `app/(corporate)/about/content.tsx` | 20 | Bilingual via props |
| `app/(corporate)/trust/content.tsx` | 15 | Bilingual via props |
| `app/(account)/account/billing/page.tsx` | 13 | **Spanish only** |
| `app/LandingContent.tsx` | 12 (+27 ternaries) | Bilingual via ternaries |
| `app/causas/page.tsx` | 11 (+15 ternaries) | Bilingual via ternaries |
| `components/WaitlistForm.tsx` | 8 | **Spanish only** |
| `components/CauseSelector.tsx` | 6 | **Spanish only** |
| `components/Footer.tsx` | 4 | Brand and email literals (acceptable) |
| `app/(library)/discover/page.tsx` | 4 | **Spanish only** (clubs promo) |
| `components/EmailVerificationBanner.tsx` | 2 | **Spanish only** |
| `components/ClubDiscussion.tsx` | 2 | **English inside Spanish UI** ("Delete") |
| `components/EscuchaJuntosRoom.tsx` | 2 | Mixed ("Playback position" aria-label) |
| `components/ReaderTopBar.tsx` | 2 | Glyph labels "A−"/"A+" |
| `app/(library)/discover/collection/[slug]/page.tsx` | 2 | **Spanish only** |

**Mobile.** `ConsentScreen.tsx` shows bilingual text inline (both languages at once, `:32`). Mobile catalogues are otherwise separate and parity-sized (216/216).

## 5. Bilingual terminology

Status: PROPOSED. ★ marks a term that needs a Product Owner decision.

| Concept | Español | English | Notes |
|---|---|---|---|
| User highlight | Fragmento | ★ Highlight / Fragment | CLAUDE.md canonical for Spanish only |
| User's book list | Biblioteca | Library | |
| Synchronized mode | Escucha Activa | ★ Escucha Activa / Active Listening | Proper noun, always capitalized |
| Reading clubs | Clubes de Lectura | Reading Clubs | |
| Book credit | Token | Token | Never "crédito" (renamed in migration 038) |
| Active phrase | Frase | Phrase | |
| Book subscription | ★ Suscripción Noetia | ★ Noetia subscription | Replaces "Noetia Premium" |
| Premium tiers | Noetia+ · NoetiaX | Noetia+ · NoetiaX | Never "Basic" (PO-025) |
| Research session | Sesión de investigación | Research session | As on `860f531` |
| Research Brief | ★ Informe de investigación | Research Brief | |
| From books (provenance) | De tus libros | From your books | ADR-003 |
| General knowledge (provenance) | Contexto general | General context | Never attributed to a book |
| Your notes (provenance) | Tus notas | Your notes | |
| Citation | Cita | Citation | |
| Book lock | Los libros se bloquean tras tu primera pregunta | Books lock after your first question | PO-027 |
| Usage | ★ (D10 units) | ★ | Not "capacidad" until decided |

## 6. Writing style guide (PROPOSED)

1. **Case and headings.**
   - Sentence case for every label, button and heading.
   - One H1 per page; H2 for sections; no skipped levels.
2. **Loading:** verb + "…" (single character): "Cargando…", "Guardando…" / "Loading…", "Saving…".
3. **Errors:** a statement plus an action; no "Error:" prefix; no "¡"/"!" in errors or loading states.
4. **Success:** affirmative past tense ("Guardado" / "Saved"); exclamation sparingly.
5. **Register:** "tú" in Spanish; plain, second-person English; warm and direct, never help-desk.
6. **Claims:**
   - no unverifiable superlatives ("primero", "único", "first", "thousands");
   - no capability claims before a feature is IMPLEMENTED **and** released;
   - prices and limits must match the canonical source.
7. **Premium upgrade copy:**
   - say what the user can do and what they need ("Necesitas una suscripción Noetia activa para usar Noetia+");
   - never fear-based;
   - never imply book ownership depends on premium (PO-026).
8. **Citations:**
   - always name the book and location;
   - general knowledge is labeled as such;
   - excluded or unavailable sources are disclosed as facts, as on `860f531`.
9. **Translation:**
   - translate meaning, not words;
   - each language is reviewed by a native speaker;
   - avoid calques ("cobrada", "aplicar" for "apply to a job", etc.).
10. **Accessibility:**
    - icons never carry meaning alone;
    - every icon button has an accessible name in both languages;
    - avoid gendered slashes ("Bienvenido/a"); prefer neutral constructions.
11. **Process:** all user-facing strings go through i18n catalogues, enforced by a lint rule (PROPOSED in the main report, Package F).
