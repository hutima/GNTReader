import type { ClipboardEvent } from 'react';

/** Copy the selected scripture, without verse numbers or interlinear glosses.
 * cloneContents preserves partial endpoints, polytonic accents, punctuation,
 * and joined Hebrew morphemes. Never rewrite selections outside the reader.
 */
export function copyReaderSelection(event: ClipboardEvent<HTMLDivElement>) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
  const fragment = range.cloneContents();
  fragment.querySelectorAll('.under, .verse-num, .gloss-bubble').forEach((el) => el.remove());
  fragment.querySelectorAll('.chapter-heading, .verses').forEach((el) => el.append('\n'));
  const text = fragment.textContent?.trim();
  if (!text) return;
  event.clipboardData.setData('text/plain', text);
  event.preventDefault();
}
