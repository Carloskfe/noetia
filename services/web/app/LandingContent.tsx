'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

/**
 * Public landing page — Quiet Editorial presentation of the full ecosystem (Noetia available; Noetia+ and NoetiaX
 * shown with non-interactive "Coming Soon" labels: no upgrade, checkout or activation path). All copy comes from
 * the `landing` i18n namespace. The page renders no footer of its own; the single global Footer (root layout)
 * switches to its dark tone on this route.
 */

type IconName = 'headphones' | 'pen' | 'share' | 'check' | 'chat' | 'vote' | 'paw' | 'child' | 'leaf' | 'menu' | 'close' | 'arrow';

const ICON_PATHS: Record<IconName, JSX.Element> = {
  headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><rect x="3" y="14" width="5" height="7" rx="2" /><rect x="16" y="14" width="5" height="7" rx="2" /></>,
  pen: <><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /><path d="m14 6 4 4" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  vote: <><path d="M4 12h16v8H4z" /><path d="m8 12 3-7 5 2-2 5" /></>,
  paw: <><circle cx="7" cy="9" r="1.8" /><circle cx="11" cy="6" r="1.8" /><circle cx="15" cy="6.5" r="1.8" /><circle cx="18" cy="10" r="1.8" /><path d="M8 17c0-3 2-5 4.5-5s4.5 2 4.5 5c0 2-2 3-4.5 3S8 19 8 17z" /></>,
  child: <><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M8 11h8M10 21l2-6 2 6" /></>,
  leaf: <><path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s2-1 4-1c7 0 11-6 11-15z" /><path d="M4 20 14 10" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
};

function Icon({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

const STEP_ICONS: IconName[] = ['headphones', 'pen', 'share'];
const CLUB_ICONS: IconName[] = ['chat', 'headphones', 'vote'];
const CAUSE_ICONS: IconName[] = ['paw', 'child', 'leaf'];

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-navy transition hover:bg-emerald-300 ${focusRing}`;
const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 ${focusRing}`;
const textLink = `inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 ${focusRing}`;
const eyebrow = 'text-xs font-bold uppercase tracking-[0.14em]';
const sectionTitle = 'font-display text-3xl sm:text-4xl font-bold leading-tight';
const card = 'rounded-2xl border border-white/10 bg-navy-raised p-6';

function LanguageSwitch({ className = '' }: { className?: string }) {
  const { t, language, setLanguage } = useTranslation();
  return (
    <div role="group" aria-label={t.landing.nav.language} className={`inline-flex overflow-hidden rounded-full border border-white/25 text-xs font-bold ${className}`}>
      {(['es', 'en'] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={language === lng}
          onClick={() => setLanguage(lng)}
          className={`px-3 py-1.5 transition ${focusRing} ${language === lng ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function LandingContent() {
  const { t } = useTranslation();
  const l = t.landing;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const navLinks = [
    { href: '#como-funciona', label: l.nav.howItWorks },
    { href: '/library', label: l.nav.library },
    { href: '#ecosistema', label: l.nav.ecosystem },
    { href: '/pricing', label: l.nav.plans },
  ];

  return (
    <main className="min-h-screen bg-navy text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className={`text-lg font-bold tracking-[0.28em] ${focusRing}`}>NOETIA</Link>
          <nav aria-label={l.nav.main} className="hidden items-center gap-7 text-sm text-slate-300 lg:flex">
            {navLinks.map((n) => (
              <Link key={n.href} href={n.href} className={`hover:text-white ${focusRing}`}>{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitch className="hidden sm:inline-flex" />
            <Link href="/login" className={`hidden text-sm text-slate-300 hover:text-white sm:inline ${focusRing}`}>{l.nav.signIn}</Link>
            <Link href="/register" className={`rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-navy hover:bg-emerald-300 ${focusRing}`}>{l.nav.createAccount}</Link>
            <button
              type="button"
              className={`grid h-10 w-10 place-items-center rounded-lg text-white lg:hidden ${focusRing}`}
              aria-label={l.nav.openMenu}
              aria-expanded={menuOpen}
              aria-controls="landing-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / tablet menu */}
      {menuOpen && (
        <div id="landing-menu" role="dialog" aria-modal="true" aria-label={l.nav.menu} className="fixed inset-0 z-40 overflow-y-auto bg-navy lg:hidden">
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
            <span className="text-lg font-bold tracking-[0.28em]">NOETIA</span>
            <button type="button" className={`grid h-10 w-10 place-items-center rounded-lg ${focusRing}`} aria-label={l.nav.closeMenu} onClick={() => setMenuOpen(false)} autoFocus>
              <Icon name="close" className="h-6 w-6" />
            </button>
          </div>
          <nav aria-label={l.nav.menu} className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
            <ul className="divide-y divide-white/10 font-display text-2xl font-bold">
              {navLinks.map((n) => (
                <li key={n.href}><Link href={n.href} className={`block py-3 ${focusRing}`} onClick={() => setMenuOpen(false)}>{n.label}</Link></li>
              ))}
            </ul>
            <div className="mt-7 grid gap-3">
              <Link href="/register" className={btnPrimary}>{l.nav.createAccount}</Link>
              <Link href="/login" className={btnSecondary}>{l.nav.signIn}</Link>
            </div>
            <div className="mt-7 flex items-center justify-between">
              <span className={`${eyebrow} text-slate-400`}>{l.nav.language}</span>
              <LanguageSwitch />
            </div>
          </nav>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-5">
          <p className={`${eyebrow} text-emerald-400`}>{l.hero.eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.12] sm:text-5xl">
            {l.hero.titleA}<br /><span className="text-emerald-400">{l.hero.titleB}</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-300">{l.hero.lede}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={btnPrimary}>{l.hero.ctaPrimary}</Link>
            <Link href="/library" className={btnSecondary}>{l.hero.ctaSecondary} <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
        </div>

        {/* Illustrative product demonstration: static, public-domain text, labelled as an illustration. */}
        <figure className="lg:col-span-7" aria-label={l.hero.demoLabel}>
          <div className="grid items-end gap-4 sm:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="rounded-2xl bg-[#FCFCFD] p-6 text-gray-900 shadow-2xl">
                <div className="mb-3 flex items-center justify-between text-xs text-gray-600">
                  <span>{l.hero.demoSource}</span>
                  <Icon name="headphones" className="h-4 w-4" />
                </div>
                <p className="font-serif text-[17px] leading-[1.75]">
                  {l.hero.demoBefore}
                  <mark className="rounded bg-emerald-50 px-0.5 text-gray-900 shadow-[inset_0_-2px_0_#047857]">{l.hero.demoPhrase}</mark>
                  {l.hero.demoAfter}
                </p>
                <div className="mt-4 flex items-center gap-3 border-t border-gray-200 pt-3 text-xs text-gray-600" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
                  <span className="relative h-1 flex-1 rounded bg-gray-200"><span className="absolute inset-y-0 left-0 w-[38%] rounded bg-emerald-700" /></span>
                  <span>0:42</span><b>1.0×</b>
                </div>
              </div>
              <p className="mt-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><Icon name="check" className="h-4 w-4" />{l.hero.demoSaved}</span></p>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl shadow-2xl">
              <Image src="/backgrounds/imagen-13.jpg" alt="" fill sizes="300px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-navy/10 to-navy/70" />
              <span className="absolute left-4 top-4 text-[11px] font-bold tracking-[0.28em]" aria-hidden="true">NOETIA</span>
              <blockquote className="absolute inset-x-5 bottom-5">
                <p className="font-display text-lg font-semibold leading-snug">{l.hero.demoQuote}</p>
                <p className="mt-2 text-xs text-white/90">{l.hero.demoAuthor}</p>
              </blockquote>
            </div>
          </div>
          <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {l.hero.demoSteps.map((s, i) => (<li key={s}><b className="mr-1.5 text-emerald-400">{i + 1}</b>{s}</li>))}
          </ol>
          <figcaption className="mt-2 text-xs text-slate-400">{l.hero.caption}</figcaption>
        </figure>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-t border-white/10 py-20" aria-labelledby="como-funciona-title">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className={`${eyebrow} text-slate-400`}>{l.how.eyebrow}</p>
          <h2 id="como-funciona-title" className={`mt-3 ${sectionTitle}`}>{l.how.title}</h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{l.how.intro}</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {l.how.steps.map((s, i) => (
              <div key={s.title}>
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400"><Icon name={STEP_ICONS[i]} /></div>
                <h3 className="font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-slate-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosistema" className="border-t border-white/10 py-20" aria-labelledby="ecosistema-title">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className={`${eyebrow} text-emerald-400`}>{l.eco.eyebrow}</p>
          <h2 id="ecosistema-title" className={`mt-3 ${sectionTitle}`}>{l.eco.title}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className={card} data-tier="noetia">
              <span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">{l.eco.available}</span>
              <h3 className="mt-4 font-display text-2xl font-bold">Noetia</h3>
              <p className="mt-1 text-slate-300">{l.eco.noetia.verb}</p>
              <ul className="mt-5 grid gap-2.5 text-sm text-slate-300">
                {l.eco.noetia.bullets.map((b) => (<li key={b} className="flex gap-2.5"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{b}</li>))}
              </ul>
              <Link href="/register" className={`${btnPrimary} mt-6`}>{l.eco.noetia.cta}</Link>
            </article>
            {(['plus', 'x'] as const).map((tier) => (
              <article key={tier} className={card} data-tier={tier}>
                {/* Non-interactive availability label: no upgrade, checkout or activation path. */}
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">{l.eco.comingSoon}</span>
                <h3 className="mt-4 font-display text-2xl font-bold">{tier === 'plus' ? 'Noetia+' : 'NoetiaX'}</h3>
                <p className="mt-1 text-slate-300">{l.eco[tier].verb}</p>
                <ul className="mt-5 grid gap-2.5 text-sm text-slate-300">
                  {l.eco[tier].bullets.map((b) => (<li key={b} className="flex gap-2.5"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{b}</li>))}
                </ul>
                <p className="mt-6 border-t border-white/10 pt-4 text-sm text-slate-400">{l.eco[tier].requirement}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-sm text-slate-400">{l.eco.note}</p>
        </div>
      </section>

      {/* Reading Clubs */}
      <section className="border-t border-white/10 py-20" aria-labelledby="clubes-title">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} text-slate-400`}>{l.clubs.eyebrow}</p>
            <h2 id="clubes-title" className={`mt-3 ${sectionTitle}`}>{l.clubs.title}</h2>
            <Link href="/clubs" className={`${btnSecondary} mt-7`}>{l.clubs.cta}</Link>
          </div>
          <ul className="grid gap-5 lg:col-span-7">
            {l.clubs.items.map((it, i) => (
              <li key={it.title} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-emerald-400"><Icon name={CLUB_ICONS[i]} /></span>
                <span><b className="block">{it.title}</b><span className="text-slate-300">{it.desc}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Causas Noetia — PO-approved commitment wording; no allocation logic on this page. */}
      <section className="border-t border-white/10 py-20" aria-labelledby="causas-title">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} text-emerald-400`}>{l.causas.eyebrow}</p>
            <h2 id="causas-title" className={`mt-3 ${sectionTitle}`}>{l.causas.title}</h2>
            <p className="mt-4 text-lg text-slate-300">{l.causas.body}</p>
            <Link href="/causas" className={`${textLink} mt-6`}>{l.causas.cta} <Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <ul className="grid gap-5 lg:col-span-7">
            {l.causas.causes.map((c, i) => (
              <li key={c.title} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-emerald-400"><Icon name={CAUSE_ICONS[i]} /></span>
                <span><b className="block">{c.title}</b><span className="text-slate-300">{c.desc}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Authors */}
      <section className="border-t border-white/10 py-20" aria-labelledby="autores-title">
        <div className="mx-auto grid max-w-6xl items-start gap-8 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} text-slate-400`}>{l.authors.eyebrow}</p>
            <h2 id="autores-title" className={`mt-3 ${sectionTitle}`}>{l.authors.title}</h2>
          </div>
          <div className="lg:col-span-7">
            <p className="text-lg text-slate-300">{l.authors.body}</p>
            <Link href="/upload-guide" className={`${btnSecondary} mt-6`}>{l.authors.cta}</Link>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-white/10 py-20 text-center">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className={sectionTitle}>{l.closing.title}</h2>
          <Link href="/register" className={`${btnPrimary} mt-7`}>{l.closing.cta}</Link>
        </div>
      </section>
    </main>
  );
}
