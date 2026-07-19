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
- [ ] M2 Implement: About-the-author + install button (top of Settings).
- [ ] M3 Implement: vocab default + how-to-use both modes + skippable guided
      tutorial (mobile + desktop).
- [ ] M4 Implement: import/export settings/progress JSON (bottom of Settings).
- [ ] M5 Verify: typecheck/lint/test/build + real Chromium run, mobile
      (390x844 touch) + desktop viewports, per CLAUDE.md recipe.
- [ ] M6 Final review, squash-tidy if needed, push. (PR only if user asks.)

## Scout findings

(to be filled after M1)

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
