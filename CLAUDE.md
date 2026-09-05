@AGENTS.md

> **Token optimization**: This file is a hygiene checklist only. AGENTS.md is the canonical reference for git workflow, deployment, builds, architecture, and cookbook tasks. Read it first.

## 🚀 Publishing — making changes reach users (READ THIS, it's the #1 gotcha)

**Pushing a `claude/**` branch does NOT publish anything to users.** The OTA
update workflow (`.github/workflows/update.yml`) runs **only on push to `main`**.
A fix that lives only on a feature branch is invisible to every installed app.

**Standing rule — ALWAYS open a PR and ALWAYS merge it to `main`.** Every code
change finishes with a PR from the `claude/**` branch into `main` that you then
merge yourself. Do not stop at "pushed the branch," and do not hand the merge
back to the user as a separate step — merging is part of the task. (The maintainer
granted this standing authorization; it applies to native-surface changes too.
**As of 2026-07-26 this also covers triggering `eas-build-android.yml`** (the
OTA-capable preview APK) — see AGENTS.md "New preview APK build" for why that one
specifically is safe (non-interactive, stored token, established precedent) while
the debug-gradle build, production AAB, and TestFlight stay maintainer-only —
those touch real signing credentials / store submission an agent session
shouldn't set up interactively.)

To make ANY JS/UI/logic change go live (see `PUBLISHING.md` for the full guide):

1. Commit + push your work on the designated `claude/**` branch.
2. Open a PR from that branch into `main`.
3. **Merge the PR into `main`.** That push to `main` triggers `update.yml`, which
   runs `eas update --branch preview` targeting whatever `runtimeVersion` is
   currently set in `app.json`. Users get it on next launch (~1–2 min).

Always do all three, every time, without being asked.

If the user says "I can't see the update," the cause is almost always: **the
commit never reached `main`.** Check `git log origin/main` for your commit before
looking anywhere else. (Runtime must also match: OTA only reaches installs whose
runtime == `app.json` `runtimeVersion`. Native changes need a new build, not OTA —
see AGENTS.md.)

**A task is not finished until its PR is merged to `main`.**

## Before Starting

- **For ANY copy change:** `DESIGN_RULES.md` §7 (rules 22–25) is the rulebook, CI-enforced by `lib/__tests__/copyTone.test.ts`. `VOICE.md` records the app's one deliberate exception (the day log's first-person empty state) — read it before "correcting" that string or adding first-person copy anywhere.
- **For ANY screen or visual change:** Read `DESIGN_RULES.md` first — **33** numbered invariants plus the open conflicts where a rule is *not* yet binding. Its "Quick self-check" list is the ship gate. `DESIGN_RULES_AUDIT.md` says which violations are deliberate and why.
  - ⚠️ **For a CARD, read AGENTS.md's "One card shape — the card registry" entry FIRST.** A card is
    declared in `lib/cardRegistry.ts` and drawn by `components/Card.tsx`; a caller names one
    (`<Card id="todoToday">`) rather than describing it, an unregistered card is a tsc error, and
    no other file may import the fold or the ⤢. Most of the older card prose describes how that
    was reached, not how a card is built.
  - ⚠️ **§8 "Component identity" (rules 26–33, added 2026-08-21) is the one to read first for a new surface.** §1–7 govern VALUES — spacing, contrast, targets, durations — and until §8 existed nothing governed which COMPONENT owns a thing. That gap is where a maintainer audit found sixteen recurring defects hiding: the app shipped one `FIELD_RADIUS` and nine field shapes, one canonical card header and fourteen variants. The token was never the problem. `CONSISTENCY_AUDIT.md` is the evidence, with a `file:line` per finding and a list of what is deferred and on which decision.
  - **The 41 root markdown docs are now 18**; the rest are in `docs/archive/` with an index saying what superseded each. Don't reach for a `*_LIBRARY.md` — `constants/` is the source of truth for every number.
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
| All UI text through `useT()` from `lib/i18n.ts` | Multilingual (EN/NO/IS). `no`/`is` are typed `typeof en`, so a missing key fails `tsc`. Icelandic counted nouns go through `isCount` — see AGENTS.md |
| Date format always `YYYY-MM-DD` | Used as keys throughout stores |
| SQLite file: `unfocus.db` (in `lib/db.ts`) | Fixed name for device storage |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations | Runs once; never drop/recreate |
| Stores use `lib/dataAccess.ts` for row mapping, and `lib/storeCrud.ts` for a by-id `update`/`remove` | All 21 stores go through dataAccess (the old "13 of 14" was stale on both halves). `updateById`/`deleteById` carry the in-memory guard that two stores had silently been missing — see AGENTS.md's invariant row |
| No bare `48` (or `44`), `hitSlop: 8`, or `duration: 220` — use `MIN_TAP_TARGET`/`HitSlop` (`constants/theme.ts`) and `Duration.*` (`constants/motion.ts`). **`MIN_TAP_TARGET` is 48 since 2026-08-08** (Material Design 3), up from 44; both literals are banned at call sites | `DESIGN_RULES.md` rules 17 + 21, guarded by `lib/__tests__/designTokens.test.ts` in CI |
| No guilt/urgency copy in `lib/i18n.ts` — never "missed", "overdue", "forgot", "behind" | `DESIGN_RULES.md` rule 23; `lib/__tests__/copyTone.test.ts` fails the PR. A tray is "still due", never "missed" |
| ALWAYS open a PR and merge it to `main` | Every change ends with a PR into `main` that you merge yourself — never stop at the branch, never hand the merge off. OTA (`update.yml`) fires only on push to `main` (see the "Publishing" section above + `PUBLISHING.md`) |
| Native builds: trigger `eas-build-android.yml` yourself; bump `runtimeVersion`/`version` first, then trigger | This is the OTA-capable preview APK, non-interactive, already used this way repeatedly — NOT maintainer-gated. Only the debug-gradle build, production AAB, and TestFlight (real signing/store submission) stay maintainer-only. See AGENTS.md "New preview APK build" + "Runtime version" for the exact sequencing (bump-then-build here, the reverse of the maintainer-only paths) |

### Navigation State
- **BottomNav** (`components/BottomNav.tsx`) — current, only entry point; no redesign needed
- **BubbleMenu** (radial FAB from the pre-rebuild spec) — dropped before porting (Decision 008 #5); `components/BubbleMenu.tsx` does not exist in this repo, don't look for it

### Testing — headless verification (no device needed)
A full emulator is **not feasible** in the remote environment (no KVM/virtualization,
and the app is deeply native), so verification is headless. Both of these run in the
remote env (the session-start hook installs deps):

- **Typecheck first:** `npx tsc --noEmit` — runs and passes here. Catches broken
  imports, type errors, and (because `no: typeof en` in `lib/i18n.ts`) missing/mismatched
  i18n keys at compile time. This is the cheap first-pass gate on every change.
- **Jest suite** over the pure logic/store layer (`__tests__/` + `lib/__tests__/`):
  date/time helpers, `dataAccess`, receipt parsing, reminder scheduling, live-sync LWW.
  Native modules (`expo-sqlite`, notifications, etc.) are mocked — see
  `__mocks__/expo-sqlite.js` and the `jest.mock` patterns in `__tests__/*.test.ts`.
- **Run only what a change affects, and only for behavioral changes:**
  `scripts/test-changed.sh` (wraps `jest --findRelatedTests` over the git diff).
  A pure move/rename/comment/header edit gets `tsc --noEmit` only — skip Jest.
  Report which tests ran + their pass/fail, not a blanket "all green".
- **Visual/logic verification via the web preview "emulator":** a real Android
  emulator still isn't feasible here (no KVM), but `npm run preview` builds the app as
  Expo Web and drives it headlessly with Playwright (Chromium pre-installed) — screenshots
  every onboarding step + all 5 tabs, and exercises adding a task to prove the SQLite
  write→read path, not just static render. See "Web preview for agent testing" in
  AGENTS.md for the full command set and the SQLite-on-web caveat (in-memory `sql.js`,
  not the native SQLite file). **Fidelity caveat:** react-native-web layout/logic is
  faithful but NOT pixel-identical to native (shadows, font metrics, Reanimated timing
  differ) — use it for "does the flow/logic work," not final visual sign-off.
- **Still not covered:** true pixel-perfect native rendering, gestures (swipe/haptics),
  and anything behind a native-only module (camera OCR, widgets, LAN sync) — those need
  a real device (maintainer, or a local emulator where KVM exists).

## During Work

- **Don't re-read docs already fetched this session.** Reuse SDK/API context from earlier turns instead of re-fetching.
- **Update headers as you go.** When you change a file's imports or callers, fix the `Connections:` block in the same edit. This keeps the next session's context current and saves token re-derivation later.
- **Open only what the task touches.** For cookbook tasks, read just the files named in that task's steps — not the whole `app/`, `store/`, or `lib/` directory.
- **Skip multi-agent delegation.** This is a single-branch, single-dev codebase; coordinate overhead has no payoff at this scale.

## Reporting contract for visual/rendering changes (session S0.2, 2026-09-05)

The recurring failure mode this exists to close: a session announces a visual change as done, and
the shipped app doesn't change. The cause is structural — CI proves types, logic and an unchanged
**web** render, but cannot see native appearance. A session can honestly believe it fixed
something the harness never actually saw. `INVARIANTS.md` carries a one-line pointer to this
section; the rules themselves live here, not duplicated there.

**A1 — Evidence tags.** No session writes "fixed" for a visual change. Every claim carries one of:

| tag | means |
|---|---|
| `verified-by-<harness>` | a named harness saw it — `visual`, `geometry`, `wraps`, `halos`, jest |
| `verified-by-device` | the maintainer confirmed it on an install |
| `unverified` | nothing could see it — **the item stays open** |

**A2 — Blind classes declared up front.** Before coding, a session states whether the change lands
in a class no harness can see. Known classes, from `HARNESS.md` and the round-20 findings:

- Android optical centering — `OpticalCenter` is a no-op on web.
- `Fonts.italic` — RN does not synthesise italic onto a named custom family on Android; every
  harness renders a perfect slant over what would ship upright.
- Native shadow and corner rendering; `expo-blur` output.
- Gestures and haptics.
- `app/scan.tsx` — the web bundle resolves a placeholder.
- Dark-on-dark and 1-level light shifts: `HARNESS.md` records `visual` reporting a 46,329-pixel
  1-level light change as `unchanged`. After a re-bless, read `git status` — a file the gate
  called unchanged that changed on disk is a real difference the gate couldn't see.

**A3 — The verification card.** Every session touching rendering ends with one, only after fixing
**all** call sites and checking **both** themes. Budget: one round trip per item.

```
## Verification — <session id>
Fixed at N call sites: <file:line list>
Harnesses that saw it: <names>  ·  Blind to this change: <names or "none">

Check on device, both themes:
1. [dark]  <screen> → <element>: <observable>.     pass / fail
2. [light] <same>                                  pass / fail

Reply with the numbers only. Anything not listed was not changed.
```

Two failures on one line stops the item — it goes to `DECISIONS_OPEN.md` rather than a third
attempt. Two failures means the diagnosis is wrong, not the implementation.

**A4 — Enumerate before fixing.** Every visual fix opens by grepping every implementation of the
thing being changed and listing them `file:line`. Fix all, or write down why not. Precedent:
`PadSheet`, `HabitsSurface` and `PlanTaskCard` once drew three different rows while the guard
compared only two of them (`lib/rowList.ts` is the fix — see `INVARIANTS.md`'s crash-class-traps
section).

**Both-theme harness coverage.** As of 2026-09-01, `visual`, `geometry`, `wraps` and `halos` all
run both themes in CI (`.github/workflows/ci.yml`'s `visual` job) — verified again by session
S0.2 (2026-09-05), which also probed each harness with a deliberate light-mode-only defect to
confirm it actually fails on one, not just executes twice. See
`docs/audit/HARNESS_THEME_COVERAGE.md` for the probe results.

## After Completing a Cookbook Task

- Run `npx tsc --noEmit` to typecheck (works in the remote env now)
- For behavioral changes, run `scripts/test-changed.sh` to exercise the affected tests
- Verify file headers are accurate
- `/clear` before starting an unrelated task — but carry forward which files changed and any new i18n keys/migration lines, so the next step doesn't need to re-read what was just written

---

**AGENTS.md is ~13.5 KB.** Read it once at the start of a session. Everything else is reference.
