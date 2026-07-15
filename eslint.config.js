/**
 * eslint.config.js — flat-config lint rules (ESLint 9).
 *
 * Built on eslint-config-expo (the RN/Expo + TypeScript + react-hooks preset) with
 * eslint-config-prettier last so formatting is Prettier's job, not ESLint's. The
 * intent (single-dev codebase, first lint pass) is high-signal correctness only —
 * bug-shaped rules stay errors; stylistic/verbose ones are downgraded to warnings
 * so `npm run lint` stays green and CI blocks only on real problems.
 */
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'dist/*',
      'coverage/*',
      'node_modules/*',
      'preview-shots/*',
      '.expo/*',
      'web-build/*',
      'scripts/*.mjs',
    ],
  },
  ...expo,
  prettier,
  {
    // eslint-config-expo already sets the high-signal rules the way we want
    // (react-hooks/rules-of-hooks = error; unused-vars + exhaustive-deps = warn).
    // These two are the only tweaks: empty catch blocks are an intentional idiom
    // here (best-effort DB/notification writes), and the `@/` path alias is
    // resolved by TypeScript, so import/no-unresolved can't see it.
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'import/no-unresolved': ['error', { ignore: ['^@/'] }],
    },
  },
  {
    // Plain-JS tooling files (Jest setup/mocks, CI config script) run in Node with
    // Jest globals — declare those so no-undef (off for TS, on for JS) doesn't fire.
    files: ['jest.setup.js', '__mocks__/**/*.js', '.github/scripts/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
