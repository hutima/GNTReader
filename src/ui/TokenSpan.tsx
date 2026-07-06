import type { ReadingToken } from '@/domain/schema';
import type { DisplayMode } from '@/state/store';
import { displayGloss } from './morph';

interface Props {
  token: ReadingToken;
  mode: DisplayMode;
  selected: boolean;
  onSelect(token: ReadingToken): void;
}

/**
 * The source `after` attribute is a bare separator: " " (word break), Greek
 * punctuation (· , . ; ’ — a space follows it in running text), Hebrew maqqef
 * "־" (joins the next word, NO space) or sof pasuq "׃". Absent/empty means
 * the next morpheme joins directly (Hebrew prefixes).
 */
function afterParts(after: string | undefined): { mark: string; space: boolean } {
  if (!after) return { mark: '', space: false };
  if (after === ' ') return { mark: '', space: true };
  return { mark: after, space: after !== '־' };
}

/**
 * One tappable token. `after` renders OUTSIDE the tappable area so the
 * highlight hugs the word. Gloss mode replaces the surface; both mode stacks
 * the gloss underneath (works in RTL flow too).
 */
export function TokenSpan({ token, mode, selected, onSelect }: Props) {
  const { mark, space } = afterParts(token.after);
  const surface = <span className={token.language}>{token.surface}</span>;
  return (
    <>
      <button type="button" className={`token${selected ? ' selected' : ''}`} onClick={() => onSelect(token)}>
        {mode === 'original' && surface}
        {mode === 'gloss' && <span className="token-gloss">{displayGloss(token)}</span>}
        {mode === 'both' && (
          <span className="token-stack">
            {surface}
            <span className="token-gloss under">{displayGloss(token)}</span>
          </span>
        )}
      </button>
      {mark && <span className={`after ${token.language}`}>{mark}</span>}
      {space && ' '}
    </>
  );
}
