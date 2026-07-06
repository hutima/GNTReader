/**
 * Text normalization for search (adopted from the reference app's
 * accent-folding). `\p{Mn}` strips Greek accents/breathings/iota-subscript
 * AND Hebrew vowel points/cantillation in one pass, so one fold works for
 * both scripts. Apply to BOTH the query and the corpus side.
 */
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

export function hasAccents(s: string): boolean {
  return /\p{Mn}/u.test(s.normalize('NFD'));
}

/** MACULA glosses use dots for spaces ("he.created") — tidy for display. */
export function tidyGloss(gloss: string | undefined): string {
  return (gloss ?? '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

/** foldAccents leaves final sigma as ς; map it to σ so a surface search
 *  matches a word-final form regardless of which sigma the query uses. */
export function foldGreekSearch(s: string): string {
  return foldAccents(s).replace(/ς/g, 'σ');
}
