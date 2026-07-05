@AGENTS.md

> **Token optimization**: This file is a hygiene checklist only. AGENTS.md is the canonical reference for git workflow, deployment, builds, architecture, and cookbook tasks. Read it first.

## 🚀 Publishing — making changes reach users (READ THIS, it's the #1 gotcha)

**Pushing a `claude/**` branch does NOT publish anything to users.** The OTA
update workflow (`.github/workflows/update.yml`) runs **only on push to `main`**.
A fix that lives only on a feature branch is invisible to every installed app.

To make ANY JS/UI/logic change go live (see `PUBLISHING.md` for the full guide):

1. Commit + push your work on the designated `claude/**` branch.
2. Open a PR from that branch into `main`.
3. **Merge the PR into `main`.** That push to `main` triggers `update.yml`, which
   runs `eas update --branch preview` targeting `runtimeVersion` in `app.json`
   (currently `1.1.0`). Users get it on next launch (~1–2 min).

If the user says "I can't see the update," the cause is almost always: **the
commit never reached `main`.** Check `git log origin/main` for your commit before
looking anywhere else. (Runtime must also match: OTA only reaches installs whose
runtime == `app.json` `runtimeVersion`. Native changes need a new build, not OTA —
see AGENTS.md.)

**A task that must "go live" is not finished until it is merged to `main`** (or
you've explicitly handed the merge to the user).

## Before Starting

- **For ANY build, version bump, or APK work:** Read `OTA_BUILD_WORKFLOW.md` first. It documents the exact sequence to avoid runtime mismatches and broken OTA updates.
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
| `slug` in `app.json` MUST stay `unfocus` | EAS project registration (ID: `9c7c7e82-8c6e-4be7-aae1-e588b4ebc495`) |
| All UI text through `useT()` from `lib/i18n.ts` | Bilingual (EN/NO) |
| Date format always `YYYY-MM-DD` | Used as keys throughout stores |
| SQLite file: `unfocus.db` (in `lib/db.ts`) | Fixed name for device storage |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations | Runs once; never drop/recreate |
| Stores use `lib/dataAccess.ts` | 13 of 14 stores rely on this pattern |
| To publish, MERGE TO `main` | OTA (`update.yml`) fires only on push to `main`; a `claude/**` branch push publishes nothing (see the "Publishing" section above + `PUBLISHING.md`) |
| New builds go through the maintainer; don't bump `runtimeVersion` ahead of the build | OTA reaches only installs on the matching runtime — bump `runtimeVersion` only *after* the maintainer cuts the new preview build (see AGENTS.md "Runtime version") |

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
