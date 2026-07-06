import type { ReadingToken } from '@/domain/schema';

/**
 * "Known vocabulary" keys. A reader can mark a whole LEXEME known (they know
 * the word in any inflection) or just this PARSE known (this specific form).
 * Keys are stable strings so they persist across sessions (localStorage).
 */

/** The dictionary headword: language + lemma. Null when the token has no lemma. */
export function lexemeKey(token: ReadingToken): string | null {
  return token.lemma ? `${token.language}|${token.lemma}` : null;
}

function parseSignature(token: ReadingToken): string {
  const morph = token.morphology?.extra?.morph;
  if (morph) return morph;
  const m = token.morphology;
  if (m) {
    const parts = [
      token.pos,
      m.case,
      m.gender,
      m.number,
      m.person,
      m.tense,
      m.voice,
      m.mood,
      m.state,
      m.degree,
      m.extra?.stem,
      m.extra?.type,
    ].filter(Boolean);
    if (parts.length) return parts.join(',');
  }
  return token.surface;
}

/** This specific inflected form: language + lemma + parse signature. */
export function parseKey(token: ReadingToken): string {
  return `${token.language}|${token.lemma ?? ''}|${parseSignature(token)}`;
}

/** True when the token's lexeme OR its exact parse has been marked known. */
export function isKnown(
  token: ReadingToken,
  lexemes: Set<string>,
  parses: Set<string>,
): boolean {
  const lk = lexemeKey(token);
  if (lk && lexemes.has(lk)) return true;
  return parses.has(parseKey(token));
}
