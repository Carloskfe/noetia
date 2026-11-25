import { isFrenchEnabled, type Language } from '../locales';
import type { Localized } from './types';

// Public invite page /s/[id] (NEM-025 B1-A). ES/EN moved verbatim from app/s/[id]/page.tsx;
// fr-CA DRAFT pending review. The page is server-rendered for logged-out visitors, so the language
// comes from Accept-Language; French is chosen only while the French readiness gate is enabled.
export interface ShareInviteCopy {
  invite: string;
  readBook: (t: string) => string;
  discover: string;
  tagline: string;
  metaDesc: (a: string, t: string) => string;
}

const es: ShareInviteCopy = {
  invite: 'Alguien quiere compartir esta idea contigo.',
  readBook: (t: string) => `Lee «${t}» en Noetia`,
  discover: 'Descubre Noetia',
  tagline: 'Lee, escucha y comparte lo que te inspira — frase por frase.',
  metaDesc: (a: string, t: string) => `${a} · ${t} — léelo en Noetia, con audio sincronizado frase por frase.`,
};

const en: ShareInviteCopy = {
  invite: 'Someone wanted to share this idea with you.',
  readBook: (t: string) => `Read “${t}” on Noetia`,
  discover: 'Discover Noetia',
  tagline: 'Read, listen, and share what inspires you — phrase by phrase.',
  metaDesc: (a: string, t: string) => `${a} · ${t} — read it on Noetia, with phrase-by-phrase synced audio.`,
};

const frCA: ShareInviteCopy = {
  invite: 'Quelqu’un voulait partager cette idée avec vous.',
  readBook: (t: string) => `Lire « ${t} » sur Noetia`,
  discover: 'Découvrir Noetia',
  tagline: 'Lisez, écoutez et partagez ce qui vous inspire — phrase par phrase.',
  metaDesc: (a: string, t: string) => `${a} · ${t} — à lire sur Noetia, avec un audio synchronisé phrase par phrase.`,
};

export const shareInviteCopy: Localized<ShareInviteCopy> = { es, en, 'fr-CA': frCA };

/** Interface language for an anonymous visitor, from the Accept-Language header.
 *  Unchanged for es/en (`en*` → English, anything else → Spanish). `fr*` → fr-CA only behind the
 *  French readiness gate; with the gate off, French visitors keep the previous Spanish default. */
export function pickShareLanguage(acceptLanguage: string | null | undefined, frEnabled: boolean = isFrenchEnabled()): Language {
  const al = acceptLanguage?.toLowerCase() ?? '';
  if (al.startsWith('en')) return 'en';
  if (frEnabled && al.startsWith('fr')) return 'fr-CA';
  return 'es';
}
