import { useEffect, useState } from 'react';
import { loadStrongs, strongsEntry, type StrongsEntry } from '@/io/strongs';
import { useAppStore } from '@/state/store';
import { useIsMobile } from './useViewport';
import { describeMorph, displayGloss, morphChips, posHelp, posLabel } from './morph';
import { HelpTerm } from './HelpTerm';
import { useSheetDrag } from './useSheetDrag';

/**
 * Token detail: desktop = right side panel, mobile = bottom sheet with a
 * grabber (iOS HIG). Shows surface, lemma, transliteration, gloss, Strong's,
 * part of speech, parsing chips, and the reference. No syntax relations.
 *
 * Transliteration rule (ADR-0001): source-provided (Hebrew) → Strong's
 * entry's transliteration of the LEMMA (Greek) → "—". Never generated.
 */
export function DetailPanel() {
  const token = useAppStore((s) => s.selectedToken);
  const selectToken = useAppStore((s) => s.selectToken);
  const openStrongs = useAppStore((s) => s.openStrongs);
  const mobile = useIsMobile();
  const { grabberProps, sheetStyle } = useSheetDrag(() => selectToken(null));
  const [entry, setEntry] = useState<StrongsEntry | null>(null);

  useEffect(() => {
    setEntry(null);
    if (!token?.strong) return;
    let cancelled = false;
    loadStrongs(token.language)
      .then(() => {
        if (cancelled || !token.strong) return;
        setEntry(strongsEntry(token.language, token.strong) ?? null);
      })
      .catch(() => {
        /* lexicon unavailable (offline, never cached) — panel shows "—" */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const translit = token.transliteration ?? entry?.translit ?? '—';
  const strongLabel = token.strong
    ? `${token.language === 'hbo' ? 'H' : 'G'}${token.strong}`
    : null;
  const chips = morphChips(token);

  const body = (
    <>
      <header className="detail-head">
        <span className={`detail-surface ${token.language}`}>{token.surface}</span>
        <button
          type="button"
          className="close"
          aria-label="Close details"
          onClick={() => selectToken(null)}
        >
          ✕
        </button>
      </header>
      <dl className="detail-rows">
        <div className="row">
          <dt>Lexical form</dt>
          <dd className={token.language}>{token.lemma ?? '—'}</dd>
        </div>
        <div className="row">
          <dt>Transliteration</dt>
          <dd>{translit}</dd>
        </div>
        <div className="row">
          <dt>Gloss</dt>
          <dd>{displayGloss(token)}</dd>
        </div>
        <div className="row">
          <dt>Strong’s</dt>
          <dd>
            {strongLabel ? (
              <button type="button" className="link" onClick={() => openStrongs(strongLabel)}>
                {strongLabel}
              </button>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="row">
          <dt>Part of speech</dt>
          <dd>
            {token.pos ? (
              <HelpTerm label={posLabel(token.pos)} help={posHelp(token.pos)} />
            ) : (
              posLabel(token.pos)
            )}
          </dd>
        </div>
        <div className="row">
          <dt>Parsing</dt>
          <dd>
            {chips.length ? (
              <span className="chips">
                {chips.map((c, i) => (
                  <span key={i} className="chip">
                    {c}
                  </span>
                ))}
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {token.morphology?.extra?.morph && (
          <div className="row">
            <dt>Morph code</dt>
            <dd>
              <HelpTerm label={token.morphology.extra.morph} help={describeMorph(token)} mono />
            </dd>
          </div>
        )}
        <div className="row">
          <dt>Reference</dt>
          <dd>
            {token.book} {token.chapter}:{token.verse}
          </dd>
        </div>
      </dl>
    </>
  );

  return mobile ? (
    <div className="sheet-backdrop" onClick={() => selectToken(null)}>
      <section
        className="detail sheet"
        role="dialog"
        aria-label="Word details"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grabber" {...grabberProps} />
        {body}
      </section>
    </div>
  ) : (
    <aside className="detail side" aria-label="Word details">
      {body}
    </aside>
  );
}
