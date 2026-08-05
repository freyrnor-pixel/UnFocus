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
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/worktrees/'],
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
