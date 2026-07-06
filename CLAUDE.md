# GNT Reader — working notes for AI sessions

A reading-focused PWA for the Greek NT / Hebrew OT (Vite + React + TS). Data is
MACULA Lowfat XML; see `docs/adr/0001-day-one-decisions.md` (+ its amendments),
`docs/config.md`, and `docs/data-sources-and-licenses.md`.

## Verify before you claim "done"

Always: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

**Interactive UI must be exercised in a REAL browser, not just unit tests.**
Vitest runs in happy-dom, which does NOT faithfully simulate pointer/touch
drags, gestures, scrolling, focus, layout, or timing. Any feature that involves
those — **especially a bottom-sheet grabber / swipe-to-dismiss, long-press,
drag, scroll-into-view, or any pointer gesture** — is not "done" until a real
browser drag/gesture has been observed to work.

This is a standing rule because the sheet-drag handle was reported broken
*three times* after being "fixed" against green unit tests that never dispatched
the pointer sequence. When you add or change a gesture:

1. Write/keep a unit test for the pure logic (e.g. `tests/sheet-drag.test.tsx`),
   AND
2. Drive it in Chromium and watch it work.

### Real-browser check recipe (no repo dep added)

```bash
npm run build
npm run preview -- --port 4319 &            # serve the built app
npm install --no-save playwright-core       # library only; browser is preinstalled
# script: launch with the preinstalled binary + a mobile/touch context, then
# drive the gesture and assert the outcome:
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
#                     args: ['--no-sandbox'] })
#   ctx = browser.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })
#   ... page.mouse.move/down/move.../up on the target, then check the result
node your-verify-script.mjs                  # run it from the repo root so node resolves node_modules
pkill -f "vite preview"
```

The mobile/touch context matters: the sheet grabber is hidden ≥768px
(`.panel-sheet .grabber { display:none }`), so desktop viewports can't test it.

## Sheets & gestures

- `src/ui/useSheetDrag.ts` — swipe-down-to-dismiss. Binds pointermove/up
  listeners synchronously in `onPointerDown` on the pointer-captured element
  (an effect-based binding raced the drag). Every bottom sheet (BookPicker,
  Search, Strong's, Settings, mobile DetailPanel) uses it; if you add a sheet,
  wire it AND browser-test the drag.
- The grabber is a tall, full-width hit target with a small visual pill
  (`.grabber` / `.grabber::before`) — don't shrink the hit area back to the pill.
