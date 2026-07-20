import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';

/**
 * First-launch, skippable step-through tutorial teaching vocabulary mode in
 * the "Both" view (the app's first-run default — see store.ts loadMode /
 * loadVocab). Mirrors UpdateModal's self-gating .modal-backdrop/.modal
 * pattern (styles.css ~l.768) rather than a bottom sheet: this is a small,
 * button-dismissed card, not a gesture surface, so useSheetDrag does not
 * apply here. No backdrop-click dismissal — only the explicit buttons below
 * close it, so an accidental tap outside the card can't skip it on mobile.
 *
 * "Seen" is persisted (markTutorialSeen) the moment this first auto-opens,
 * not only when the user taps Skip tour / Get started — otherwise a session
 * that ends before dismissal (e.g. the mandatory UpdateModal reloading the
 * app on "Refresh now", stacked on top of this one) leaves the flag unset
 * and the tour auto-fires again next launch. See store.ts markTutorialSeen.
 */
interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to GNT Reader',
    body: 'Read the Greek New Testament and Hebrew Old Testament with word-by-word helps. This short tour shows how vocabulary mode helps you read more on your own. You can replay it anytime from Settings.',
  },
  {
    title: 'The Both view',
    body: 'The reader starts in the Both view: each word shows the original text with its English gloss underneath. The tabs at the top switch views — Original shows only the original text, Gloss shows only English.',
  },
  {
    title: 'Mark words you know',
    body: 'Press and hold a word you recognize to mark it known. Its gloss disappears, so you practise recalling it yourself. You can also tap a word to open its detail panel and mark it known from there.',
  },
  {
    title: 'Watch the helps fade',
    body: 'As you mark more words known, fewer glosses remain and the text becomes more your own reading. Change your mind? Press and hold the word again, or unmark it from its detail panel.',
  },
  {
    title: 'Make it yours',
    body: 'In Settings you can review your known words, switch vocabulary mode on or off, choose whether a long press marks the whole lexeme or just that form, and back up your progress. Happy reading!',
  },
];

const TITLE_ID = 'tutorialStepTitle';

export function TutorialModal() {
  const tutorialOpen = useAppStore((s) => s.tutorialOpen);
  const tutorialSeen = useAppStore((s) => s.tutorialSeen);
  const closeTutorial = useAppStore((s) => s.closeTutorial);
  const markTutorialSeen = useAppStore((s) => s.markTutorialSeen);
  const [step, setStep] = useState(0);

  // Always start from step 1 — whether this is the first-run auto-open or a
  // Settings "Replay tour".
  useEffect(() => {
    if (tutorialOpen) setStep(0);
  }, [tutorialOpen]);

  // Fire-once: mark "seen" as soon as the tour is shown (first-run auto-open),
  // not only when the user dismisses it — see the doc comment above.
  useEffect(() => {
    if (tutorialOpen && !tutorialSeen) markTutorialSeen();
  }, [tutorialOpen, tutorialSeen, markTutorialSeen]);

  if (!tutorialOpen) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={TITLE_ID}>
        <h2 className="modal-title" id={TITLE_ID}>
          {current.title}
        </h2>
        <p className="hint">{current.body}</p>
        <div className="tutorial-dots" role="presentation">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className="tutorial-dot"
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </div>
        <div className="modal-actions">
          {isLast ? (
            <button type="button" className="mini accept" onClick={closeTutorial}>
              Get started
            </button>
          ) : (
            <>
              <button type="button" className="mini" onClick={closeTutorial}>
                Skip tour
              </button>
              {!isFirst && (
                <button type="button" className="mini" onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              )}
              <button
                type="button"
                className="mini accept"
                onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
