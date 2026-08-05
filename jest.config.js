module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // `.claude/worktrees/` holds git worktrees the agent harness checks out INSIDE the repo,
  // each a full second copy of the tree. Without this, `npx jest` globs them too and the
  // suite jumps from ~71 files to ~213 — every test triples, and a worktree sitting on an
  // older commit reports failures for code that is no longer on this branch. CI never sees
  // it (a fresh clone has no worktrees), so it only ever misleads a local run.
  //
  // **`<rootDir>` is load-bearing, do not shorten this to a bare '/\\.claude/worktrees/'.**
  // These patterns match the ABSOLUTE path, and a worktree's own files live under
  // `…/UnFocus/.claude/worktrees/agent-x/…` — so an unanchored pattern excludes every test
  // in the worktree you are currently standing in. `npx jest` then exits "No tests found"
  // instead of running the suite, which reads as a broken config rather than a silent
  // no-op. Anchoring to `<rootDir>` scopes it to worktrees BELOW the tree being tested:
  // from the main checkout it still skips them, and from inside a worktree it matches
  // nothing, because that worktree is itself the rootDir.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/\\.claude/worktrees/'],
  // Coverage is collected over the testable logic layer only: the pure helpers in
  // lib/ and the Zustand stores. Excluded — static seed data, the `.web` platform
  // siblings (native path is the source of truth), and pure-native wrappers/hooks
  // that can't run headless. `npm run test:coverage` prints the summary.
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    '!lib/**/*.web.ts',
    '!lib/**/__tests__/**',
    '!lib/*Seed.ts',
    '!lib/widgets/**',
    '!lib/sqlite.ts',
    '!lib/haptics.ts',
    '!lib/lanTransport.ts',
    '!lib/useAppTheme.ts',
    '!lib/useVoiceCapture.ts',
    '!lib/useMountedTransition.ts',
    '!lib/useFirstVisitHint.ts',
    '!lib/useToggleColor.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // A ratchet, not an aspiration: set just below the current baseline (stmts ~29%,
  // branches ~24%, funcs ~16%, lines ~30% as of this suite) so coverage can only
  // go up. Raise these numbers as new tests land; never lower them to make a red
  // run pass — fix the test instead.
  coverageThreshold: {
    global: {
      statements: 27,
      branches: 21,
      functions: 14,
      lines: 28,
    },
  },
};
