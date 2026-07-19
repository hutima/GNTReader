# Handoff — 2026-07-19 — settings About/install, vocab default + tutorial, import/export

Working branch: `claude/fable-settings-tutorials-ujps13` (based on main @ 8670738).
This file is the resumable orchestration state. It is updated and pushed after every
milestone; delete it before merging the PR.

## The request (user, verbatim intent)

1. Add an "About the author" section + PWA install button to Settings, patterned
   after https://hutima.github.io/PCA_Ordination_Study/ . Links must make sense
   (not self-referential — do NOT link GNT Reader from inside GNT Reader).
   About-the-author appears at the TOP of the appearance/settings modal.
2. Make vocab mode the DEFAULT reading mode. Add a "how to use" for BOTH modes.
   Add a skippable step-through tutorial describing guided mode. Must work on
   mobile AND desktop. Step-through modals styled similar to
   https://hutima.github.io/ScriptureDiagrammer/ .
3. Import/export settings/progress as JSON, at the BOTTOM of the settings panel.

Process constraint: Fable acts as orchestrator only; implementation is delegated
to Sonnet-tier subagents; independent agent verifies (incl. REAL-browser check per
CLAUDE.md); commit+push after each milestone for resumability.

## Plan / status

- [ ] M1 Scout: codebase map + PCA about/install pattern + ScriptureDiagrammer
      tutorial pattern (3 parallel agents) → findings distilled below.
- [x] M2 Implement: About-the-author + install button (top of Settings) —
      src/pwa/install.ts (beforeinstallprompt capture + useInstallPrompt hook),
      SettingsPanel first section, tests/install-prompt.test.ts. 51/51 tests
      pass (re-verified by orchestrator, not just implementer claim).
- [ ] M3 Implement: vocab default + how-to-use both modes + skippable guided
      tutorial (mobile + desktop).
- [x] M4 Implement: import/export settings/progress JSON (bottom of Settings) —
      src/state/backup.ts (buildBackup/parseBackup/applyBackup, zod-validated,
      never throws), store gains restoreKnown + restorePosition bulk setters
      (navigate() would close the sheet mid-import — approved deviation),
      "Backup" last section in SettingsPanel, tests/backup.test.tsx (11 tests).
      62/62 pass (orchestrator re-verified). Implementer also drove the real
      file-input/export flow in Chromium (download name, restore, error path).
- [ ] M5 Verify: typecheck/lint/test/build + real Chromium run, mobile
      (390x844 touch) + desktop viewports, per CLAUDE.md recipe.
- [ ] M6 Final review, squash-tidy if needed, push. (PR only if user asks.)

## Scout findings

### Codebase map (done — verified-by-reading by Explore agent)

- Settings sheet: `src/ui/SettingsPanel.tsx` (330 lines). Sections in order:
  Appearance (l.100), Vocabulary (l.174), Offline reading (l.251), Reference
  (l.286), App updates & cache (l.295). New About/install section goes as FIRST
  child of `.settings` (after grabber, l.98); import/export goes LAST.
  CSS: `src/styles.css` l.834-906 (`.settings-section`, `.settings-row`,
  `.settings-actions`, `.settings-note`), buttons `.mini`/`.mini.accept`.
  Desktop ≥768px: sheet becomes centered modal, grabber hidden (l.602-615).
- State: single zustand store `src/state/store.ts`. localStorage keys l.25-33:
  gr:lastRef, gr:displayMode, gr:theme, gr:readingScale, gr:syntax, gr:vocab,
  gr:vocabMarkLexeme, gr:knownLexemes, gr:knownParses. Pattern: loadX() with
  zod parse + fallback, writes via safeSet(). New keys need a row in
  docs/config.md.
- Modes: DisplayMode = 'original'|'gloss'|'both' (store.ts:12), default
  'original' (loadMode fallback, store.ts:64). vocabMode is a BOOLEAN toggle
  (default false, store.ts:99-105) that only affects 'both' mode (TokenSpan.tsx
  l.121-126 hides gloss for known words). **"guided mode" DOES NOT EXIST** —
  only mention is docs/adr/0001 l.62 as explicitly-rejected diagrammer concept.
  → Asked user what "guided mode" means (see Decisions below).
- PWA: vite-plugin-pwa injectManifest, manual SW `src/sw.ts`, registration in
  `src/pwa/pwa.ts` (module state + usePwa() hook — mirror this for install
  prompt). NO beforeinstallprompt handling exists; iOS never fires it (hide
  button / show A2HS hint). Don't violate pwa-invariants.test.ts.
- Modal infra: bottom sheets use useSheetDrag (MUST wire + browser-test any new
  sheet). Centered `.modal`/`.modal-backdrop` (styles.css:768-802, z-index 40)
  used by UpdateModal.tsx — mounted unconditionally at end of App.tsx (l.83),
  self-gating; **that's the template for the first-run tutorial overlay**.
  useIsMobile() in src/ui/useViewport.ts (breakpoint 767px).
- Tests: tests/*.test.tsx, vitest+happy-dom, render(<App/>), role-based queries,
  fetch stubbed. tests/smoke.test.tsx asserts default position + 3 mode tabs —
  update when defaults change. settings-ui.test.tsx checks dialog text.
- Docs of record: docs/config.md table (one row per axis — update for any new
  key/default change); ADR-0001 amendment style for reversing "guided mode"
  rejection if we build one.

### PCA_Ordination_Study about/install pattern (done — source read from raw.githubusercontent, live site blocked by proxy)

- It's actually a footer "Contact the author" modal + an "Install app" button in
  a Settings <details>. Copy to adapt: "This app is maintained by Timothy
  Hutama, an MTS student at Wycliffe College. The author makes no guarantees
  about the content but has made a best attempt to make sure everything is
  accurate." Blog https://definedfaith.wordpress.com/ ; LinkedIn
  https://www.linkedin.com/in/timothyhutama/ ; projects list (on PCA site:
  Lectio-Memorization, ScriptureDiagrammer, GNTReader); coffee line: e-transfer
  t.hutama@queensu.ca / Venmo @hutima. All links target=_blank rel="noopener
  noreferrer". For GNT Reader: DROP the GNT Reader link (self-referential), ADD
  https://hutima.github.io/PCA_Ordination_Study/ instead.
- Install logic (js/app/pwaInstall.js): capture beforeinstallprompt
  (preventDefault, stash), on click dp.prompt(); appinstalled → clear; if no
  deferred prompt (iOS) → show platform-detected "how to install" steps modal
  (iOS: Share → Add to Home Screen; Android: ⋮ → Install app; generic: browser
  menu). isStandalone() = display-mode standalone || navigator.standalone.
  Hide button when standalone. We adapt: settings button only (no auto banner),
  allow desktop installs (don't copy the phone-only gate).

### ScriptureDiagrammer tutorial pattern — CANCELLED (user stopped the scout)

- Decision: tutorial uses GNT Reader's own .modal/.modal-backdrop conventions
  (UpdateModal family — same centered-card language as the author's other
  apps per PCA findings) + standard step-through furniture: progress dots,
  Back/Next, Skip on every step, final "Get started". No backdrop-dismiss.
- M3 design fixed by orchestrator: gr:tutorialSeen key (loader pattern),
  store tutorialOpen/tutorialSeen + openTutorial/closeTutorial, TutorialModal
  mounted before UpdateModal in App.tsx, 5 steps teaching vocab mode in Both
  view, "How to use" section (2nd, after About) with Replay tour button,
  first-run defaults displayMode 'both' + vocabMode true, test setup.ts
  pre-seeds gr:tutorialSeen=true to keep existing tests clean.

## Decisions

- USER DECISION (2026-07-19): NO guided mode. First-launch tutorial teaches
  vocab mode in the "Both" view. "Vocab default" = first-run defaults
  displayMode 'both' + vocabMode true (persisted user choices untouched).
- "How to use" delivered as help copy for the display modes + vocab mode and a
  "replay tutorial" affordance in Settings.
- M2 order: About/install (top of Settings) → M4 import/export (bottom) → M3
  tutorial+defaults. Sequential because all touch SettingsPanel.tsx.

## Verified / Open / Beware

State: branch created locally; nothing implemented yet.
Verified: `npm` scripts are dev/build/preview/test/lint/typecheck (verified-by-reading
package.json). Store: zustand; validation: zod; PWA: vite-plugin-pwa; tests:
vitest + happy-dom (browser gestures need real Chromium — see CLAUDE.md).
Open: everything in Plan.
Next command: resume by reading this file, then `git log --oneline -10` to see
which milestones landed; continue from first unchecked box.
Beware: sheet-drag regressions — any new sheet/modal must wire src/ui/useSheetDrag.ts
and be browser-tested (CLAUDE.md standing rule).
