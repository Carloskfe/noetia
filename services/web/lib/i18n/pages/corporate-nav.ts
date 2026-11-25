import type { Language } from '../locales';
import type { Localized } from './types';

export interface CorporateNavCopy {
  links: { href: string; label: string }[];
  signIn: string;
  createAccount: string;
}

const es: CorporateNavCopy = {
  links: [
    { href: '/about', label: 'Sobre Noetia' },
    { href: '/company', label: 'Empresa' },
    { href: '/how-we-build', label: 'Cómo construimos' },
    { href: '/team', label: 'Equipo' },
    { href: '/careers', label: 'Carreras' },
    { href: '/contact', label: 'Contacto' },
  ],
  signIn: 'Iniciar sesión',
  createAccount: 'Crear cuenta',
};

const en: CorporateNavCopy = {
  links: [
    { href: '/about', label: 'About' },
    { href: '/company', label: 'Company' },
    { href: '/how-we-build', label: 'How we build' },
    { href: '/team', label: 'Team' },
    { href: '/careers', label: 'Careers' },
    { href: '/contact', label: 'Contact' },
  ],
  signIn: 'Sign in',
  createAccount: 'Create account',
};

const frCA: CorporateNavCopy = {
  links: [
    { href: '/about', label: 'À propos' },
    { href: '/company', label: 'Entreprise' },
    { href: '/how-we-build', label: 'Notre façon de bâtir' },
    { href: '/team', label: 'Équipe' },
    { href: '/careers', label: 'Carrières' },
    { href: '/contact', label: 'Contact' },
  ],
  signIn: 'Se connecter',
  createAccount: 'Créer un compte',
};

export const corporateNavCopy: Localized<CorporateNavCopy> = { es, en, 'fr-CA': frCA };

/** Compact toggle labels for the corporate header (the visible ES/EN labels are unchanged). */
export const CORPORATE_LANGUAGE_LABELS: Record<Language, string> = { es: 'ES', en: 'EN', 'fr-CA': 'FR' };
