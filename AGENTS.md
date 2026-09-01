# AGENTS.md — router

**UnFocus** is an ADHD life-management app (React Native / Expo SDK 56, TypeScript, Expo Router,
Zustand + SQLite). Local-only, no backend. Norwegian-first, fully translated into English and
Icelandic. Target: iOS + Android. This repo is the live, canonical source of all builds — the
sibling `All-the-small-things` repo is a retired predecessor kept only for reference; do not build
or publish from it. Expo's docs changed underneath this SDK — read the versioned docs at
https://docs.expo.dev/versions/v56.0.0/ before writing new code against an Expo API.

Every `.ts`/`.tsx` file starts with a JSDoc header (`Connections: Imports → / Used by → / Data`) —
read it before editing a file, and update both ends of the map when you change an import.

This file used to hold the full instruction surface directly. As of session S0.1 (2026-09-01) it
is a router to four destinations, chosen so a claim lives in exactly one place:

1. **`INVARIANTS.md`** — rules to hold *before touching anything*: registration/build identity,
   data-flow contracts, the card registry, copy tone, tap targets, publishing, known crash-class
   traps, feature-flag rules, and the condensed cookbook (add a screen / i18n string / SQLite
   column / setting toggle / feature flag). Read this first for any task.
2. **`HARNESS.md`** — how to run and correctly read the output of this repo's headless
   verification: `tsc`, jest, the web preview, and the four visual audits (`wraps`, `halos`,
   `visual`, `geometry`) — including each one's documented false positives and blind spots. Read
   this before trusting (or "fixing") anything an audit script reports.
3. **A comment at the call site** — anything governing one function, component, or script lives
   in that file's own header/docstring, or in the test that pins it. Prefer that over asking here.
4. **`docs/archive/AGENTS_HISTORY.md`** — the dated, maintainer-brief-by-brief history of how the
   UI/architecture reached its current shape. True and worth reading for *why*, but not current
   state — check the code or `INVARIANTS.md` for what binds now.

`docs/audit/INSTRUCTION_SURFACE_AUDIT.md` is the ledger recording which of this file's original
claims went where, and which were found stale or unverifiable in the process.
`docs/sessions/S0.1_INSTRUCTION_SURFACE.md` is the brief that session executed against, kept as a
record of the process rather than a task still open.

Other standing references, unchanged by this relocation: `DESIGN_RULES.md` (visual invariants),
`DESIGN_RULES_AUDIT.md` (which of those are open conflicts, not yet binding), `VOICE.md` (copy's
one first-person exception), `TESTING.md` (test-pyramid strategy), `PUBLISHING.md` (the
merge-to-`main` publish flow), `ANIMATION_GUIDELINES.md` (motion/haptics contract).
