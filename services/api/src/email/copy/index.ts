import type { EmailLocale } from '../locale';
import type { EmailCopy } from './types';
import { en } from './en';
import { es } from './es';
import { frCa } from './fr-ca';

export type { EmailCopy } from './types';

/** All transactional-email dictionaries, keyed by canonical interface locale. */
export const EMAIL_COPY: Record<EmailLocale, EmailCopy> = { es, en, 'fr-CA': frCa };
