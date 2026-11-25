import type { Language } from '../locales';

/** A page-level dictionary: one complete copy object per interface language (NEM-025 B1-A).
 *  Every language must provide the same shape; tests enforce key and interpolation parity. */
export type Localized<T> = Record<Language, T>;
