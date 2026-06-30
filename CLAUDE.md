@AGENTS.md

> **Token optimization**: This file is a hygiene checklist only. AGENTS.md is the canonical reference for git workflow, deployment, builds, architecture, and cookbook tasks. Read it first.

## Before Starting

- **Read file headers first.** Every `.ts`/`.tsx` file starts with a JSDoc block listing imports, callers, data touches, and gotchas. This is the fastest way to understand a file's purpose — no need to read the whole thing.
- **Trust AGENTS.md's hand-maintained dependency maps.** Don't grep the repo to re-derive what's already written in the `Connections:` blocks in file headers. If a header looks stale, update it as you go — cheap now, expensive later.

## Quick Checklist

### Before Each Task
- [ ] Open the file header (or `AGENTS.md`) to see what imports/uses this file
- [ ] Check `AGENTS.md` for cookbook tasks (add screen, add i18n, add migration, add setting) — follow the numbered steps exactly
- [ ] For git/deployment questions → `AGENTS.md` "Builds and updates" section
- [ ] For architecture questions → `AGENTS.md` "Architecture at a glance" + key invariants table
- [ ] For known gotchas → `AGENTS.md` "Known gotchas" section

### Key Rules (Don't Break These)
| Rule | Why |
|---|---|
| `slug` in `app.json` MUST stay `all-the-small-things` | EAS project registration |
| All UI text through `useT()` from `lib/i18n.ts` | Bilingual (EN/NO) |
| Date format always `YYYY-MM-DD` | Used as keys throughout stores |
| SQLite file: `unfocus.db` (in `lib/db.ts`) | Fixed name for device storage |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations | Runs once; never drop/recreate |
| Stores use `lib/dataAccess.ts` | 13 of 14 stores rely on this pattern |
| Runtime version locked to `1.0.0` | Targets APK build 148977ec; do NOT change without new build |

### Navigation State
- **BottomNav** (`components/BottomNav.tsx`) — current, only entry point; no redesign needed
- **BubbleMenu** (radial FAB) — explicitly **deferred**; do NOT touch unless asked

### Testing
- **No Jest required** until further notice (no test runs, no live-app verification)
- Manual code review only: read through for bugs and dead code
- TypeScript typecheck (`npx tsc --noEmit`) is local-only; not available in remote environment

## During Work

- **Don't re-read docs already fetched this session.** Reuse SDK/API context from earlier turns instead of re-fetching.
- **Update headers as you go.** When you change a file's imports or callers, fix the `Connections:` block in the same edit. This keeps the next session's context current and saves token re-derivation later.
- **Open only what the task touches.** For cookbook tasks, read just the files named in that task's steps — not the whole `app/`, `store/`, or `lib/` directory.
- **Skip multi-agent delegation.** This is a single-branch, single-dev codebase; coordinate overhead has no payoff at this scale.

## After Completing a Cookbook Task

- Run `npx tsc --noEmit` locally to typecheck
- Verify file headers are accurate
- `/clear` before starting an unrelated task — but carry forward which files changed and any new i18n keys/migration lines, so the next step doesn't need to re-read what was just written

---

**AGENTS.md is ~13.5 KB.** Read it once at the start of a session. Everything else is reference.
