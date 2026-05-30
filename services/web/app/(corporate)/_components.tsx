import Link from 'next/link';
import React from 'react';

const NAV_LINKS = [
  { href: '/about', label: 'Sobre Noetia' },
  { href: '/company', label: 'Empresa' },
  { href: '/how-we-build', label: 'Cómo construimos' },
  { href: '/team', label: 'Equipo' },
  { href: '/careers', label: 'Carreras' },
  { href: '/contact', label: 'Contacto' },
];

export function CorporateNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-bold tracking-widest text-[#0D1B2A] shrink-0">
          NOETIA
        </Link>
        <div className="hidden lg:flex items-center gap-6 text-sm text-gray-500">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-[#0D1B2A] transition">
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/login" className="hidden sm:block text-sm text-gray-500 hover:text-[#0D1B2A] transition">
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="bg-[#0D1B2A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function BiSection({ es, en }: { es: React.ReactNode; en: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-4 block">
          🇪🇸 Español
        </span>
        <div className="text-gray-700 leading-relaxed space-y-4 text-[15px]">{es}</div>
      </div>
      <div className="lg:border-l lg:border-gray-100 lg:pl-16">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-4 block">
          🇺🇸 English
        </span>
        <div className="text-gray-700 leading-relaxed space-y-4 text-[15px]">{en}</div>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4">
      {children}
    </p>
  );
}

export function SectionTitle({ es, en }: { es: string; en: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] leading-snug">{es}</h2>
      <p className="text-gray-400 text-base font-light mt-1">{en}</p>
    </div>
  );
}

export function PageCTA({ href, label, secondary }: { href: string; label: string; secondary?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 pt-4">
      <Link href={href} className="inline-flex items-center justify-center bg-[#0D1B2A] text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition text-sm">
        {label}
      </Link>
      {secondary && (
        <Link href={secondary.href} className="inline-flex items-center justify-center border border-gray-200 text-gray-600 font-medium px-6 py-3 rounded-xl hover:border-gray-400 transition text-sm">
          {secondary.label}
        </Link>
      )}
    </div>
  );
}
