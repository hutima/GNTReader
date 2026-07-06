import { memo } from 'react';
import type { ReadingToken, ReadingVerse } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { TokenSpan } from './TokenSpan';
import { roleClass } from './syntax';
import { isKnown } from './vocab';

interface Props {
  verse: ReadingVerse;
  mode: DisplayMode;
  selectedId: string | null;
  /** Clause id of the selected token; its clause-mates are highlighted. */
  selectedClauseId: string | null;
  /** Whether clause/role highlighting is enabled (Settings). */
  syntaxOn: boolean;
  /** Vocabulary mode: hide glosses for known words (Both mode only). */
  vocabOn: boolean;
  knownLexemes: Set<string>;
  knownParses: Set<string>;
  /** Toggle a word known (long-press in gloss/both mode). */
  onMark(token: ReadingToken): void;
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
  vocabOn,
  knownLexemes,
  knownParses,
  onMark,
  onSelect,
}: Props) {
  const rtl = verse.language === 'hbo' && mode !== 'gloss';
  // Vocabulary marking / known-styling apply where glosses are in play.
  const vocabActive = vocabOn && (mode === 'gloss' || mode === 'both');
  const longPressAction = vocabActive ? 'mark' : 'gloss';
  return (
    <span className="verse" id={`v-${verse.chapter}-${verse.verse}`}>
      <sup className="verse-num">{verse.verse}</sup>
      <span className="verse-text" dir={rtl ? 'rtl' : 'ltr'}>
        {verse.tokens.map((t) => {
          const synClass =
            syntaxOn && selectedClauseId && t.syntax?.clauseId === selectedClauseId
              ? roleClass(t.syntax?.role)
              : undefined;
          const known = vocabActive && isKnown(t, knownLexemes, knownParses);
          return (
            <TokenSpan
              key={t.id}
              token={t}
              mode={mode}
              selected={t.id === selectedId}
              synClass={synClass}
              known={known}
              longPressAction={longPressAction}
              onMark={onMark}
              onSelect={onSelect}
            />
          );
        })}
      </span>{' '}
    </span>
  );
});
