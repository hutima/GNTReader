import { memo } from 'react';
import type { ReadingToken, ReadingVerse } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { TokenSpan } from './TokenSpan';

interface Props {
  verse: ReadingVerse;
  mode: DisplayMode;
  selectedId: string | null;
  onSelect(token: ReadingToken): void;
}

/**
 * One verse: superscript number + token flow. Hebrew flows right-to-left
 * (dir on the verse text container, not per token) unless gloss mode makes
 * the running text English.
 */
export const VerseView = memo(function VerseView({ verse, mode, selectedId, onSelect }: Props) {
  const rtl = verse.language === 'hbo' && mode !== 'gloss';
  return (
    <span className="verse" id={`v-${verse.chapter}-${verse.verse}`}>
      <sup className="verse-num">{verse.verse}</sup>
      <span className="verse-text" dir={rtl ? 'rtl' : 'ltr'}>
        {verse.tokens.map((t) => (
          <TokenSpan
            key={t.id}
            token={t}
            mode={mode}
            selected={t.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </span>{' '}
    </span>
  );
});
