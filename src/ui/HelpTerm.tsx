import { useState } from 'react';

interface Props {
  /** The visible term (e.g. "preposition" or a morph code like "N-NSM"). */
  label: string;
  /** Plain-language explanation revealed on tap / hover. */
  help: string;
  /** Render the term in a monospace face (for morph codes). */
  mono?: boolean;
}

/**
 * A term with a dotted underline and a help cursor that, when tapped, reveals
 * its explanation inline beneath it. `title` still gives the desktop hover
 * tooltip, but tap is the primary affordance so it works on touch (where
 * `title` never shows). Used for part-of-speech and morph-code values.
 */
export function HelpTerm({ label, help, mono }: Props) {
  const [open, setOpen] = useState(false);
  if (!help) return <>{label}</>;
  return (
    <span className="help-term-wrap">
      <button
        type="button"
        className={`glossable help-term${mono ? ' mono' : ''}`}
        title={help}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <span className="help-note" role="note">
          {help}
        </span>
      )}
    </span>
  );
}
