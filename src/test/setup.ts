import '@testing-library/jest-dom/vitest';

// Pre-seed the tutorial as already-seen so the first-launch TutorialModal
// doesn't auto-open and pollute the ~16 existing test files. Serialized as
// 'on' to mirror the sibling on/off boolean keys (gr:vocab, gr:syntax,
// gr:vocabMarkLexeme — see src/state/store.ts), not 'true'/'false'. The
// store module (and its module-scope loaders) is imported by test files
// AFTER this setup file runs, so the loader sees this key already present.
localStorage.setItem('gr:tutorialSeen', 'on');
