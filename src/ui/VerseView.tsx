import { memo } from 'react';
import type { ReadingToken, ReadingVerse } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { TokenSpan } from './TokenSpan';
import { roleClass } from './syntax';

interface Props {
  verse: ReadingVerse;
  mode: DisplayMode;
  selectedId: string | null;
  /** Clause id of the selected token; its clause-mates are highlighted. */
  selectedClauseId: string | null;
  /** Whether clause/role highlighting is enabled (Settings). */
  syntaxOn: boolean;
  onSelect(token: ReadingToken): void;
}

/**
 * One verse: superscript number + token flow. Hebrew flows right-to-left
 * (dir on the verse text container, not per token) unless gloss mode makes
 * the running text English. When a word is selected and syntax highlighting
 * is on, every token sharing its clause is tinted by grammatical role.
 */
export const VerseView = memo(function VerseView({
  verse,
  mode,
  selectedId,
  selectedClauseId,
  syntaxOn,
  onSelect,
}: Props) {
  const rtl = verse.language === 'hbo' && mode !== 'gloss';
  return (
    <span className="verse" id={`v-${verse.chapter}-${verse.verse}`}>
      <sup className="verse-num">{verse.verse}</sup>
      <span className="verse-text" dir={rtl ? 'rtl' : 'ltr'}>
        {verse.tokens.map((t) => {
          const synClass =
            syntaxOn && selectedClauseId && t.syntax?.clauseId === selectedClauseId
              ? roleClass(t.syntax?.role)
              : undefined;
          return (
            <TokenSpan
              key={t.id}
              token={t}
              mode={mode}
              selected={t.id === selectedId}
              synClass={synClass}
              onSelect={onSelect}
            />
          );
        })}
      </span>{' '}
    </span>
  );
});
