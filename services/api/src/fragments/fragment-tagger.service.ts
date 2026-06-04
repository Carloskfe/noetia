import { Injectable } from '@nestjs/common';
import { Theme, THEME_KEYWORDS } from './theme-taxonomy';

const MAX_THEMES = 3;

@Injectable()
export class FragmentTaggerService {
  /**
   * Returns up to MAX_THEMES theme tags for the given text, ordered by how
   * many keywords from each theme appear in the text (most matches first).
   * Returns an empty array when no keywords match.
   */
  tag(text: string): Theme[] {
    if (!text) return [];

    const lower = text.toLowerCase();
    const scores: [Theme, number][] = [];

    for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [Theme, string[]][]) {
      const count = keywords.filter((kw) => lower.includes(kw)).length;
      if (count > 0) scores.push([theme, count]);
    }

    return scores
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_THEMES)
      .map(([theme]) => theme);
  }
}
